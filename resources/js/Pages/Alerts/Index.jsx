import { EmptyState, Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { Bell, CheckCircle2, Eye, Filter, Play, Plus, Trash2, Webhook, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

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
const ALERT_DRAFT_STORAGE = 'fivebucket.alertDraftFromLog';

export default function AlertsIndex({ auth, team, rules, webhooks }) {
    const { flash } = usePage().props;
    const [sourceLog, setSourceLog] = useState(null);
    const [conditions, setConditions] = useState([]);
    const [preview, setPreview] = useState({ loading: false, error: '', count: 0, threshold: 1, willTrigger: false, samples: [] });
    const form = useForm({
        name: 'New alert',
        log_webhook_endpoint_id: webhooks[0]?.id ? String(webhooks[0].id) : '',
        trigger_mode: 'threshold',
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

    useEffect(() => {
        const raw = window.localStorage?.getItem(ALERT_DRAFT_STORAGE);
        if (!raw) return;

        try {
            const log = normalizeSourceLog(JSON.parse(raw));
            const seed = buildSeedFromLog(log);

            setSourceLog(log);
            setConditions(seed.conditions);
            Object.entries(seed.form).forEach(([key, value]) => form.setData(key, value));
        } catch {
            setSourceLog(null);
        } finally {
            window.localStorage?.removeItem(ALERT_DRAFT_STORAGE);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const metadataFields = useMemo(() => flattenMetadata(sourceLog?.metadata || {}).slice(0, 80), [sourceLog]);
    const templateTokens = useMemo(() => templatePlaceholders(sourceLog, metadataFields), [sourceLog, metadataFields]);
    const activeFilters = useMemo(() => alertFilters(form.data, conditions), [form.data, conditions]);
    const filterText = useMemo(() => filterSummary(activeFilters), [activeFilters]);
    const sampleMatch = sourceLog ? matchesAlertLog(sourceLog, activeFilters) : null;
    const previewSignature = JSON.stringify({
        filters: activeFilters,
        name: form.data.name,
        trigger_mode: form.data.trigger_mode,
        message_template: form.data.message_template,
        sample: sourceLog,
        threshold_count: Number(form.data.threshold_count) || 1,
        window_minutes: Number(form.data.window_minutes) || 1,
    });

    useEffect(() => {
        let cancelled = false;
        const payload = JSON.parse(previewSignature);

        const timer = window.setTimeout(async () => {
            setPreview((current) => ({ ...current, loading: true, error: '' }));

            try {
                const response = await window.axios.post(route('alerts.preview'), payload);
                if (!cancelled) {
                    setPreview({ loading: false, error: '', ...response.data });
                }
            } catch {
                if (!cancelled) {
                    setPreview((current) => ({ ...current, loading: false, error: 'Preview unavailable.' }));
                }
            }
        }, 250);

        return () => {
            cancelled = true;
            window.clearTimeout(timer);
        };
    }, [previewSignature]);

    const submit = (event) => {
        event.preventDefault();
        form.transform((data) => ({
            ...data,
            filters: alertFilters(data, conditions),
        }));
        form.post(route('alerts.store'), {
            preserveScroll: true,
        });
    };

    const toggleRule = (rule) => {
        router.patch(route('alerts.update', rule.id), {
            name: rule.name,
            log_webhook_endpoint_id: rule.webhook?.id,
            trigger_mode: rule.triggerMode || 'threshold',
            filters: rule.filters,
            threshold_count: rule.thresholdCount,
            window_minutes: rule.windowMinutes,
            cooldown_minutes: rule.cooldownMinutes,
            enabled: !rule.enabled,
            message_template: rule.messageTemplate || '',
        }, { preserveScroll: true });
    };

    const applyCoreField = (field) => {
        if (!sourceLog) return;

        if (field === 'level') form.setData('level', safeLevel(sourceLog.level));
        if (field === 'resource') form.setData('resource', sourceLog.resource || '');
        if (field === 'message') {
            form.setData('q', sourceLog.message || '');
            form.setData('qMode', 'message');
        }
    };

    const upsertMetadataCondition = (path, value) => {
        const next = conditionFromMetadata(path, value);
        setConditions((current) => {
            const exists = current.findIndex((condition) => condition.key === path);
            if (exists === -1) return [...current, next];

            return current.map((condition, index) => (index === exists ? next : condition));
        });
    };

    const removeCondition = (index) => {
        setConditions((current) => current.filter((_, itemIndex) => itemIndex !== index));
    };

    const resetFromSource = () => {
        if (!sourceLog) return;

        const seed = buildSeedFromLog(sourceLog);
        setConditions(seed.conditions);
        Object.entries(seed.form).forEach(([key, value]) => form.setData(key, value));
    };

    const clearSource = () => {
        setSourceLog(null);
        setConditions([]);
        form.setData('name', 'New alert');
        form.setData('level', 'all');
        form.setData('resource', '');
        form.setData('q', '');
        form.setData('qMode', 'all');
        form.setData('trigger_mode', 'threshold');
        form.setData('message_template', 'FiveBucket matched {count} logs for {name} in the last {window} minutes.');
    };

    const insertTemplateToken = (token) => {
        form.setData('message_template', appendTemplateToken(form.data.message_template, token));
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Alerts" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Log Alerts"
                    description="Create Discord alerts from a real log sample, select the fields that must match, then preview the trigger before saving."
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
                            <h3 className="fb-panel-title">Create alert</h3>
                            <p className="fb-panel-subtitle">Start from a selected log or build a manual rule. Every condition below is combined with AND.</p>
                        </div>
                        <Bell className="h-4 w-4 fb-dim" />
                    </div>

                    {webhooks.length === 0 && (
                        <div className="fb-alert warning mx-[14px] mt-[14px]">
                            Create a Discord webhook endpoint before saving alert rules.
                        </div>
                    )}

                    {form.hasErrors && (
                        <div className="fb-alert danger mx-[14px] mt-[14px]">
                            Alert not saved. Check the highlighted fields and try again.
                        </div>
                    )}

                    <div className="fb-alert-workbench">
                        <section className="fb-alert-source">
                            <div className="fb-alert-section-head">
                                <div>
                                    <strong>Source log</strong>
                                    <span>{sourceLog ? 'Click the fields that should trigger this alert.' : 'Open Logs, select a row, then create an alert from it.'}</span>
                                </div>
                                {sourceLog ? (
                                    <button type="button" className="fb-icon-btn" onClick={clearSource} title="Clear source log">
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                ) : (
                                    <Button asChild variant="secondary" size="sm">
                                        <Link href={route('logs.index')}>
                                            <Eye className="h-3.5 w-3.5" />
                                            Pick log
                                        </Link>
                                    </Button>
                                )}
                            </div>

                            {sourceLog ? (
                                <>
                                    <div className="fb-alert-source-card">
                                        <div className="fb-alert-source-row">
                                            <LevelBadge level={sourceLog.level} />
                                            <code>{sourceLog.resource || 'server'}</code>
                                            <span>{formatDate(sourceLog.occurredAtIso)}</span>
                                        </div>
                                        <p>{sourceLog.message || '(empty message)'}</p>
                                        <code>{sourceLog.id}</code>
                                    </div>

                                    <div className="fb-alert-field-group">
                                        <span>Core fields</span>
                                        <div className="fb-alert-field-grid core">
                                            <FieldButton active={safeLevel(sourceLog.level) === form.data.level} label="level" value={safeLevel(sourceLog.level)} onClick={() => applyCoreField('level')} />
                                            <FieldButton active={Boolean(sourceLog.resource && form.data.resource === sourceLog.resource)} label="resource" value={sourceLog.resource || 'server'} onClick={() => applyCoreField('resource')} />
                                            <FieldButton active={form.data.qMode === 'message' && form.data.q === sourceLog.message} label="message contains" value={sourceLog.message || '(empty)'} onClick={() => applyCoreField('message')} />
                                        </div>
                                    </div>

                                    <div className="fb-alert-field-group">
                                        <span>Metadata fields</span>
                                        {metadataFields.length === 0 ? (
                                            <div className="fb-query-empty">No scalar metadata fields in this payload.</div>
                                        ) : (
                                            <div className="fb-alert-field-grid">
                                                {metadataFields.map((field) => (
                                                    <FieldButton
                                                        key={field.path}
                                                        active={conditions.some((condition) => condition.key === field.path)}
                                                        label={field.path}
                                                        value={formatValue(field.value)}
                                                        onClick={() => upsertMetadataCondition(field.path, field.value)}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            ) : (
                                <div className="fb-alert-empty-source">
                                    <Bell className="h-5 w-5 fb-dim" />
                                    <p>Manual mode is available, but the fastest workflow is selecting a real log and generating the alert from that payload.</p>
                                </div>
                            )}
                        </section>

                        <section className="fb-alert-config">
                            <div className="fb-alert-mode">
                                <button type="button" className={form.data.trigger_mode === 'per_log' ? 'active' : ''} onClick={() => form.setData('trigger_mode', 'per_log')}>
                                    <strong>Every matching log</strong>
                                    <span>Send one Discord message for each new log that matches. Best for admin commands and audit trails.</span>
                                </button>
                                <button type="button" className={form.data.trigger_mode === 'threshold' ? 'active' : ''} onClick={() => form.setData('trigger_mode', 'threshold')}>
                                    <strong>Threshold window</strong>
                                    <span>Send one alert when the count reaches a threshold inside a time window.</span>
                                </button>
                            </div>

                            <div className="fb-alert-grid compact">
                                <Field label="Name" error={form.errors.name}>
                                    <input className="fb-input" value={form.data.name} onChange={(event) => form.setData('name', event.target.value)} maxLength="100" />
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
                                    <input className="fb-input" value={form.data.q} onChange={(event) => form.setData('q', event.target.value)} placeholder="rope_completed, exploit, timeout" />
                                </Field>
                                <Field label="Search scope">
                                    <select className="fb-select" value={form.data.qMode} onChange={(event) => form.setData('qMode', event.target.value)}>
                                        <option value="all">all fields</option>
                                        <option value="message">message</option>
                                        <option value="resource">resource</option>
                                        <option value="metadata">metadata</option>
                                    </select>
                                </Field>
                            </div>

                            <div className="fb-alert-conditions">
                                <div className="fb-query-builder-head">
                                    <div>
                                        <strong>Fields to verify</strong>
                                        <span>Use metadata paths like charId, action or atmCoords.x.</span>
                                    </div>
                                    <button type="button" className="fb-button sm" onClick={() => setConditions([...conditions, emptyCondition()])}>
                                        <Plus className="h-3.5 w-3.5" />
                                        Add field
                                    </button>
                                </div>

                                <datalist id="alert-metadata-fields">
                                    {metadataFields.map((field) => <option key={field.path} value={field.path} />)}
                                </datalist>

                                {conditions.length === 0 ? (
                                    <div className="fb-query-empty">
                                        <button type="button" onClick={() => setConditions([emptyCondition()])}>Add first metadata condition</button>
                                    </div>
                                ) : (
                                    <div className="fb-query-rows">
                                        {conditions.map((condition, index) => (
                                            <div key={`${condition.key}-${index}`} className="fb-query-row">
                                                <input list="alert-metadata-fields" value={condition.key} placeholder="charId, action, cash" onChange={(event) => updateCondition(setConditions, index, 'key', event.target.value)} />
                                                <select value={condition.operator} onChange={(event) => updateCondition(setConditions, index, 'operator', event.target.value)}>
                                                    {OPERATORS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                                </select>
                                                <input value={condition.value} placeholder="value" disabled={['exists', 'missing'].includes(condition.operator)} onChange={(event) => updateCondition(setConditions, index, 'value', event.target.value)} />
                                                <button type="button" className="fb-icon-btn danger" onClick={() => removeCondition(index)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {form.data.trigger_mode === 'threshold' ? (
                                <div className="fb-alert-grid compact policy">
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
                            ) : (
                                <div className="fb-alert-mode-note">
                                    Per-log mode ignores threshold, window and cooldown. Every newly ingested matching log sends its own Discord message.
                                </div>
                            )}

                            <Field label="Discord message template" error={form.errors.message_template}>
                                <textarea className="fb-textarea" value={form.data.message_template} onChange={(event) => form.setData('message_template', event.target.value)} />
                            </Field>
                            <div className="fb-template-tools">
                                <div>
                                    <strong>Insert variables</strong>
                                    <span>Use metadata directly with {'{charId}'} or explicitly with {'{metadata.charId}'}.</span>
                                </div>
                                <div className="fb-template-token-list">
                                    {templateTokens.map((token) => (
                                        <button key={token} type="button" onClick={() => insertTemplateToken(token)}>
                                            {'{'}{token}{'}'}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </section>
                    </div>

                    <div className="fb-alert-preview">
                        <div className="fb-alert-section-head">
                            <div>
                                <strong>Preview</strong>
                                <span>{filterText}</span>
                            </div>
                            {sourceLog && (
                                <Badge variant={sampleMatch ? 'green' : 'red'}>{sampleMatch ? 'source log matches' : 'source log does not match'}</Badge>
                            )}
                        </div>

                        <div className="fb-alert-preview-grid">
                            <PreviewMetric label={form.data.trigger_mode === 'per_log' ? 'Matched now' : 'Matched in window'} value={preview.loading ? '...' : String(preview.count ?? 0)} />
                            <PreviewMetric label={form.data.trigger_mode === 'per_log' ? 'Mode' : 'Threshold'} value={form.data.trigger_mode === 'per_log' ? 'per log' : `${preview.threshold ?? form.data.threshold_count} logs`} />
                            <PreviewMetric label={form.data.trigger_mode === 'per_log' ? 'Selected log' : 'Would trigger'} value={form.data.trigger_mode === 'per_log' ? (sampleMatch ? 'will send' : 'no match') : (preview.willTrigger ? 'yes' : 'no')} state={(form.data.trigger_mode === 'per_log' ? sampleMatch : preview.willTrigger) ? 'ok' : 'idle'} />
                        </div>

                        {preview.error && <div className="fb-alert warning">{preview.error}</div>}

                        {preview.renderedMessage && (
                            <div className="fb-template-preview">
                                <span>Discord message</span>
                                <p>{preview.renderedMessage}</p>
                            </div>
                        )}

                        {preview.samples?.length > 0 && (
                            <div className="fb-alert-samples">
                                {preview.samples.map((sample) => (
                                    <div key={sample.id} className="fb-alert-sample">
                                        <LevelBadge level={sample.level} />
                                        <code>{sample.resource || 'server'}</code>
                                        <span>{sample.message}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="fb-panel-actions">
                        <label className="fb-check-row">
                            <input type="checkbox" checked={form.data.enabled} onChange={(event) => form.setData('enabled', event.target.checked)} />
                            Enabled
                        </label>
                        {sourceLog && (
                            <button type="button" className="fb-button sm" onClick={resetFromSource}>
                                <Filter className="h-3.5 w-3.5" />
                                Reset from log
                            </button>
                        )}
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
                                    <th>Mode</th>
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
                                        <td><Badge variant={rule.triggerMode === 'per_log' ? 'green' : 'default'}>{rule.triggerMode === 'per_log' ? 'per log' : 'threshold'}</Badge></td>
                                        <td><code className="fb-inline-code">{filterSummary(rule.filters)}</code></td>
                                        <td className="fb-mono">{rule.triggerMode === 'per_log' ? 'each match' : `${rule.thresholdCount} / ${rule.windowMinutes}m`}</td>
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

function FieldButton({ active, label, value, onClick }) {
    return (
        <button type="button" className={`fb-alert-field${active ? ' active' : ''}`} onClick={onClick}>
            <span>{label}</span>
            <code>{value}</code>
            {active && <CheckCircle2 className="h-3.5 w-3.5" />}
        </button>
    );
}

function PreviewMetric({ label, value, state = 'idle' }) {
    return (
        <div className={`fb-alert-metric ${state}`}>
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function LevelBadge({ level }) {
    const safe = safeLevel(level);

    return <span className={`fb-lvl-pill ${safe}`}>{safe}</span>;
}

function updateCondition(setConditions, index, key, value) {
    setConditions((current) => current.map((condition, itemIndex) => itemIndex === index ? { ...condition, [key]: value } : condition));
}

function emptyCondition() {
    return { key: '', operator: 'contains', value: '' };
}

function alertFilters(data, conditions) {
    const filters = {
        q: data.q || undefined,
        qMode: data.qMode !== 'all' ? data.qMode : undefined,
        level: data.level && data.level !== 'all' ? data.level : 'all',
        resource: data.resource || undefined,
        metadataFilters: conditions
            .map((condition) => ({
                key: String(condition.key || '').trim(),
                operator: normalizeOperator(condition.operator),
                value: ['exists', 'missing'].includes(condition.operator) ? '' : String(condition.value ?? ''),
            }))
            .filter((condition) => condition.key),
        sort: 'newest',
    };

    return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== undefined && value !== '' && !(Array.isArray(value) && value.length === 0)));
}

function filterSummary(filters = {}) {
    const parts = [];
    if (filters.level && filters.level !== 'all') parts.push(`level:${filters.level}`);
    if (filters.resource) parts.push(`resource:${filters.resource}`);
    if (filters.q) parts.push(`${filters.qMode || 'all'} contains "${truncate(filters.q, 40)}"`);
    (filters.metadataFilters || []).forEach((condition) => parts.push(`${condition.key} ${operatorLabel(condition.operator)} ${condition.value || ''}`.trim()));

    return parts.join(' AND ') || 'all logs';
}

function buildSeedFromLog(log) {
    const metadata = log.metadata || {};
    const conditions = [];
    ['action', 'charId', 'source', 'dataset'].forEach((path) => {
        const value = metadataPath(metadata, path);
        if (isScalar(value)) conditions.push(conditionFromMetadata(path, value));
    });

    const action = metadataPath(metadata, 'action');
    const label = action || log.message || log.resource || 'log';

    return {
        form: {
            name: truncate(`Alert: ${label}`, 100),
            trigger_mode: 'per_log',
            level: safeLevel(log.level),
            resource: log.resource || '',
            q: '',
            qMode: 'all',
            threshold_count: 1,
            window_minutes: 5,
            cooldown_minutes: 10,
            message_template: templateFromLog(log),
        },
        conditions,
    };
}

function normalizeSourceLog(log) {
    return {
        id: String(log?.id || ''),
        level: safeLevel(log?.level),
        occurredAtIso: log?.occurredAtIso || log?.timestamp || log?.occurred_at || null,
        resource: log?.resource || '',
        message: log?.message || '',
        metadata: log?.metadata && typeof log.metadata === 'object' ? log.metadata : {},
    };
}

function conditionFromMetadata(path, value) {
    return {
        key: path,
        operator: isScalar(value) ? 'exact' : 'exists',
        value: isScalar(value) ? String(value) : '',
    };
}

function flattenMetadata(value, prefix = '') {
    if (!value || typeof value !== 'object') return [];

    return Object.entries(value).flatMap(([key, item]) => {
        const path = prefix ? `${prefix}.${key}` : key;

        if (isScalar(item)) {
            return [{ path, value: item }];
        }

        if (item && typeof item === 'object') {
            return flattenMetadata(item, path);
        }

        return [];
    });
}

function templateFromLog(log) {
    const metadata = log.metadata || {};
    const parts = ['{message}', 'resource={resource}'];

    ['action', 'charId', 'cash', 'source'].forEach((path) => {
        if (metadataPath(metadata, path) !== undefined) {
            parts.push(`${path}={${path}}`);
        }
    });

    return `FiveBucket alert: ${parts.join(' · ')} · {count} logs in {window}m.`;
}

function templatePlaceholders(sourceLog, metadataFields) {
    const base = ['name', 'count', 'threshold', 'window', 'level', 'resource', 'message', 'id', 'occurredAtIso'];
    const metadata = metadataFields.flatMap((field) => [field.path, `metadata.${field.path}`]);

    return [...new Set([...base, ...metadata])].slice(0, 36);
}

function appendTemplateToken(template, token) {
    const text = String(template || '').trimEnd();
    const placeholder = `{${token}}`;

    if (text === '') return placeholder;
    if (text.endsWith(':') || text.endsWith('=') || text.endsWith('(')) return `${text}${placeholder}`;

    return `${text} ${placeholder}`;
}

function matchesAlertLog(log, filters) {
    const metadata = log.metadata || {};

    if (filters.level && filters.level !== 'all' && safeLevel(log.level) !== filters.level) return false;
    if (filters.resource && String(log.resource || '') !== String(filters.resource)) return false;

    if (filters.q) {
        const query = String(filters.q).toLowerCase();
        const metadataText = JSON.stringify(metadata).toLowerCase();
        const haystacks = {
            message: String(log.message || '').toLowerCase(),
            resource: String(log.resource || '').toLowerCase(),
            metadata: metadataText,
            all: `${log.message || ''} ${log.resource || ''} ${metadataText}`.toLowerCase(),
        };
        const haystack = haystacks[filters.qMode || 'all'] || haystacks.all;

        if (!haystack.includes(query)) return false;
    }

    return (filters.metadataFilters || []).every((condition) => metadataConditionMatches(metadata, condition));
}

function metadataConditionMatches(metadata, condition) {
    const value = metadataPath(metadata, condition.key);
    const exists = value !== undefined;
    const expected = String(condition.value ?? '');

    if (condition.operator === 'missing') return !exists;
    if (!exists) return false;
    if (condition.operator === 'exists' || expected === '') return true;
    if (condition.operator === 'exact') return String(value) === expected;
    if (condition.operator === 'ne') return String(value) !== expected;

    if (['gt', 'gte', 'lt', 'lte'].includes(condition.operator)) {
        const number = Number(value);
        const target = Number(expected);

        if (Number.isNaN(number) || Number.isNaN(target)) return false;
        if (condition.operator === 'gt') return number > target;
        if (condition.operator === 'gte') return number >= target;
        if (condition.operator === 'lt') return number < target;
        if (condition.operator === 'lte') return number <= target;
    }

    return String(value).toLowerCase().includes(expected.toLowerCase());
}

function metadataPath(metadata, path) {
    return String(path || '')
        .split('.')
        .filter(Boolean)
        .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), metadata);
}

function normalizeOperator(value) {
    return ['contains', 'exact', 'exists', 'missing', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(value) ? value : 'contains';
}

function operatorLabel(value) {
    return Object.fromEntries(OPERATORS)[normalizeOperator(value)] || 'contains';
}

function safeLevel(level) {
    const normalized = String(level || 'info').toLowerCase();

    if (normalized === 'warning') return 'warn';
    if (normalized === 'critical') return 'fatal';
    if (LEVELS.includes(normalized) && normalized !== 'all') return normalized;

    return 'info';
}

function isScalar(value) {
    return value === null || ['string', 'number', 'boolean'].includes(typeof value);
}

function formatValue(value) {
    if (value === null) return 'null';
    if (typeof value === 'boolean') return value ? 'true' : 'false';

    return truncate(String(value), 72);
}

function formatDate(value) {
    if (!value) return 'now';
    const date = new Date(value);

    return Number.isNaN(date.getTime()) ? value : date.toISOString().replace('T', ' ').slice(0, 19);
}

function truncate(value, max) {
    const text = String(value || '');

    return text.length > max ? `${text.slice(0, max - 1)}...` : text;
}
