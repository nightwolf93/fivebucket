import { EmptyState, Pagination } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import {
    Activity,
    Calendar,
    Copy,
    Download,
    Filter,
    Folder,
    MoreHorizontal,
    Plus,
    RotateCcw,
    Search,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const FILTER_LEVELS = ['all', ...LEVELS];

export default function LogsIndex({ auth, team, filters, summary, logs }) {
    const [draft, setDraft] = useState(normalizeFilters(filters));
    const [entries, setEntries] = useState(logs.data);
    const [liveSummary, setLiveSummary] = useState(summary);
    const [selectedId, setSelectedId] = useState(null);
    const [tail, setTail] = useState(true);
    const [liveCount, setLiveCount] = useState(0);
    const newIdsRef = useRef(new Set());

    useEffect(() => {
        setDraft(normalizeFilters(filters));
    }, [filters]);

    useEffect(() => {
        setEntries(logs.data);
        setLiveSummary(summary);
        setSelectedId(null);
        setLiveCount(0);
    }, [logs.data, summary]);

    useEffect(() => {
        if (!team?.id || !window.Echo) {
            return undefined;
        }

        const channelName = `teams.${team.id}.logs`;
        const channel = window.Echo.private(channelName);

        channel.listen('.logs.ingested', (event) => {
            const incoming = Array.isArray(event.logs) ? event.logs.filter((log) => matchesFilters(log, filters)) : [];

            if (incoming.length === 0) {
                return;
            }

            incoming.forEach((log) => {
                if (log.id) {
                    newIdsRef.current.add(log.id);
                    window.setTimeout(() => newIdsRef.current.delete(log.id), 1400);
                }
            });

            setLiveSummary((current) => incrementSummary(current, incoming));
            setLiveCount((count) => count + incoming.length);

            if (tail) {
                setEntries((current) => {
                    const seen = new Set(current.map((log) => log.id).filter(Boolean));
                    const unique = incoming.filter((log) => !log.id || !seen.has(log.id));

                    return [...unique, ...current].slice(0, 250);
                });
            }
        });

        return () => window.Echo.leave(channelName);
    }, [filters, tail, team?.id]);

    const counts = useMemo(() => {
        const levels = liveSummary.levels || {};
        const normalized = { all: liveSummary.total || 0 };

        LEVELS.forEach((level) => {
            normalized[level] = levels[level] || 0;
        });

        return normalized;
    }, [liveSummary]);

    const rateBuckets = useMemo(() => normalizeBuckets(liveSummary.rateBuckets), [liveSummary.rateBuckets]);
    const selectedLog = entries.find((log) => log.id === selectedId);
    const visibleEntries = entries.slice(0, 250);

    const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

    const submitFilters = (event) => {
        event.preventDefault();
        router.get(route('logs.index'), { ...draft, page: undefined }, { preserveState: true, replace: true });
    };

    const setLevel = (level) => {
        const next = { ...draft, level };
        setDraft(next);
        router.get(route('logs.index'), { ...next, page: undefined }, { preserveState: true, replace: true });
    };

    const setResourceFilter = (resource) => {
        const next = { ...draft, resource, page: undefined };
        setDraft(next);
        router.get(route('logs.index'), next, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        const next = { q: '', level: 'all', resource: '', from: '', to: '', perPage: 25 };
        setDraft(next);
        router.get(route('logs.index'), next, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Logs" />

            <div className="fb-page fb-logs-page">
                <div className="fb-page-header">
                    <div>
                        <p className="fb-eyebrow">{team.slug}</p>
                        <h1 className="fb-page-title">Logs</h1>
                        <p className="fb-page-subtitle">Search, tail and inspect cloud logs ingested via the Fivemanage-compatible API.</p>
                    </div>
                    <div className="fb-page-actions">
                        <button type="button" className="fb-button sm">
                            <Download className="h-3.5 w-3.5" />
                            Export
                        </button>
                        <Badge>{liveSummary.driver === 'clickhouse' ? 'ClickHouse' : 'Database'} storage</Badge>
                        <Badge variant={liveCount > 0 ? 'green' : 'default'}>{liveCount > 0 ? `+${liveCount} live` : 'Live ready'}</Badge>
                    </div>
                </div>

                <div className="fb-logs-kpis">
                    <LogsKpi
                        label="Total logs"
                        value={formatNumber(liveSummary.total)}
                        foot="all-time entries"
                        dotColor="var(--fg-dim)"
                        spark={rateBuckets.map((bucket) => bucket.total)}
                        sparkColor="var(--fg-dim)"
                    />
                    <LogsKpi
                        label="Logs · 24h"
                        value={formatNumber(liveSummary.last24h)}
                        foot="recent ingest"
                        dotColor="var(--lvl-info)"
                        spark={rateBuckets.map((bucket) => bucket.total)}
                        sparkColor="var(--lvl-info)"
                    />
                    <LogsKpi
                        label="Errors · 24h"
                        value={formatNumber(liveSummary.errors24h)}
                        foot="error and fatal"
                        dotColor="var(--lvl-error)"
                        spark={rateBuckets.map((bucket) => (bucket.error || 0) + (bucket.fatal || 0))}
                        sparkColor="var(--lvl-error)"
                    />
                    <LogsKpi
                        label="Warnings · 24h"
                        value={formatNumber(liveSummary.warnings24h)}
                        foot="warn events"
                        dotColor="var(--lvl-warn)"
                        spark={rateBuckets.map((bucket) => bucket.warn || 0)}
                        sparkColor="var(--lvl-warn)"
                    />
                </div>

                <div className="fb-rate-panel">
                    <div className="fb-rate-head">
                        <div className="fb-rate-title">
                            <span>Ingest rate</span>
                            <code>last 60 min</code>
                        </div>
                        <div className="fb-rate-legend">
                            <span><i className="normal" />normal</span>
                            <span><i className="warn" />warn</span>
                            <span><i className="error" />error</span>
                        </div>
                    </div>
                    <RateStrip buckets={rateBuckets} />
                </div>

                <form onSubmit={submitFilters} className="fb-logs-toolbar">
                    <label className="fb-logs-search">
                        <Search className="h-3.5 w-3.5" />
                        <input
                            type="search"
                            placeholder="Search message, metadata, request_id..."
                            value={draft.q}
                            onChange={(event) => updateDraft('q', event.target.value)}
                        />
                        <span>/</span>
                    </label>

                    {draft.resource ? (
                        <button type="button" className="fb-chip active" onClick={() => setResourceFilter('')}>
                            <Folder className="h-3 w-3" />
                            resource = {draft.resource}
                            <X className="h-3 w-3" />
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="fb-chip"
                            onClick={() => liveSummary.resources?.[0]?.resource && setResourceFilter(liveSummary.resources[0].resource)}
                        >
                            <Plus className="h-3 w-3" />
                            resource
                        </button>
                    )}

                    <label className="fb-chip fb-date-chip">
                        <Calendar className="h-3 w-3" />
                        <input
                            type="datetime-local"
                            value={draft.from}
                            onChange={(event) => updateDraft('from', event.target.value)}
                        />
                    </label>

                    <label className="fb-chip fb-date-chip">
                        <Calendar className="h-3 w-3" />
                        <input
                            type="datetime-local"
                            value={draft.to}
                            onChange={(event) => updateDraft('to', event.target.value)}
                        />
                    </label>

                    <button type="submit" className="fb-button sm">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                    </button>
                    <button type="button" className="fb-button sm icon" onClick={clearFilters} title="Clear filters">
                        <RotateCcw className="h-3.5 w-3.5" />
                    </button>

                    <div className="fb-logs-levels">
                        {FILTER_LEVELS.map((level) => (
                            <button
                                key={level}
                                type="button"
                                onClick={() => setLevel(level)}
                                className={draft.level === level ? 'active' : ''}
                            >
                                {level !== 'all' && <span className="fb-lvl-dot" style={{ background: `var(--lvl-${level})` }} />}
                                {level}
                                <span>{counts[level]}</span>
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className={`fb-tail-toggle ${tail ? 'active' : ''}`}
                        onClick={() => setTail((value) => !value)}
                    >
                        <span className="fb-tail-pulse" />
                        {tail ? 'Live tail' : 'Paused'}
                    </button>
                </form>

                <div className={`fb-log-viewer ${selectedLog ? 'with-detail' : ''}`}>
                    <div className="fb-log-table">
                        <div className="fb-log-head">
                            <div />
                            <div>Level</div>
                            <div>Time</div>
                            <div>Resource</div>
                            <div>Message</div>
                            <div />
                        </div>

                        <div className="fb-log-rows">
                            {visibleEntries.length === 0 ? (
                                <EmptyState>No logs match your filters.</EmptyState>
                            ) : (
                                visibleEntries.map((log) => (
                                    <LogLine
                                        key={log.id || `${log.occurredAtIso}-${log.message}`}
                                        log={log}
                                        selected={selectedId === log.id}
                                        fresh={newIdsRef.current.has(log.id)}
                                        onSelect={() => setSelectedId(selectedId === log.id ? null : log.id)}
                                    />
                                ))
                            )}
                        </div>

                        <div className="fb-log-footer">
                            <span>{formatNumber(logs.meta.total)} matching entries</span>
                            <span className="fb-footer-sep">·</span>
                            {LEVELS.map((level) => (
                                <span key={level} className="fb-lvl-summary">
                                    <span className="fb-lvl-dot" style={{ background: `var(--lvl-${level})` }} />
                                    {level} <b>{counts[level]}</b>
                                </span>
                            ))}
                            <span className="fb-footer-spacer" />
                            <span className={tail ? 'fb-streaming' : ''}>{tail ? '● streaming' : '○ paused'}</span>
                        </div>
                    </div>

                    {selectedLog && (
                        <LogDetail
                            log={selectedLog}
                            onClose={() => setSelectedId(null)}
                            onFilterResource={(resource) => setResourceFilter(resource)}
                        />
                    )}
                </div>

                {logs.meta.lastPage > 1 && <Pagination links={logs.links} />}
            </div>
        </AuthenticatedLayout>
    );
}

function LogsKpi({ label, value, foot, dotColor, spark, sparkColor }) {
    return (
        <div className="fb-logs-kpi">
            <div className="fb-logs-kpi-label">
                <span style={{ background: dotColor }} />
                {label}
            </div>
            <div className="fb-logs-kpi-value">{value}</div>
            <div className="fb-logs-kpi-foot">{foot}</div>
            <Sparkline data={spark} color={sparkColor} />
        </div>
    );
}

function Sparkline({ data, color }) {
    const values = compactSparkData(data);
    const width = 82;
    const height = 28;
    const max = Math.max(...values, 1);
    const points = values
        .map((value, index) => `${(index / Math.max(values.length - 1, 1)) * width},${height - (value / max) * height}`)
        .join(' ');

    return (
        <svg className="fb-logs-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
            <polyline points={points} fill="none" stroke={color} strokeWidth="1.4" />
            <polyline points={`0,${height} ${points} ${width},${height}`} fill={color} opacity="0.12" />
        </svg>
    );
}

function RateStrip({ buckets }) {
    const max = Math.max(...buckets.map((bucket) => bucket.total), 1);

    return (
        <div className="fb-rate-strip">
            {buckets.map((bucket, index) => (
                <div
                    key={bucket.minute || index}
                    className={`fb-rate-bar ${bucket.hasError ? 'has-error' : ''} ${bucket.hasWarn ? 'has-warn' : ''}`}
                    style={{ height: `${Math.max(8, (bucket.total / max) * 100)}%` }}
                    title={`${bucket.total} logs · ${bucket.label || `${59 - index}m ago`}`}
                />
            ))}
        </div>
    );
}

function LogLine({ log, selected, fresh, onSelect }) {
    return (
        <div
            className={`fb-log-line ${selected ? 'selected' : ''} ${fresh ? 'new-row' : ''}`}
            data-level={safeLevel(log.level)}
            onClick={onSelect}
        >
            <div className="fb-log-lvl-bar" />
            <div className="fb-log-cell lvl"><LevelPill level={log.level} /></div>
            <div className="fb-log-cell ts">{relativeTime(log)}</div>
            <div className="fb-log-cell resource">
                <span>{log.resource || 'server'}</span>
            </div>
            <div className="fb-log-cell message">
                {log.message || '(empty message)'}
                {requestId(log) && <span>· {requestId(log)}</span>}
            </div>
            <div className="fb-log-cell actions">
                <button
                    type="button"
                    className="fb-icon-btn"
                    title="Copy log"
                    onClick={(event) => {
                        event.stopPropagation();
                        navigator.clipboard?.writeText(JSON.stringify(log, null, 2));
                    }}
                >
                    <Copy className="h-3 w-3" />
                </button>
                <button type="button" className="fb-icon-btn" title="More" onClick={(event) => event.stopPropagation()}>
                    <MoreHorizontal className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

function LogDetail({ log, onClose, onFilterResource }) {
    const metadata = log.metadata || {};
    const context = detailContext(log);

    return (
        <aside className="fb-log-detail">
            <div className="fb-log-detail-head">
                <LevelPill level={log.level} />
                <code>{log.resource || 'server'}</code>
                <span>{formatIso(log.occurredAtIso)}</span>
                <button type="button" className="fb-icon-btn" onClick={onClose} title="Close">
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>

            <div className="fb-log-detail-body">
                <div className="fb-log-detail-msg">{log.message || '(empty message)'}</div>

                <section className="fb-log-detail-section">
                    <h2>Context</h2>
                    {context.map(([key, value]) => (
                        <div key={key} className="fb-kv-row">
                            <span>{key}</span>
                            <button type="button" onClick={() => navigator.clipboard?.writeText(String(value))}>{String(value)}</button>
                        </div>
                    ))}
                </section>

                <section className="fb-log-detail-section">
                    <h2>Raw payload</h2>
                    <pre
                        className="fb-json-block"
                        dangerouslySetInnerHTML={{
                            __html: jsonHighlight({
                                id: log.id,
                                level: safeLevel(log.level),
                                timestamp: log.occurredAtIso,
                                resource: log.resource,
                                message: log.message,
                                metadata,
                            }),
                        }}
                    />
                </section>

                <section className="fb-log-detail-section">
                    <h2>Actions</h2>
                    <div className="fb-log-detail-actions">
                        <button type="button" className="fb-button sm" onClick={() => navigator.clipboard?.writeText(log.id || '')}>
                            <Copy className="h-3 w-3" />
                            Copy ID
                        </button>
                        {log.resource && (
                            <button type="button" className="fb-button sm" onClick={() => onFilterResource(log.resource)}>
                                <Filter className="h-3 w-3" />
                                Filter resource
                            </button>
                        )}
                        <button type="button" className="fb-button sm">
                            <Activity className="h-3 w-3" />
                            Trace
                        </button>
                    </div>
                </section>
            </div>
        </aside>
    );
}

function LevelPill({ level }) {
    const normalized = safeLevel(level);

    return <span className={`fb-lvl-pill ${normalized}`}>{normalized}</span>;
}

function normalizeFilters(value = {}) {
    return {
        q: value.q || '',
        level: value.level || 'all',
        resource: value.resource || '',
        from: value.from || '',
        to: value.to || '',
        perPage: value.perPage || 25,
    };
}

function normalizeBuckets(value) {
    if (Array.isArray(value) && value.length > 0) {
        return value;
    }

    return Array.from({ length: 60 }, (_, index) => ({
        minute: String(index),
        label: `${59 - index}m`,
        total: 0,
        debug: 0,
        info: 0,
        warn: 0,
        error: 0,
        fatal: 0,
        hasWarn: false,
        hasError: false,
    }));
}

function compactSparkData(values) {
    const source = values?.length ? values : [0];

    if (source.length <= 18) {
        return source;
    }

    const size = Math.ceil(source.length / 18);
    const compacted = [];

    for (let i = 0; i < source.length; i += size) {
        compacted.push(source.slice(i, i + size).reduce((total, value) => total + value, 0));
    }

    return compacted;
}

function incrementSummary(summary, incoming) {
    const next = {
        ...summary,
        levels: { ...(summary.levels || {}) },
        resources: [...(summary.resources || [])],
        rateBuckets: normalizeBuckets(summary.rateBuckets).map((bucket) => ({ ...bucket })),
    };
    const resourceCounts = new Map(next.resources.map((resource) => [resource.resource, resource.count]));

    incoming.forEach((log) => {
        const level = safeLevel(log.level);
        const isRecent = isWithinLastDay(log.occurredAtIso);

        next.total = (next.total || 0) + 1;
        next.levels[level] = (next.levels[level] || 0) + 1;

        if (isRecent) {
            next.last24h = (next.last24h || 0) + 1;
            if (level === 'warn') next.warnings24h = (next.warnings24h || 0) + 1;
            if (level === 'error' || level === 'fatal') next.errors24h = (next.errors24h || 0) + 1;
        }

        if (log.resource) {
            resourceCounts.set(log.resource, (resourceCounts.get(log.resource) || 0) + 1);
        }

        const latestBucket = next.rateBuckets[next.rateBuckets.length - 1];
        latestBucket.total += 1;
        latestBucket[level] = (latestBucket[level] || 0) + 1;
        latestBucket.hasWarn = latestBucket.hasWarn || level === 'warn';
        latestBucket.hasError = latestBucket.hasError || level === 'error' || level === 'fatal';
    });

    next.resources = [...resourceCounts.entries()]
        .map(([resource, count]) => ({ resource, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

    return next;
}

function matchesFilters(log, filters) {
    if (filters.level && filters.level !== 'all' && safeLevel(log.level) !== filters.level) {
        return false;
    }

    if (filters.resource && log.resource !== filters.resource) {
        return false;
    }

    const query = (filters.q || '').trim().toLowerCase();
    if (query) {
        const metadata = JSON.stringify(log.metadata || {}).toLowerCase();
        const haystack = `${log.message || ''} ${log.resource || ''} ${metadata}`.toLowerCase();

        if (!haystack.includes(query)) {
            return false;
        }
    }

    if (filters.from || filters.to) {
        const occurredAt = log.occurredAtIso ? new Date(log.occurredAtIso) : null;

        if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
            return false;
        }

        if (filters.from && occurredAt < new Date(filters.from)) {
            return false;
        }

        if (filters.to && occurredAt > new Date(filters.to)) {
            return false;
        }
    }

    return true;
}

function detailContext(log) {
    const metadata = log.metadata || {};
    const rows = [
        ['log_id', log.id],
        ['request_id', metadata.request_id || metadata.requestId],
        ['server', metadata.server_id || metadata.server || metadata.source],
        ['resource', log.resource || 'server'],
        ['player', metadata.player_id || metadata.player || metadata.playerSource],
        ['ip', metadata.ip],
        ['duration', metadata.duration_ms ? `${metadata.duration_ms} ms` : metadata.duration],
        ['created_at', log.createdAt],
    ];

    return rows.filter(([, value]) => value !== undefined && value !== null && value !== '');
}

function requestId(log) {
    return log.metadata?.request_id || log.metadata?.requestId || log.id;
}

function safeLevel(level) {
    const normalized = String(level || 'info').toLowerCase();

    if (normalized === 'warning') return 'warn';
    if (normalized === 'critical') return 'fatal';
    if (LEVELS.includes(normalized)) return normalized;

    return 'info';
}

function relativeTime(log) {
    if (!log.occurredAtIso) {
        return log.occurredAt || 'now';
    }

    const date = new Date(log.occurredAtIso);
    const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));

    if (Number.isNaN(seconds)) {
        return log.occurredAt || '';
    }

    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;

    return `${Math.floor(seconds / 86400)}d ago`;
}

function formatIso(value) {
    if (!value) return '';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toISOString().replace('Z', '');
}

function formatNumber(value) {
    return Number(value || 0).toLocaleString();
}

function isWithinLastDay(value) {
    if (!value) {
        return true;
    }

    const date = new Date(value);

    return !Number.isNaN(date.getTime()) && Date.now() - date.getTime() <= 24 * 60 * 60 * 1000;
}

function jsonHighlight(obj) {
    const json = JSON.stringify(obj, null, 2).replace(/[&<>]/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
    }[char]));

    return json
        .replace(/("[^"]+")(\s*:)/g, '<span class="k">$1</span>$2')
        .replace(/: ("[^"]*")/g, ': <span class="s">$1</span>')
        .replace(/: (-?\d+\.?\d*)/g, ': <span class="n">$1</span>')
        .replace(/: (true|false|null)/g, ': <span class="b">$1</span>');
}
