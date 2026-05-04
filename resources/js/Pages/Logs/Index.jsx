import { EmptyState, KpiCard, PageHeader, Pagination } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import { AlertTriangle, Database, Filter, RotateCcw, Search, Server, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { useEffect, useState } from 'react';

const levels = ['all', 'debug', 'info', 'warn', 'error', 'fatal'];

export default function LogsIndex({ auth, team, filters, summary, logs }) {
    const [draft, setDraft] = useState(filters);
    const [entries, setEntries] = useState(logs.data);
    const [liveCount, setLiveCount] = useState(0);

    const updateDraft = (key, value) => setDraft((current) => ({ ...current, [key]: value }));

    useEffect(() => {
        setEntries(logs.data);
        setLiveCount(0);
    }, [logs.data]);

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

            setEntries((current) => {
                const seen = new Set(current.map((log) => log.id).filter(Boolean));
                const unique = incoming.filter((log) => !log.id || !seen.has(log.id));

                return [...unique, ...current].slice(0, 250);
            });
            setLiveCount((count) => count + incoming.length);
        });

        return () => window.Echo.leave(channelName);
    }, [filters, team?.id]);

    const submitFilters = (event) => {
        event.preventDefault();
        router.get(route('logs.index'), { ...draft, page: undefined }, { preserveState: true, replace: true });
    };

    const setLevel = (level) => {
        const next = { ...draft, level };
        setDraft(next);
        router.get(route('logs.index'), { ...next, page: undefined }, { preserveState: true, replace: true });
    };

    const clearFilters = () => {
        const next = { q: '', level: 'all', resource: '', from: '', to: '', perPage: 25 };
        setDraft(next);
        router.get(route('logs.index'), next, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Logs" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="Logs"
                    description="Search and inspect logs sent through the Fivemanage-compatible API."
                    actions={(
                        <div className="fb-page-actions">
                            <Badge>{summary.driver === 'clickhouse' ? 'ClickHouse' : 'Database'} storage</Badge>
                            <Badge variant={liveCount > 0 ? 'green' : 'default'}>{liveCount > 0 ? `+${liveCount} live` : 'Live ready'}</Badge>
                        </div>
                    )}
                />

                <div className="fb-kpis">
                    <KpiCard icon={Database} label="Total logs" value={summary.total} detail="all time" tone="muted" />
                    <KpiCard icon={Server} label="Logs 24h" value={summary.last24h} detail="recent ingest" />
                    <KpiCard icon={ShieldAlert} label="Errors 24h" value={summary.errors24h} detail="error and fatal" tone="red" />
                    <KpiCard icon={AlertTriangle} label="Warnings 24h" value={summary.warnings24h} detail="warning events" tone="amber" />
                </div>

                <Card className="mb-3">
                    <CardHeader>
                        <div>
                            <CardTitle>Search & Filters</CardTitle>
                            <p className="fb-panel-subtitle">{logs.meta.total} matching entries</p>
                        </div>
                        <div className="fb-segmented">
                            {levels.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setLevel(level)}
                                    className={draft.level === level ? 'active' : ''}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitFilters} className="fb-grid" style={{ gridTemplateColumns: 'minmax(260px,1fr) 180px 190px 190px auto' }}>
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 fb-dim" />
                                <input
                                    className="fb-input pl-9"
                                    placeholder="Search message, resource, metadata"
                                    value={draft.q}
                                    onChange={(event) => updateDraft('q', event.target.value)}
                                />
                            </label>

                            <input
                                className="fb-input"
                                placeholder="resource"
                                value={draft.resource}
                                onChange={(event) => updateDraft('resource', event.target.value)}
                            />

                            <input
                                type="datetime-local"
                                className="fb-input"
                                value={draft.from}
                                onChange={(event) => updateDraft('from', event.target.value)}
                            />

                            <input
                                type="datetime-local"
                                className="fb-input"
                                value={draft.to}
                                onChange={(event) => updateDraft('to', event.target.value)}
                            />

                            <div className="flex gap-2">
                                <Button type="submit">
                                    <Filter className="h-3.5 w-3.5" />
                                    Filter
                                </Button>
                                <Button type="button" variant="secondary" size="icon" onClick={clearFilters}>
                                    <RotateCcw className="h-3.5 w-3.5" />
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="fb-grid" style={{ gridTemplateColumns: 'minmax(0,1fr) 320px' }}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Entries</CardTitle>
                            <SlidersHorizontal className="h-4 w-4 fb-dim" />
                        </CardHeader>
                        <CardContent>
                            {entries.length === 0 ? (
                                <EmptyState>No logs found.</EmptyState>
                            ) : (
                                <div className="fb-table-wrap">
                                    {entries.map((log) => (
                                        <LogRow key={log.id || `${log.occurredAtIso}-${log.message}`} log={log} />
                                    ))}
                                </div>
                            )}

                            {logs.meta.lastPage > 1 && <Pagination links={logs.links} />}
                        </CardContent>
                    </Card>

                    <div className="fb-stack">
                        <Card>
                            <CardHeader>
                                <CardTitle>Levels</CardTitle>
                            </CardHeader>
                            <CardContent className="fb-stack">
                                {levels.filter((level) => level !== 'all').map((level) => (
                                    <StatBar key={level} label={level} value={summary.levels[level] ?? 0} total={summary.total} />
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Top Resources</CardTitle>
                            </CardHeader>
                            <CardContent className="fb-stack">
                                {summary.resources.length === 0 ? (
                                    <EmptyState compact>No resources yet.</EmptyState>
                                ) : (
                                    summary.resources.map((resource) => (
                                        <button
                                            key={resource.resource}
                                            type="button"
                                            onClick={() => {
                                                const next = { ...draft, resource: resource.resource, page: undefined };
                                                setDraft(next);
                                                router.get(route('logs.index'), next, { preserveState: true, replace: true });
                                            }}
                                            className="fb-button justify-between"
                                        >
                                            <span className="truncate">{resource.resource}</span>
                                            <Badge>{resource.count}</Badge>
                                        </button>
                                    ))
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function LogRow({ log }) {
    const variant = levelVariant(log.level);

    return (
        <div className="fb-log-row">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={variant}>{log.level}</Badge>
                        <span className="fb-mono text-[10px] fb-dim">{log.resource || 'server'}</span>
                        <span className="fb-mono text-[10px] fb-dim">{log.occurredAt}</span>
                    </div>
                    <p className="mt-2 break-words text-[12px] fb-muted">{log.message || '(empty message)'}</p>
                </div>
                {log.occurredAtIso && <code className="fb-inline-code shrink-0">{log.occurredAtIso}</code>}
            </div>

            {Object.keys(log.metadata || {}).length > 0 && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-[11px] font-medium fb-dim">metadata</summary>
                    <pre className="fb-code mt-2 max-h-72">{JSON.stringify(log.metadata, null, 2)}</pre>
                </details>
            )}
        </div>
    );
}

function StatBar({ label, value, total }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
        <div>
            <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium fb-muted">{label}</span>
                <span className="fb-mono fb-dim">{value}</span>
            </div>
            <div className="fb-progress mt-1">
                <div className="fb-progress-bar" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

function levelVariant(level) {
    if (level === 'error' || level === 'fatal') return 'red';
    if (level === 'warn' || level === 'warning') return 'amber';
    if (level === 'info') return 'green';

    return 'default';
}

function matchesFilters(log, filters) {
    if (filters.level && filters.level !== 'all' && log.level !== filters.level) {
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
