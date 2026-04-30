import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Progress } from '@/Components/ui/progress';
import { Head, useForm, usePage } from '@inertiajs/react';
import { Save, Shield } from 'lucide-react';

export default function AdminAccounts({ auth, plans, users, teams }) {
    const { flash } = usePage().props;

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Admin Accounts" />

            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <div>
                    <p className="text-sm font-medium text-slate-500">Administration</p>
                    <h1 className="mt-1 text-2xl font-semibold text-slate-950">Accounts & Quotas</h1>
                    <p className="mt-2 text-sm text-slate-600">Adjust customer storage, billing status, plan, public URL override, and admin roles.</p>
                </div>

                {flash.success && <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">{flash.success}</div>}

                <Card>
                    <CardHeader>
                        <CardTitle>Teams</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {teams.map((team) => (
                            <TeamEditor key={team.id} team={team} plans={plans} />
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-slate-100">
                        {users.map((user) => (
                            <UserEditor key={user.id} user={user} />
                        ))}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function TeamEditor({ team, plans }) {
    const form = useForm({
        storage_limit_gb: String(team.storageLimitGb),
        plan_id: team.planId ?? '',
        billing_status: team.billingStatus,
        public_base_url: team.publicBaseUrl ?? '',
    });

    const submit = (event) => {
        event.preventDefault();
        form.patch(route('admin.teams.update', team.id), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="rounded-lg border border-slate-200 p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_220px_auto] lg:items-end">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold text-slate-950">{team.name}</div>
                        <Badge>{team.planName ?? 'custom'}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                        {team.owner?.email} · {team.mediaFilesCount} media · {team.apiTokensCount} keys · {team.logEntriesCount} logs
                    </div>
                    <div className="mt-3">
                        <div className="mb-1 flex justify-between text-xs text-slate-500">
                            <span>{team.storageUsed}</span>
                            <span>{team.storagePercent}% of {team.storageLimit}</span>
                        </div>
                        <Progress value={team.storagePercent} />
                    </div>
                </div>

                <label className="block text-xs font-medium text-slate-600">
                    Limit GB
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm"
                        value={form.data.storage_limit_gb}
                        onChange={(event) => form.setData('storage_limit_gb', event.target.value)}
                    />
                </label>

                <label className="block text-xs font-medium text-slate-600">
                    Plan
                    <select
                        className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm"
                        value={form.data.plan_id}
                        onChange={(event) => form.setData('plan_id', event.target.value)}
                    >
                        <option value="">Custom</option>
                        {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>{plan.name} ({plan.included})</option>
                        ))}
                    </select>
                </label>

                <label className="block text-xs font-medium text-slate-600">
                    Billing status
                    <input
                        className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm"
                        value={form.data.billing_status}
                        onChange={(event) => form.setData('billing_status', event.target.value)}
                    />
                </label>

                <Button type="submit" disabled={form.processing}>
                    <Save className="h-4 w-4" />
                    Save
                </Button>
            </div>

            <label className="mt-4 block text-xs font-medium text-slate-600">
                Public base URL override
                <input
                    className="mt-1 h-9 w-full rounded-md border-slate-300 text-sm"
                    placeholder="https://cdn.customer.com"
                    value={form.data.public_base_url}
                    onChange={(event) => form.setData('public_base_url', event.target.value)}
                />
            </label>
        </form>
    );
}

function UserEditor({ user }) {
    const form = useForm({
        is_admin: user.isAdmin,
    });

    const submit = (event) => {
        event.preventDefault();
        form.patch(route('admin.users.update', user.id), { preserveScroll: true });
    };

    return (
        <form onSubmit={submit} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-slate-950">{user.name}</div>
                    {user.isAdmin && <Badge variant="green">admin</Badge>}
                </div>
                <div className="mt-1 text-xs text-slate-500">{user.email} · {user.teamsCount} teams · created {user.createdAt}</div>
            </div>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={Boolean(form.data.is_admin)}
                        onChange={(event) => form.setData('is_admin', event.target.checked)}
                        className="rounded border-slate-300 text-slate-950"
                    />
                    Admin
                </label>
                <Button type="submit" variant="secondary" size="sm" disabled={form.processing}>
                    <Shield className="h-4 w-4" />
                    Update
                </Button>
            </div>
        </form>
    );
}
