import GuestLayout from '@/Layouts/GuestLayout';
import InputError from '@/Components/InputError';
import PrimaryButton from '@/Components/PrimaryButton';
import TextInput from '@/Components/TextInput';
import { Head, Link, useForm } from '@inertiajs/react';
import { Mail } from 'lucide-react';

export default function ForgotPassword({ status }) {
    const { data, setData, post, processing, errors } = useForm({
        email: '',
    });

    const submit = (e) => {
        e.preventDefault();

        post(route('password.email'));
    };

    return (
        <GuestLayout
            title="Reset your password"
            subtitle="Enter your account email and FiveBucket will send a reset link."
            alt={<Link href={route('login')} className="fb-auth-alt">Sign in</Link>}
        >
            <Head title="Forgot Password" />

            {status && <div className="fb-alert success mb-4">{status}</div>}

            <form onSubmit={submit} className="fb-stack">
                <TextInput
                    id="email"
                    type="email"
                    name="email"
                    value={data.email}
                    className="mt-1 block w-full"
                    isFocused={true}
                    onChange={(e) => setData('email', e.target.value)}
                />

                <InputError message={errors.email} className="mt-2" />

                <div className="flex items-center justify-end">
                    <PrimaryButton disabled={processing}>
                        <Mail className="h-4 w-4" />
                        Send reset link
                    </PrimaryButton>
                </div>
            </form>
        </GuestLayout>
    );
}
