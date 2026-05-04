import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import DeleteUserForm from './Partials/DeleteUserForm';
import UpdatePasswordForm from './Partials/UpdatePasswordForm';
import UpdateProfileInformationForm from './Partials/UpdateProfileInformationForm';
import { Head } from '@inertiajs/react';
import { PageHeader } from '@/Components/Design';
import { Card, CardContent } from '@/Components/ui/card';

export default function Edit({ auth, mustVerifyEmail, status }) {
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Profile" />

            <div className="fb-page max-w-5xl">
                <PageHeader
                    eyebrow={auth.user.email}
                    title="Profile"
                    description="Update account identity, password, and destructive account actions."
                />

                <div className="fb-stack">
                    <Card>
                        <CardContent>
                        <UpdateProfileInformationForm
                            mustVerifyEmail={mustVerifyEmail}
                            status={status}
                        />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <UpdatePasswordForm />
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent>
                            <DeleteUserForm />
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
