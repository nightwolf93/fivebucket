import GuestLayout from '@/Layouts/GuestLayout';
import PrimaryButton from '@/Components/PrimaryButton';
import { Head, Link, useForm } from '@inertiajs/react';
import { MailCheck } from 'lucide-react';

export default function VerifyEmail({ status }) {
    const { post, processing } = useForm({});

    const submit = (e) => {
        e.preventDefault();

        post(route('verification.send'));
    };

    return (
        <GuestLayout title="Verify your email" subtitle="Confirm your email address to unlock the workspace.">
            <Head title="Email Verification" />

            {status === 'verification-link-sent' && (
                <div className="fb-alert success mb-4">
                    A new verification link has been sent to the email address you provided during registration.
                </div>
            )}

            <form onSubmit={submit}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <PrimaryButton disabled={processing}>
                        <MailCheck className="h-4 w-4" />
                        Resend verification email
                    </PrimaryButton>

                    <Link
                        href={route('logout')}
                        method="post"
                        as="button"
                        className="text-[12px] font-medium text-[var(--accent)] text-decoration-none hover:underline"
                    >
                        Log Out
                    </Link>
                </div>
            </form>
        </GuestLayout>
    );
}
