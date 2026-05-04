import { EmptyState, Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Bell, Play, Plus, Trash2, Webhook } from 'lucide-react';
import { useState } from 'react';

const LEVELS = ['all', 'debug', 'info', 'warn', 'error', 'fatal'];
const OPERATORS = [
    ['contains', 'contains'],
    ['exact', '='],
    ['ne', '!='],
    ['gt', '>'],
    ['gte', '>='],
    ['lt', '<'],
    ['lte', '<='],
    ['exists', 'exists'],
    ['missing', 'missing'],
];

export default function AlertsIndex({ auth, team, rules, webhooks }) {
    const { flash } = usePage().props;
    const [conditions, setConditions] = useState([{ key: 'action', operator: 'exact', value: 'exploit_detected' }]);
    const form = useForm({
        name: 'Exploit detected',
        log_webhook_endpoint_id: webhooks[0]?.id || '',
        q: '',
        qMode: 'all',
        level: 'all',
        resource: '',
        threshold_count: 1,
        window_minutes: 5,
        cooldown_minutes: 10,
        enabled: true,
        message_template: 'FiveBucket matched {count} logs for {name} in the last {window} minutes.',
    });

    const submit = (event) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            filters: alertFilters(data, conditions),
        })).post(route('alerts.store'), {
            preserveScroll: true,
        });
    };

    const toggleRule = (rule) => {
        router.patch(route('alerts.update', rule.id), {
            name: rule.name,
            log_webhook_endpoint_id: rule.webhook?.id,
            filters: rule.filters,
            threshold_count: rule.thresholdCount,
            window_minutes: rule.windowMinutes,
            cooldown_minutes: rule.cooldownMinutes,
            enabled: !rule.enabled,
            message_template: rule.messageTemplate || '',
        }, { preserveScroll: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Alerts" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Log Alerts"
                    description="Trigger Discord notifications from ClickHouse-backed log filters, metadata conditions and thresholds."
                    actions={(
                        <Button asChild variant="secondary" size="sm">
                            <Link href={route('webhooks.index')}>
                                <Webhook className="h-3.5 w-3.5" />
                                Webhooks
                            </Link>
                        </Button>
                    )}
                />

                {flash.success && <div className="fb-alert success">{flash.success}</div>}
                {flash.error && <div className="fb-alert danger">{flash.error}</div>}

                <form onSubmit={submit} className="fb-alert-builder fb-panel">
                    <div className="fb-panel-header">
                        <div>
                            <h3 className="fb-panel-title">New alert rule</h3>
                            <p className="fb-panel-subtitle">Examples: level error over threshold, action exploit_detected, or a message pattern.</p>
                        </div>
                        <Bell className="h-4 w-4 fb-dim" />
                    </div>

                    <div className="fb-alert-grid">
                        <Field label="Name" error={form.errors.name}>
                            <input className="fb-input" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} />
                        </Field>
                        <Field label="Discord endpoint" error={form.errors.log_webhook_endpoint_id}>
                            <select className="fb-select" value={form.data.log_webhook_endpoint_id} onChange={(event) => form.setData('log_webhook_endpoint_id', event.target.value)}>
                                <option value="">Select endpoint</option>
                                {webhooks.map((webhook) => <option key={webhook.id} value={webhook.id}>{webhook.name}</option>)}
                            </select>
                        </Field>
                        <Field label="Level">
                            <select className="fb-select" value={form.data.level} onChange={(event) => form.setData('level', event.target.value)}>
                                {LEVELS.map((level) => <option key={level} value={level}>{level}</option>)}
                            </select>
                        </Field>
                        <Field label="Resource">
                            <input className="fb-input" value={form.data.resource} onChange={(event) => form.setData('resource', event.target.value)} placeholder="nw_illegal" />
                        </Field>
                        <Field label="Search pattern">
                            <input className="fb-input" value={form.data.q} onChange={(event) => form.setData('q', event.target.value)} placeholder="timeout, exploit, traceback" />
                        </Field>
                        <Field label="Search scope">
                            <select className="fb-select" value={form.data.qMode} onChange={(event) => form.setData('qMode', event.target.value)}>
                                <option value="all">all fields</option>
                                <option value="message">message</option>
                                <option value="resource">resource</option>
                                <option value="metadata">metadata</option>
                            </select>
                        </Field>
                        <Field label="Threshold">
                            <input className="fb-input" type="number" min="1" value={form.data.threshold_count} onChange={(event) => form.setData('threshold_count', event.target.value)} />
                        </Field>
                        <Field label="Window minutes">
                            <input className="fb-input" type="number" min="1" value={form.data.window_minutes} onChange={(event) => form.setData('window_minutes', event.target.value)} />
                        </Field>
                        <Field label="Cooldown minutes">
                            <input className="fb-input" type="number" min="0" value={form.data.cooldown_minutes} onChange={(event) => form.setData('cooldown_minutes', event.target.value)} />
                        </Field>
                    </div>

                    <div className="fb-alert-conditions">
                        <div className="fb-query-builder-head">
                            <div>
                                <strong>Metadata conditions</strong>
                                <span>All conditions are combined with AND.</span>
                            </div>
                            <button type="button" className="fb-button sm" onClick={() => setConditions([...conditions, { key: '', operator: 'contains', value: '' }])}>
                                <Plus className="h-3.5 w-3.5" />
                                Condition
                            </button>
                        </div>
                        {conditions.map((condition, index) => (
                            <div key={index} className="fb-query-row">
                                <input value={condition.key} placeholder="charId, action, cash" onChange={(event) => updateCondition(setConditions, index, 'key', event.target.value)} />
                                <select value={condition.operator} onChange={(event) => updateCondition(setConditions, index, 'operator', event.target.value)}>
                                    {OPERATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                </select>
                                <input value={condition.value} placeholder="value" disabled={['exists', 'missing'].includes(condition.operator)} onChange={(event) => updateCondition(setConditions, index, 'value', event.target.value)} />
                                <button type="button" className="fb-icon-btn danger" onClick={() => setConditions(conditions.filter((_, itemIndex) => itemIndex !== index))}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>

                    <Field label="Discord message template">
                        <textarea className="fb-textarea" value={form.data.message_template} onChange={(event) => form.setData('message_template', event.target.value)} />
                    </Field>

                    <label className="fb-check-row">
                        <input type="checkbox" checked={form.data.enabled} onChange={(event) => form.setData('enabled', event.target.checked)} />
                        Enabled
                    </label>

                    <div className="fb-panel-actions">
                        <Button type="submit" disabled={form.processing || webhooks.length === 0}>
                            <Bell className="h-4 w-4" />
                            Create alert
                        </Button>
                    </div>
                </form>

                <div className="fb-simple-table">
                    {rules.length === 0 ? (
                        <EmptyState>No alert rules yet. Create a Discord endpoint, then define your first rule.</EmptyState>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Name</th>
                                    <th>Filter</th>
                                    <th>Threshold</th>
                                    <th>Webhook</th>
                                    <th>Last run</th>
                                    <th>Status</th>
                                    <th style={{ width: 128 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {rules.map((rule) => (
                                    <tr key={rule.id}>
                                        <td>
                                            <div className="font-semibold text-[var(--fg)]">{rule.name}</div>
                                            <div className="fb-mono text-[10px] fb-dim">id {rule.id}</div>
                                        </td>
                                        <td><code className="fb-inline-code">{filterSummary(rule.filters)}</code></td>
                                        <td className="fb-mono">{rule.thresholdCount} / {rule.windowMinutes}m</td>
                                        <td>{rule.webhook ? rule.webhook.name : <Badge variant="amber">missing</Badge>}</td>
                                        <td className="fb-mono">{rule.lastCheckedAt || 'never'} · count {rule.lastCount}</td>
                                        <td><Badge variant={rule.enabled ? 'green' : 'amber'}>{rule.enabled ? 'enabled' : 'disabled'}</Badge></td>
                                        <td>
                                            <div className="fb-key-actions">
                                                <button type="button" className="fb-icon-btn" onClick={() => router.post(route('alerts.run', rule.id), {}, { preserveScroll: true })} title="Run now">
                                                    <Play className="h-4 w-4" />
                                                </button>
                                                <button type="button" className="fb-icon-btn" onClick={() => toggleRule(rule)} title={rule.enabled ? 'Disable' : 'Enable'}>
                                                    <Bell className="h-4 w-4" />
                                                </button>
                                                <Link href={route('alerts.destroy', rule.id)} method="delete" as="button" preserveScroll className="fb-icon-btn danger" title="Delete">
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

function updateCondition(setConditions, index, key, value) {
    setConditions((current) => current.map((condition, itemIndex) => itemIndex === index ? { ...condition, [key]: value } : condition));
}

function alertFilters(data, conditions) {
    const filters = {
        q: data.q || undefined,
        qMode: data.qMode !== 'all' ? data.qMode : undefined,
        level: data.level && data.level !== 'all' ? data.level : 'all',
        resource: data.resource || undefined,
        metadataFilters: conditions.filter((condition) => condition.key),
        sort: 'newest',
    };

    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)));
}

function filterSummary(filters = {}) {
    const parts = [];
    if (filters.level && filters.level !== 'all') parts.push(`level:${filters.level}`);
    if (filters.q) parts.push(`q:${filters.q}`);
    if (filters.resource) parts.push(`resource:${filters.resource}`);
    (filters.metadataFilters || []).forEach((condition) => parts.push(`${condition.key} ${condition.operator} ${condition.value || ''}`));

    return parts.join(' AND ') || 'all logs';
}
