import {
	Arg,
	Ctx,
	FieldResolver,
	Int,
	Mutation,
	Query,
	Resolver,
	Root,
	UseMiddleware,
} from 'type-graphql';
import { getConnection, Like as findLike } from 'typeorm';

import { PaginatedQuotes, Quote } from '../entities/Quote';
import { Like } from '../entities/Like';
import { isAuth } from '../middleware/isAuth';
import { MyContext } from '../types';

@Resolver(Quote)
export class QuoteResolver {
	@FieldResolver(() => Int, { nullable: true })
	async likeStatus(
		@Root() quote: Quote,
		@Ctx() { req, likeLoader }: MyContext
	): Promise<number | null> {
		if (!req.session.userId) return null;

		const like = await likeLoader.load({
			quoteId: quote.id,
			userId: req.session.userId,
		});

		return like?.value === 1 ? 1 : null;
	}

	@FieldResolver(() => Boolean, { nullable: true })
	async hasFavorite(
		@Root() quote: Quote,
		@Ctx() { req, favoriteLoader }: MyContext
	): Promise<boolean | null> {
		if (!req.session.userId) return null;

		const favorite = await favoriteLoader.load({
			quoteId: quote.id,
			userId: req.session.userId,
		});

		return favorite ? true : false;
	}

	@Query(() => PaginatedQuotes)
	async getQuotes(
		@Arg('limit', () => Int) limit: number,
		@Arg('cursor', () => String, { nullable: true }) cursor: string | null
	): Promise<PaginatedQuotes> {
		const quoteLimit = Math.min(50, limit);
		const quoteLimitPlusOne = quoteLimit + 1;

		const qb = getConnection()
			.getRepository(Quote)
			.createQueryBuilder('q')
			.orderBy('"createdAt"', 'ASC')
			.take(quoteLimitPlusOne);
		if (cursor) {
			qb.where('"id" > :cursor', { cursor });
		}

		const quotes = await qb.getMany();

		return {
			quotes: quotes.slice(0, quoteLimit),
			hasMore: quotes.length === quoteLimitPlusOne,
		};
	}

	@Query(() => [Quote])
	async getQuote(
		@Arg('author', () => String, { nullable: true }) author: string,
		@Arg('country', () => String, { nullable: true }) country: string,
		@Arg('job', () => String, { nullable: true }) job: string,
		@Arg('category', () => String, { nullable: true }) category: string
	): Promise<Quote[] | undefined> {
		if (author) return Quote.find({ author });
		else if (country) return Quote.find({ country });
		else if (job) return Quote.find({ job });
		else return Quote.find({ category });
	}

	@Query(() => [Quote])
	async getToptenQuotes(): Promise<Quote[]> {
		const quote = Quote.find({
			order: { likeCount: 'DESC' },
		});

		return (await quote).slice(0, 10);
	}

	@Query(() => [Quote])
	async searchQuote(
		@Arg('serchArgs', () => String) searchArgs: string
	): Promise<Quote[] | undefined> {
		return Quote.find({
			where: [
				{ author: findLike(`%${searchArgs}%`) },
				{ country: findLike(`%${searchArgs}%`) },
				{ job: findLike(`%${searchArgs}%`) },
				{ text: findLike(`%${searchArgs}%`) },
			],
		});
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async likeQuote(
		@Arg('quoteId', () => Int) quoteId: number,
		@Arg('value', () => Int) value: number,
		@Ctx() { req }: MyContext
	) {
		const isLike = value !== -1;
		const realValue = isLike ? 1 : -1;
		const { userId } = req.session;

		const like = await Like.findOne({
			userId: userId,
			quoteId,
		});

		if (like && like.value !== realValue) {
			await getConnection().transaction(async (transaction) => {
				await transaction.query(
					`
                    delete from likes
                    where "quoteId" = $1 and "userId" = $2
                `,
					[quoteId, userId]
				);

				await transaction.query(
					`
                    update quotes
                    set "likeCount" = "likeCount" + $1
                    where id = $2
                `,
					[realValue, quoteId]
				);
			});
		} else if (!like) {
			await getConnection().transaction(async (transaction) => {
				await transaction.query(
					`
                    insert into likes ("userId", "quoteId", value)
                    values ($1, $2, $3)
                `,
					[userId, quoteId, realValue]
				);

				await transaction.query(
					`
                    update quotes
                    set "likeCount" = "likeCount" + $1
                    where id = $2
                `,
					[realValue, quoteId]
				);
			});
		}
		return true;
	}
}
