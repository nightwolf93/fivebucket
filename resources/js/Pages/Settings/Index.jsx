import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
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

            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <div>
                    <p className="text-sm font-medium text-slate-500">{team.slug}</p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-950">Client Settings</h1>
                    <p className="mt-2 text-sm text-slate-600">Configure public delivery URLs and account-level hosting behavior.</p>
                </div>

                {flash.success && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{flash.success}</div>}

                <Card>
                    <CardHeader>
                        <CardTitle>Public URL Override</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submit} className="space-y-5">
                            <label className="block text-sm font-medium text-slate-700">
                                Public base URL
                                <input
                                    className="mt-1 block h-10 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                    placeholder="https://cdn.example.com"
                                    value={form.data.public_base_url}
                                    onChange={(event) => form.setData('public_base_url', event.target.value)}
                                />
                                <span className="mt-1 block text-xs text-slate-500">New uploads will use this base URL in API responses.</span>
                                {form.errors.public_base_url && <span className="mt-1 block text-xs text-red-600">{form.errors.public_base_url}</span>}
                            </label>

                            <label className="block text-sm font-medium text-slate-700">
                                Custom domain
                                <input
                                    className="mt-1 block h-10 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                    placeholder="assets.example.com"
                                    value={form.data.custom_domain}
                                    onChange={(event) => form.setData('custom_domain', event.target.value)}
                                />
                                <span className="mt-1 block text-xs text-slate-500">Store the customer domain you want to point at your R2/CDN endpoint.</span>
                                {form.errors.custom_domain && <span className="mt-1 block text-xs text-red-600">{form.errors.custom_domain}</span>}
                            </label>

                            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                    <Globe2 className="h-4 w-4" />
                                    Effective URL
                                </div>
                                <code className="mt-2 block break-all text-xs text-slate-600">
                                    {team.effectivePublicBaseUrl ?? storage.fallbackPublicBaseUrl ?? 'Laravel storage URL'}
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
