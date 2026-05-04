import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Globe2, Save } from 'lucide-react';

export default function SettingsIndex({ auth, team, storage }) {
    const { flash } = usePage().props;
    const form = useForm({
        public_base_url: team.publicBaseUrl ?? '',
        custom_domain: team.customDomain ?? '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.patch(route('settings.update'), { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Settings" />

            <div className="fb-page max-w-5xl">
                <PageHeader
                    eyebrow={team.slug}
                    title="Client Settings"
                    description="Configure public delivery URLs and account-level hosting behavior."
                    actions={<Badge>{storage.disk}</Badge>}
                />

                {flash.success && <div className="fb-alert success">{flash.success}</div>}

                <Card>
                    <CardHeader>
                        <CardTitle>Public URL Override</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="fb-stack">
                            <Field label="Public base URL" help="New uploads will use this base URL in API responses." error={form.errors.public_base_url}>
                                <input
                                    className="fb-input"
                                    placeholder="https://cdn.example.com"
                                    value={form.data.public_base_url}
                                    onChange={(event) => form.setData('public_base_url', event.target.value)}
                                />
                            </Field>

                            <Field label="Custom domain" help="Store the customer domain you want to point at your R2/CDN endpoint." error={form.errors.custom_domain}>
                                <input
                                    className="fb-input"
                                    placeholder="assets.example.com"
                                    value={form.data.custom_domain}
                                    onChange={(event) => form.setData('custom_domain', event.target.value)}
                                />
                            </Field>

                            <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
                                <div className="flex items-center gap-2 text-[12px] font-semibold fb-muted">
                                    <Globe2 className="h-4 w-4" />
                                    Effective URL
                                </div>
                                <code className="fb-inline-code mt-2 block break-all">
                                    {team.effectivePublicBaseUrl ?? storage.fallbackPublicBaseUrl ?? 'FiveBucket storage URL'}
                                </code>
                                <div className="mt-3 flex flex-wrap gap-2">
                                    <Badge>{storage.disk}</Badge>
                                    <Badge variant={team.customDomainVerifiedAt ? 'green' : 'amber'}>
                                        {team.customDomainVerifiedAt ? 'domain verified' : 'domain pending'}
                                    </Badge>
                                </div>
                            </div>

                            <Button type="submit" disabled={form.processing}>
                                <Save className="h-4 w-4" />
                                Save settings
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
