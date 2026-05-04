import { EmptyState, Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { AlertTriangle, CheckCircle2, Clock3, Play, RadioTower, RefreshCw, Server, ShieldAlert, TerminalSquare, XCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

export default function ActionsIndex({ auth, team, sessions, executions }) {
    const { flash } = usePage().props;
    const actions = useMemo(() => sessions.flatMap((session) => session.actions.map((action) => ({ ...action, session }))), [sessions]);
    const [selectedKey, setSelectedKey] = useState(actions[0] ? actionSelector(actions[0]) : '');
    const selected = actions.find((action) => actionSelector(action) === selectedKey) || actions[0] || null;
    const form = useForm({
        sdk_session_id: selected?.session.id || '',
        action_key: selected?.key || '',
        params: {},
        confirm: false,
    });

    useEffect(() => {
        const next = actions.find((action) => actionSelector(action) === selectedKey) || actions[0] || null;

        if (!next) {
            form.setData({
                sdk_session_id: '',
                action_key: '',
                params: {},
                confirm: false,
            });
            return;
        }

        const defaults = {};
        for (const field of next.schema?.fields || []) {
            if (field.default !== undefined && field.default !== null) {
                defaults[field.key] = field.default;
            } else if (field.type === 'boolean') {
                defaults[field.key] = false;
            } else {
                defaults[field.key] = '';
            }
        }

        form.setData({
            sdk_session_id: next.session.id,
            action_key: next.key,
            params: defaults,
            confirm: false,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedKey, actions.length]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            router.reload({ only: ['sessions', 'executions'], preserveState: true, preserveScroll: true });
        }, 5000);

        return () => window.clearInterval(timer);
    }, []);

    const submit = (event) => {
        event.preventDefault();
        form.post(route('actions.store'), { preserveScroll: true });
    };

    const groupedActions = groupBy(actions, (action) => action.category || 'General');

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Remote Actions" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Remote Actions"
                    description="Trigger typed callbacks registered by online SDK resources. FiveBucket never calls your game server directly; the SDK polls for queued work and reports results back."
                    actions={(
                        <>
                            <Badge variant={sessions.length > 0 ? 'green' : 'amber'}>{sessions.length} online SDK sessions</Badge>
                            <Button type="button" variant="secondary" size="sm" onClick={() => router.reload({ preserveScroll: true })}>
                                <RefreshCw className="h-3.5 w-3.5" />
                                Refresh
                            </Button>
                        </>
                    )}
                />

                {flash.success && <div className="fb-alert success mb-3">{flash.success}</div>}
                {flash.error && <div className="fb-alert danger mb-3">{flash.error}</div>}

                <div className="fb-grid fb-actions-layout">
                    <div className="fb-panel">
                        <div className="fb-panel-header">
                            <div>
                                <h3 className="fb-panel-title">Available actions</h3>
                                <p className="fb-panel-subtitle">Only actions declared by online SDK sessions are executable.</p>
                            </div>
                            <RadioTower className="h-4 w-4 fb-dim" />
                        </div>

                        {actions.length === 0 ? (
                            <EmptyState compact>No online SDK action registered yet.</EmptyState>
                        ) : (
                            <div className="fb-actions-list">
                                {Object.entries(groupedActions).map(([category, items]) => (
                                    <div key={category}>
                                        <div className="fb-nav-section-title">{category}</div>
                                        {items.map((action) => (
                                            <button
                                                key={actionSelector(action)}
                                                type="button"
                                                className={`fb-action-item ${actionSelector(action) === selectedKey ? 'active' : ''}`}
                                                onClick={() => setSelectedKey(actionSelector(action))}
                                            >
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate font-semibold">{action.label}</span>
                                                        {action.dangerous && <Badge variant="red">danger</Badge>}
                                                    </div>
                                                    <div className="truncate fb-mono text-[10px] fb-dim">{action.key} · {action.session.resourceName}</div>
                                                </div>
                                                <Server className="h-3.5 w-3.5 fb-dim" />
                                            </button>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <form onSubmit={submit} className="fb-panel">
                        <div className="fb-panel-header">
                            <div>
                                <h3 className="fb-panel-title">{selected?.label || 'No action selected'}</h3>
                                <p className="fb-panel-subtitle">{selected?.description || 'Select an online action to build the execution payload.'}</p>
                            </div>
                            <TerminalSquare className="h-4 w-4 fb-dim" />
                        </div>

                        {selected ? (
                            <>
                                <div className="fb-action-target">
                                    <Badge variant="green">online</Badge>
                                    <span className="fb-mono">{selected.session.resourceName}</span>
                                    <span className="fb-dim">{selected.session.endpoint}</span>
                                    <Badge>{selected.timeoutSeconds}s timeout</Badge>
                                </div>

                                <div className="fb-form-grid">
                                    {(selected.schema?.fields || []).length === 0 ? (
                                        <EmptyState compact>No parameters required.</EmptyState>
                                    ) : (
                                        selected.schema.fields.map((field) => (
                                            <DynamicField
                                                key={field.key}
                                                field={field}
                                                value={form.data.params[field.key]}
                                                error={form.errors[`params.${field.key}`]}
                                                onChange={(value) => form.setData('params', { ...form.data.params, [field.key]: value })}
                                            />
                                        ))
                                    )}

                                    {selected.requiresConfirmation && (
                                        <label className="fb-check-row danger">
                                            <input type="checkbox" checked={form.data.confirm} onChange={(event) => form.setData('confirm', event.target.checked)} />
                                            I confirm this action should run on the selected server.
                                        </label>
                                    )}
                                </div>

                                <div className="fb-panel-actions">
                                    <Button type="submit" disabled={form.processing || (selected.requiresConfirmation && !form.data.confirm)}>
                                        <Play className="h-4 w-4" />
                                        Queue action
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <EmptyState>No action available.</EmptyState>
                        )}
                    </form>
                </div>

                <div className="fb-simple-table">
                    {executions.length === 0 ? (
                        <EmptyState>No remote action execution yet.</EmptyState>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th>Action</th>
                                    <th>Server</th>
                                    <th>Status</th>
                                    <th>Params</th>
                                    <th>Result</th>
                                    <th>Timeline</th>
                                    <th style={{ width: 90 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {executions.map((execution) => (
                                    <tr key={execution.id}>
                                        <td>
                                            <div className="font-semibold text-[var(--fg)]">{execution.actionLabel}</div>
                                            <div className="fb-mono text-[10px] fb-dim">{execution.actionKey}</div>
                                        </td>
                                        <td>
                                            <div className="fb-mono text-[11px]">{execution.server.resourceName || 'sdk'}</div>
                                            <div className="fb-mono text-[10px] fb-dim">{execution.server.endpoint}</div>
                                        </td>
                                        <td><StatusBadge status={execution.status} /></td>
                                        <td><code className="fb-inline-code fb-json-mini">{JSON.stringify(maskSecrets(execution.params))}</code></td>
                                        <td>
                                            {execution.error ? (
                                                <div className="fb-error-text">{execution.error}</div>
                                            ) : (
                                                <code className="fb-inline-code fb-json-mini">{JSON.stringify(execution.result || {})}</code>
                                            )}
                                        </td>
                                        <td className="fb-mono text-[10px] fb-dim">
                                            requested {execution.requestedAt || 'now'}
                                            {execution.deliveredAt && <><br />delivered {execution.deliveredAt}</>}
                                            {execution.completedAt && <><br />completed {execution.completedAt}</>}
                                        </td>
                                        <td>
                                            {['queued', 'delivered'].includes(execution.status) && (
                                                <Link href={route('actions.cancel', execution.id)} method="delete" as="button" preserveScroll className="fb-icon-btn danger" title="Cancel">
                                                    <XCircle className="h-4 w-4" />
                                                </Link>
                                            )}
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

function DynamicField({ field, value, error, onChange }) {
    const common = {
        className: 'fb-input',
        value: value ?? '',
        onChange: (event) => onChange(event.target.value),
        placeholder: field.placeholder || '',
    };

    if (field.type === 'boolean') {
        return (
            <label className="fb-check-row">
                <input type="checkbox" checked={Boolean(value)} onChange={(event) => onChange(event.target.checked)} />
                {field.label}
                {field.description && <span className="fb-help">{field.description}</span>}
            </label>
        );
    }

    if (field.type === 'select') {
        return (
            <Field label={label(field)} help={field.description} error={error}>
                <select className="fb-input" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
                    <option value="">Select...</option>
                    {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                </select>
            </Field>
        );
    }

    if (field.type === 'json' || field.type === 'object' || field.type === 'text') {
        return (
            <Field label={label(field)} help={field.description} error={error}>
                <textarea className="fb-textarea" value={typeof value === 'string' ? value : JSON.stringify(value || {}, null, 2)} onChange={(event) => onChange(event.target.value)} placeholder={field.placeholder || '{}'} />
            </Field>
        );
    }

    return (
        <Field label={label(field)} help={field.description} error={error}>
            <input
                {...common}
                type={field.type === 'number' || field.type === 'integer' ? 'number' : field.type === 'datetime' ? 'datetime-local' : 'text'}
                min={field.min ?? undefined}
                max={field.max ?? undefined}
            />
        </Field>
    );
}

function StatusBadge({ status }) {
    const Icon = {
        queued: Clock3,
        delivered: RadioTower,
        running: RefreshCw,
        succeeded: CheckCircle2,
        failed: XCircle,
        timeout: AlertTriangle,
        cancelled: ShieldAlert,
    }[status] || Clock3;

    const variant = {
        succeeded: 'green',
        failed: 'red',
        timeout: 'amber',
        cancelled: 'amber',
        running: 'green',
    }[status] || 'default';

    return (
        <Badge variant={variant}>
            <Icon className="mr-1 h-3 w-3" />
            {status}
        </Badge>
    );
}

function actionSelector(action) {
    return `${action.session.id}:${action.key}`;
}

function groupBy(items, resolver) {
    return items.reduce((groups, item) => {
        const key = resolver(item);
        groups[key] = groups[key] || [];
        groups[key].push(item);
        return groups;
    }, {});
}

function label(field) {
    return `${field.label}${field.required ? ' *' : ''}`;
}

function maskSecrets(params) {
    const copy = { ...(params || {}) };

    for (const key of Object.keys(copy)) {
        if (/token|secret|password|key/i.test(key)) {
            copy[key] = '***';
        }
    }

    return copy;
}
