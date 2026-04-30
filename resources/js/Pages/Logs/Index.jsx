import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, router } from '@inertiajs/react';
import { AlertTriangle, Database, Filter, RotateCcw, Search, Server, ShieldAlert, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';

const levels = ['all', 'debug', 'info', 'warn', 'error', 'fatal'];

export default function LogsIndex({ auth, team, filters, summary, logs }) {
    const [draft, setDraft] = useState(filters);

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

    const clearFilters = () => {
        const next = { q: '', level: 'all', resource: '', from: '', to: '', perPage: 25 };
        setDraft(next);
        router.get(route('logs.index'), next, { preserveState: true, replace: true });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Logs" />

            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{team.slug}</p>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Logs</h1>
                        <p className="mt-2 text-sm text-slate-600">Search cloud logs sent through the Fivemanage-compatible API.</p>
                    </div>
                    <Badge>{summary.driver === 'clickhouse' ? 'ClickHouse' : 'Database'} storage</Badge>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    <Metric icon={Database} label="Total logs" value={summary.total} detail="all time" />
                    <Metric icon={Server} label="Logs 24h" value={summary.last24h} detail="recent ingest" />
                    <Metric icon={ShieldAlert} label="Errors 24h" value={summary.errors24h} detail="error and fatal" tone="red" />
                    <Metric icon={AlertTriangle} label="Warnings 24h" value={summary.warnings24h} detail="warn events" tone="amber" />
                </div>

                <Card>
                    <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <CardTitle>Search & Filters</CardTitle>
                            <p className="mt-1 text-xs text-slate-500">{logs.meta.total} matching entries</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {levels.map((level) => (
                                <button
                                    key={level}
                                    type="button"
                                    onClick={() => setLevel(level)}
                                    className={`h-8 rounded-md px-3 text-xs font-medium ${draft.level === level ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'}`}
                                >
                                    {level}
                                </button>
                            ))}
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitFilters} className="grid gap-3 lg:grid-cols-[1fr_180px_180px_180px_auto]">
                            <label className="relative block">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    className="h-10 w-full rounded-md border-slate-300 pl-9 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                    placeholder="Search message, resource, metadata"
                                    value={draft.q}
                                    onChange={(event) => updateDraft('q', event.target.value)}
                                />
                            </label>

                            <input
                                className="h-10 rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                placeholder="resource"
                                value={draft.resource}
                                onChange={(event) => updateDraft('resource', event.target.value)}
                            />

                            <input
                                type="datetime-local"
                                className="h-10 rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                value={draft.from}
                                onChange={(event) => updateDraft('from', event.target.value)}
                            />

                            <input
                                type="datetime-local"
                                className="h-10 rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                value={draft.to}
                                onChange={(event) => updateDraft('to', event.target.value)}
                            />

                            <div className="flex gap-2">
                                <Button type="submit" className="h-10">
                                    <Filter className="h-4 w-4" />
                                    Filter
                                </Button>
                                <Button type="button" variant="secondary" className="h-10" onClick={clearFilters}>
                                    <RotateCcw className="h-4 w-4" />
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-[1fr_300px]">
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Entries</CardTitle>
                            <SlidersHorizontal className="h-4 w-4 text-slate-400" />
                        </CardHeader>
                        <CardContent>
                            {logs.data.length === 0 ? (
                                <Empty>No logs found.</Empty>
                            ) : (
                                <div className="overflow-hidden rounded-md border border-slate-200">
                                    {logs.data.map((log) => (
                                        <LogRow key={log.id || `${log.occurredAtIso}-${log.message}`} log={log} />
                                    ))}
                                </div>
                            )}

                            {logs.meta.lastPage > 1 && (
                                <div className="mt-6 flex flex-wrap gap-2">
                                    {logs.links.map((link, index) => (
                                        <Link
                                            key={`${link.label}-${index}`}
                                            href={link.url ?? '#'}
                                            preserveScroll
                                            className={`rounded-md border px-3 py-2 text-sm ${link.active ? 'border-slate-950 bg-slate-950 text-white' : 'border-slate-200 text-slate-700'} ${!link.url ? 'pointer-events-none opacity-50' : ''}`}
                                            dangerouslySetInnerHTML={{ __html: link.label }}
                                        />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle>Levels</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                {levels.filter((level) => level !== 'all').map((level) => (
                                    <StatBar key={level} label={level} value={summary.levels[level] ?? 0} total={summary.total} />
                                ))}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle>Top Resources</CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {summary.resources.length === 0 ? (
                                    <Empty compact>No resources yet.</Empty>
                                ) : (
                                    summary.resources.map((resource) => (
                                        <button
                                            key={resource.resource}
                                            type="button"
                                            onClick={() => {
                                                updateDraft('resource', resource.resource);
                                                router.get(route('logs.index'), { ...draft, resource: resource.resource, page: undefined }, { preserveState: true, replace: true });
                                            }}
                                            className="flex w-full items-center justify-between rounded-md border border-slate-200 px-3 py-2 text-left text-sm transition hover:bg-slate-50"
                                        >
                                            <span className="truncate font-medium text-slate-800">{resource.resource}</span>
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
    return (
        <div className="border-b border-slate-200 bg-white p-4 last:border-b-0">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
                        <span className="text-xs text-slate-500">{log.resource || 'server'}</span>
                        <span className="text-xs text-slate-400">{log.occurredAt}</span>
                    </div>
                    <p className="mt-2 break-words text-sm text-slate-800">{log.message || '(empty message)'}</p>
                </div>
                {log.occurredAtIso && <code className="shrink-0 rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">{log.occurredAtIso}</code>}
            </div>

            {Object.keys(log.metadata || {}).length > 0 && (
                <details className="mt-3">
                    <summary className="cursor-pointer text-xs font-medium text-slate-500">metadata</summary>
                    <pre className="mt-2 max-h-72 overflow-auto rounded-md bg-slate-950 p-3 text-xs text-slate-100">
                        {JSON.stringify(log.metadata, null, 2)}
                    </pre>
                </details>
            )}
        </div>
    );
}

function Metric({ icon: Icon, label, value, detail, tone = 'default' }) {
    const toneClass = tone === 'red' ? 'bg-red-600' : tone === 'amber' ? 'bg-amber-500' : 'bg-slate-950';

    return (
        <Card>
            <CardContent className="flex items-center gap-4">
                <div className={`flex h-10 w-10 items-center justify-center rounded-md text-white ${toneClass}`}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <div className="text-sm text-slate-500">{label}</div>
                    <div className="text-xl font-semibold text-slate-950">{value}</div>
                    <div className="text-xs text-slate-400">{detail}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function StatBar({ label, value, total }) {
    const percent = total > 0 ? Math.round((value / total) * 100) : 0;

    return (
        <div>
            <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-slate-600">{label}</span>
                <span className="text-slate-400">{value}</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-slate-800" style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

function Empty({ children, compact = false }) {
    return <div className={`${compact ? 'py-4' : 'py-14'} text-center text-sm text-slate-500`}>{children}</div>;
}

function levelVariant(level) {
    if (level === 'error' || level === 'fatal') return 'red';
    if (level === 'warn' || level === 'warning') return 'amber';
    if (level === 'info') return 'green';

    return 'default';
}
