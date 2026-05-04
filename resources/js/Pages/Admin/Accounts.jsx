import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { PageHeader } from '@/Components/Design';
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

            <div className="fb-page">
                <PageHeader
                    eyebrow="Administration"
                    title="Accounts & Quotas"
                    description="Adjust customer storage, billing status, plan, public URL override, and admin roles."
                    actions={<Badge>{teams.length} teams</Badge>}
                />

                {flash.success && <div className="fb-alert success">{flash.success}</div>}

                <Card>
                    <CardHeader>
                        <CardTitle>Teams</CardTitle>
                    </CardHeader>
                    <CardContent className="fb-stack">
                        {teams.map((team) => (
                            <TeamEditor key={team.id} team={team} plans={plans} />
                        ))}
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Users</CardTitle>
                    </CardHeader>
                    <CardContent>
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
        <form onSubmit={submit} className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_220px_220px_220px_auto] lg:items-end">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="truncate font-semibold text-[var(--fg)]">{team.name}</div>
                        <Badge>{team.planName ?? 'custom'}</Badge>
                    </div>
                    <div className="mt-1 text-[11px] fb-dim">
                        {team.owner?.email} · {team.mediaFilesCount} media · {team.apiTokensCount} keys · {team.logEntriesCount} logs
                    </div>
                    <div className="mt-3">
                        <div className="mb-1 flex justify-between text-[11px] fb-dim">
                            <span>{team.storageUsed}</span>
                            <span>{team.storagePercent}% of {team.storageLimit}</span>
                        </div>
                        <Progress value={team.storagePercent} />
                    </div>
                </div>

                <label className="fb-label">
                    Limit GB
                    <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        className="fb-input mt-1"
                        value={form.data.storage_limit_gb}
                        onChange={(event) => form.setData('storage_limit_gb', event.target.value)}
                    />
                </label>

                <label className="fb-label">
                    Plan
                    <select
                        className="fb-input mt-1"
                        value={form.data.plan_id}
                        onChange={(event) => form.setData('plan_id', event.target.value)}
                    >
                        <option value="">Custom</option>
                        {plans.map((plan) => (
                            <option key={plan.id} value={plan.id}>{plan.name} ({plan.included})</option>
                        ))}
                    </select>
                </label>

                <label className="fb-label">
                    Billing status
                    <input
                        className="fb-input mt-1"
                        value={form.data.billing_status}
                        onChange={(event) => form.setData('billing_status', event.target.value)}
                    />
                </label>

                <Button type="submit" disabled={form.processing}>
                    <Save className="h-4 w-4" />
                    Save
                </Button>
            </div>

            <label className="fb-label mt-4 block">
                Public base URL override
                <input
                    className="fb-input mt-1"
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
        <form onSubmit={submit} className="grid gap-3 border-b border-[var(--border)] py-4 last:border-b-0 md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="font-medium text-[var(--fg)]">{user.name}</div>
                    {user.isAdmin && <Badge variant="green">admin</Badge>}
                </div>
                <div className="mt-1 text-[11px] fb-dim">{user.email} · {user.teamsCount} teams · created {user.createdAt}</div>
            </div>
            <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-[12px] fb-muted">
                    <input
                        type="checkbox"
                        checked={Boolean(form.data.is_admin)}
                        onChange={(event) => form.setData('is_admin', event.target.checked)}
                        className="rounded border-[var(--border)] text-[var(--accent)]"
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
