import { useRouter } from 'next/router';
import { useState, VFC } from 'react';
import { useForm } from 'react-hook-form';
import Loader from 'react-loader-spinner';
import SubmitButton from '../../components/SubmitButton';

import { ChangePasswordInput, useChangePasswordMutation } from '../../generated/graphql';

interface TokenProps {
    newPassword: string;
}

const Token: VFC<TokenProps> = ({}) => {
    const router = useRouter();

    const token = router.query.token;

    const [ error, setError ] = useState<Record<string, string>>({});

    const { register, handleSubmit } = useForm<TokenProps>();

    const [changePassword, { loading }] = useChangePasswordMutation({
        onError: (err) => setError(err.graphQLErrors[0].extensions?.formattedErrors),
        onCompleted: () => router.push('/'),
    });

    const onSubmit = (value: ChangePasswordInput) => {
        changePassword({ variables: {
            data: value,
            token: token as string,
        }});
    };
    
    return (
        <div className='pt-24'>
            {
                loading ? (
                    <div className='flex justify-center'>
                        <h1>Loading....</h1>
                        <Loader
                            type="TailSpin"
                            color="#00fa9a"
                            height={200}
                            width={200}
                        />
                    </div>
                ) : (
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        className='flex flex-col mx-40 text-center'
                    >
                        <p className='mt-2 text-xl'>新しいパスワード</p>
                        { error.newPassword && <p className='text-red-600'>{error.newPassword}</p> }
                        <input 
                            name='newPassword'
                            placeholder='新しいパスワード'
                            className='p-2 mt-2 border-b-2 border-green-400'
                            {...register('newPassword')}
                        />
                        <SubmitButton>
                            登録
                        </SubmitButton>
                    </form>
                )
            }
        </div>
    );
}
export default Token;