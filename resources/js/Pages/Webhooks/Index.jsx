import { EmptyState, Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Bell, CheckCircle2, PlugZap, Send, Trash2, Webhook } from 'lucide-react';

export default function WebhooksIndex({ auth, team, endpoints }) {
    const { flash } = usePage().props;
    const form = useForm({
        name: 'Discord alerts',
        type: 'discord',
        url: '',
        enabled: true,
    });

    const submit = (event) => {
        event.preventDefault();
        form.post(route('webhooks.store'), {
            preserveScroll: true,
            onSuccess: () => form.reset('url'),
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Webhooks" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Webhooks"
                    description="Configure reusable Discord webhook endpoints and attach them to log alert rules."
                    actions={(
                        <Button asChild variant="secondary" size="sm">
                            <Link href={route('alerts.index')}>
                                <Bell className="h-3.5 w-3.5" />
                                Alert rules
                            </Link>
                        </Button>
                    )}
                />

                {flash.success && <div className="fb-alert success">{flash.success}</div>}
                {flash.error && <div className="fb-alert danger">{flash.error}</div>}

                <div className="fb-grid cols-2">
                    <form onSubmit={submit} className="fb-panel">
                        <div className="fb-panel-header">
                            <div>
                                <h3 className="fb-panel-title">New endpoint</h3>
                                <p className="fb-panel-subtitle">Paste a Discord webhook URL from the channel integration settings.</p>
                            </div>
                            <Webhook className="h-4 w-4 fb-dim" />
                        </div>

                        <div className="fb-form-grid">
                            <Field label="Name" error={form.errors.name}>
                                <input className="fb-input" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                            </Field>
                            <Field label="Discord webhook URL" error={form.errors.url}>
                                <input className="fb-input" value={form.data.url} onChange={(event) => form.setData('url', event.target.value)} placeholder="https://discord.com/api/webhooks/..." />
                            </Field>
                            <label className="fb-check-row">
                                <input type="checkbox" checked={form.data.enabled} onChange={(event) => form.setData('enabled', event.target.checked)} />
                                Enabled
                            </label>
                        </div>

                        <div className="fb-panel-actions">
                            <Button type="submit" disabled={form.processing}>
                                <PlugZap className="h-4 w-4" />
                                Create endpoint
                            </Button>
                        </div>
                    </form>

                    <div className="fb-panel">
                        <div className="fb-panel-header">
                            <div>
                                <h3 className="fb-panel-title">Routing model</h3>
                                <p className="fb-panel-subtitle">Create endpoints once, then select the right endpoint from each alert rule.</p>
                            </div>
                            <CheckCircle2 className="h-4 w-4 fb-dim" />
                        </div>
                        <div className="fb-webhook-help">
                            <span><Badge>Discord</Badge> supported now</span>
                            <span><Badge variant="green">Reusable</Badge> one endpoint can be used by multiple rules</span>
                            <span><Badge variant="amber">Private</Badge> webhook URLs are encrypted at rest</span>
                        </div>
                    </div>
                </div>

                <div className="fb-simple-table">
                    {endpoints.length === 0 ? (
                        <EmptyState>No webhook endpoints configured yet.</EmptyState>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Endpoint</th>
                                    <th>Status</th>
                                    <th>Alerts</th>
                                    <th>Last send</th>
                                    <th>Failures</th>
                                    <th style={{ width: 140 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {endpoints.map((endpoint) => (
                                    <tr key={endpoint.id}>
                                        <td>
                                            <div className="font-semibold text-[var(--fg)]">{endpoint.name}</div>
                                            <div className="fb-mono text-[10px] fb-dim">{endpoint.type}</div>
                                        </td>
                                        <td><code className="fb-inline-code">{endpoint.maskedUrl}</code></td>
                                        <td><Badge variant={endpoint.enabled ? 'green' : 'amber'}>{endpoint.enabled ? 'enabled' : 'disabled'}</Badge></td>
                                        <td className="fb-mono">{endpoint.alertRulesCount}</td>
                                        <td className="fb-mono">{endpoint.lastUsedAt || 'never'} {endpoint.lastStatusCode ? `· ${endpoint.lastStatusCode}` : ''}</td>
                                        <td>
                                            <span className="fb-mono">{endpoint.failureCount}</span>
                                            {endpoint.lastError && <div className="fb-error-text">{endpoint.lastError}</div>}
                                        </td>
                                        <td>
                                            <div className="fb-key-actions">
                                                <button type="button" className="fb-icon-btn" title="Send test" onClick={() => router.post(route('webhooks.test', endpoint.id), {}, { preserveScroll: true })}>
                                                    <Send className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    className="fb-icon-btn"
                                                    title={endpoint.enabled ? 'Disable' : 'Enable'}
                                                    onClick={() => router.patch(route('webhooks.update', endpoint.id), {
                                                        name: endpoint.name,
                                                        type: endpoint.type,
                                                        url: '',
                                                        enabled: !endpoint.enabled,
                                                    }, { preserveScroll: true })}
                                                >
                                                    <CheckCircle2 className="h-4 w-4" />
                                                </button>
                                                <Link href={route('webhooks.destroy', endpoint.id)} method="delete" as="button" preserveScroll className="fb-icon-btn danger" title="Delete">
                                                    <Trash2 className="h-4 w-4" />
                                                </Link>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </AuthenticatedLayout>
    );
}
