import { EmptyState, Pagination } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, router } from '@inertiajs/react';
import {
    Activity,
    Bookmark,
    Calendar,
    ChevronDown,
    Copy,
    Download,
    FileJson,
    Filter,
    Folder,
    ListFilter,
    MoreHorizontal,
    Plus,
    RotateCcw,
    Save,
    Search,
    SlidersHorizontal,
    Trash2,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';

const LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'];
const FILTER_LEVELS = ['all', ...LEVELS];
const TIMEFRAMES = [
    { value: '', label: 'Custom' },
    { value: '15m', label: '15m' },
    { value: '1h', label: '1h' },
    { value: '6h', label: '6h' },
    { value: '24h', label: '24h' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
];
const METADATA_OPERATORS = [
    { value: 'contains', label: 'contains' },
    { value: 'exact', label: '=' },
    { value: 'ne', label: '!=' },
    { value: 'gt', label: '>' },
    { value: 'gte', label: '>=' },
    { value: 'lt', label: '<' },
    { value: 'lte', label: '<=' },
    { value: 'exists', label: 'exists' },
    { value: 'missing', label: 'missing' },
];

export default function LogsIndex({ auth, team, filters, summary, logs, savedViews = [] }) {
    const [draft, setDraft] = useState(normalizeFilters(filters));
    const [entries, setEntries] = useState(logs.data);
    const [liveSummary, setLiveSummary] = useState(summary);
    const [selectedId, setSelectedId] = useState(null);
    const [tail, setTail] = useState(true);
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const [saveOpen, setSaveOpen] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [suggestions, setSuggestions] = useState({ keys: [], values: [] });
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

    useEffect(() => {
        if (!advancedOpen) {
            return undefined;
        }

        const key = activeMetadataKey(draft);
        const timer = window.setTimeout(async () => {
            try {
                const response = await fetch(route('logs.metadata-suggestions', {
                    resource: draft.resource || undefined,
                    resourceMode: draft.resourceMode !== 'exact' ? draft.resourceMode : undefined,
                    timeframe: draft.timeframe || undefined,
                    key: key || undefined,
                }), {
                    headers: { Accept: 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
                });

                if (response.ok) {
                    setSuggestions(await response.json());
                }
            } catch {
                setSuggestions({ keys: [], values: [] });
            }
        }, 180);

        return () => window.clearTimeout(timer);
    }, [advancedOpen, draft.resource, draft.resourceMode, draft.timeframe, draft.metadataFilters, draft.metadataKey]);

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
    const updateMetadataFilter = (index, key, value) => {
        setDraft((current) => {
            const filters = metadataFilters(current).map((filter) => ({ ...filter }));
            filters[index] = { ...(filters[index] || emptyMetadataFilter()), [key]: value };

            return { ...current, metadataFilters: filters, metadataKey: '', metadataValue: '', metadataMode: 'contains' };
        });
    };
    const addMetadataFilter = (filter = emptyMetadataFilter()) => {
        setDraft((current) => ({
            ...current,
            metadataFilters: [...metadataFilters(current), filter],
            metadataKey: '',
            metadataValue: '',
            metadataMode: 'contains',
        }));
    };
    const removeMetadataFilter = (index) => {
        setDraft((current) => ({
            ...current,
            metadataFilters: metadataFilters(current).filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const navigate = (next, options = {}) => {
        const params = serializeFilters(next);
        setDraft(next);
        router.get(route('logs.index'), params, { preserveState: true, replace: true, ...options });
    };

    const submitFilters = (event) => {
        event.preventDefault();
        navigate(draft);
    };

    const setLevel = (level) => {
        const current = normalizeLevels(draft.levels);
        let levels;

        if (level === 'all') {
            levels = ['all'];
        } else if (current.includes(level)) {
            levels = current.filter((item) => item !== level);
            if (levels.length === 0) levels = ['all'];
        } else {
            levels = [...current.filter((item) => item !== 'all'), level];
        }

        navigate({ ...draft, levels, level: levels.includes('all') ? 'all' : levels.join(',') });
    };

    const setResourceFilter = (resource) => {
        navigate({ ...draft, resource, resourceMode: resource ? draft.resourceMode : 'exact' });
    };

    const setTimeframe = (timeframe) => {
        navigate({ ...draft, timeframe, from: '', to: '' });
    };

    const clearFilters = () => {
        navigate(defaultFilters());
    };

    const exportLogs = (format = 'csv') => {
        window.location.assign(route('logs.export', { ...serializeFilters(draft), format }));
    };

    const saveView = (event) => {
        event.preventDefault();

        router.post(route('logs.saved-views.store'), {
            name: saveName || suggestedViewName(draft),
            filters: serializeFilters(draft),
            pinned: true,
        }, {
            preserveScroll: true,
            onSuccess: () => {
                setSaveName('');
                setSaveOpen(false);
            },
        });
    };

    const traceLog = (log) => {
        const traceId = requestId(log);

        if (traceId && traceId !== log.id) {
            navigate({ ...draft, requestId: traceId, q: '', qMode: 'all' });

            return;
        }

        navigate({ ...draft, q: log.id || log.message || '', qMode: 'all' });
    };

    const applyMetadataFilter = (path, value = undefined) => {
        const hasValue = value !== undefined && (value === null || typeof value !== 'object');

        setAdvancedOpen(true);
        navigate({
            ...draft,
            q: '',
            qMode: 'all',
            metadataKey: '',
            metadataValue: '',
            metadataMode: 'contains',
            metadataFilters: [
                ...metadataFilters(draft),
                {
                    key: path,
                    operator: hasValue ? 'exact' : 'exists',
                    value: hasValue ? String(value) : '',
                },
            ],
        });
    };

    const activeFilterCount = countActiveFilters(draft);

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
                        <button type="button" className="fb-button sm" onClick={() => exportLogs('csv')}>
                            <Download className="h-3.5 w-3.5" />
                            Export CSV
                        </button>
                        <button type="button" className="fb-button sm" onClick={() => exportLogs('json')}>
                            <FileJson className="h-3.5 w-3.5" />
                            JSON
                        </button>
                        <button type="button" className="fb-button sm" onClick={() => setSaveOpen((value) => !value)}>
                            <Save className="h-3.5 w-3.5" />
                            Save view
                        </button>
                        <Badge>{liveSummary.driver === 'clickhouse' ? 'ClickHouse' : 'Database'} storage</Badge>
                        <Badge variant={liveCount > 0 ? 'green' : 'default'}>{liveCount > 0 ? `+${liveCount} live` : 'Live ready'}</Badge>
                    </div>
                </div>

                {saveOpen && (
                    <form className="fb-save-view" onSubmit={saveView}>
                        <Bookmark className="h-4 w-4 fb-dim" />
                        <input
                            value={saveName}
                            onChange={(event) => setSaveName(event.target.value)}
                            placeholder={suggestedViewName(draft)}
                            maxLength={80}
                            autoFocus
                        />
                        <button type="submit" className="fb-button sm primary">
                            <Save className="h-3.5 w-3.5" />
                            Save
                        </button>
                        <button type="button" className="fb-button sm icon" onClick={() => setSaveOpen(false)}>
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </form>
                )}

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

                {savedViews.length > 0 && (
                    <div className="fb-saved-views">
                        <span><Bookmark className="h-3.5 w-3.5" /> Saved views</span>
                        {savedViews.map((view) => (
                            <button key={view.id} type="button" onClick={() => navigate(normalizeFilters(view.filters || {}))}>
                                {view.name}
                            </button>
                        ))}
                    </div>
                )}

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

                    <select
                        className="fb-chip fb-chip-select"
                        value={draft.qMode}
                        onChange={(event) => updateDraft('qMode', event.target.value)}
                        aria-label="Search scope"
                    >
                        <option value="all">all fields</option>
                        <option value="message">message</option>
                        <option value="resource">resource</option>
                        <option value="metadata">metadata</option>
                    </select>

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
                            onClick={() => {
                                if (liveSummary.resources?.[0]?.resource) {
                                    setResourceFilter(liveSummary.resources[0].resource);
                                } else {
                                    setAdvancedOpen(true);
                                }
                            }}
                        >
                            <Plus className="h-3 w-3" />
                            resource
                        </button>
                    )}

                    {metadataFilters(draft).length > 0 && (
                        <button
                            type="button"
                            className="fb-chip active"
                            onClick={() => navigate({ ...draft, metadataFilters: [], metadataKey: '', metadataValue: '', metadataMode: 'contains' })}
                            title="Clear metadata filter"
                        >
                            <Filter className="h-3 w-3" />
                            {metadataFilters(draft).length} metadata filter{metadataFilters(draft).length > 1 ? 's' : ''}
                            <X className="h-3 w-3" />
                        </button>
                    )}

                    <div className="fb-timeframes">
                        {TIMEFRAMES.filter((item) => item.value).map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                className={draft.timeframe === item.value ? 'active' : ''}
                                onClick={() => setTimeframe(item.value)}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>

                    <label className="fb-chip fb-date-chip">
                        <Calendar className="h-3 w-3" />
                        <input
                            type="datetime-local"
                            value={draft.from}
                            onChange={(event) => updateDraft('from', event.target.value)}
                            onFocus={() => updateDraft('timeframe', '')}
                        />
                    </label>

                    <label className="fb-chip fb-date-chip">
                        <Calendar className="h-3 w-3" />
                        <input
                            type="datetime-local"
                            value={draft.to}
                            onChange={(event) => updateDraft('to', event.target.value)}
                            onFocus={() => updateDraft('timeframe', '')}
                        />
                    </label>

                    <button type="submit" className="fb-button sm">
                        <Filter className="h-3.5 w-3.5" />
                        Filter
                    </button>
                    <button
                        type="button"
                        className={`fb-button sm ${advancedOpen ? 'primary' : ''}`}
                        onClick={() => setAdvancedOpen((value) => !value)}
                    >
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        Advanced
                        {activeFilterCount > 0 && <span className="fb-button-count">{activeFilterCount}</span>}
                        <ChevronDown className="h-3 w-3" />
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
                                className={levelIsActive(draft.levels, level) ? 'active' : ''}
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

                    {advancedOpen && (
                        <AdvancedFilters
                            draft={draft}
                            resources={liveSummary.resources || []}
                            onChange={updateDraft}
                            onMetadataChange={updateMetadataFilter}
                            onMetadataAdd={addMetadataFilter}
                            onMetadataRemove={removeMetadataFilter}
                            onApply={submitFilters}
                            onExport={exportLogs}
                            onClear={clearFilters}
                            suggestions={suggestions}
                        />
                    )}
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
                            onApplyMetadataFilter={applyMetadataFilter}
                            onTrace={traceLog}
                        />
                    )}
                </div>

                {logs.meta.lastPage > 1 && <Pagination links={logs.links} />}
            </div>
        </AuthenticatedLayout>
    );
}

function AdvancedFilters({ draft, resources, onChange, onMetadataChange, onMetadataAdd, onMetadataRemove, onExport, onClear, suggestions }) {
    const conditions = metadataFilters(draft);

    return (
        <div className="fb-advanced-filters">
            <div className="fb-advanced-head">
                <div>
                    <strong>Advanced filters</strong>
                    <span>ClickHouse-backed fields, metadata extraction, time windows, sorting and exports.</span>
                </div>
                <div className="fb-advanced-actions">
                    <button type="button" className="fb-button sm" onClick={() => onExport('csv')}>
                        <Download className="h-3.5 w-3.5" />
                        CSV
                    </button>
                    <button type="button" className="fb-button sm" onClick={() => onExport('json')}>
                        <FileJson className="h-3.5 w-3.5" />
                        JSON
                    </button>
                    <button type="button" className="fb-button sm" onClick={onClear}>
                        <RotateCcw className="h-3.5 w-3.5" />
                        Reset
                    </button>
                    <button type="submit" className="fb-button sm primary">
                        <Filter className="h-3.5 w-3.5" />
                        Apply
                    </button>
                </div>
            </div>

            <div className="fb-advanced-grid">
                <label className="fb-advanced-field">
                    Resource
                    <input
                        list="fb-log-resources"
                        value={draft.resource}
                        placeholder="fivebucket, server, ox_inventory"
                        onChange={(event) => onChange('resource', event.target.value)}
                    />
                    <datalist id="fb-log-resources">
                        {resources.map((resource) => (
                            <option key={resource.resource} value={resource.resource}>{resource.count}</option>
                        ))}
                    </datalist>
                </label>

                <label className="fb-advanced-field">
                    Resource mode
                    <select value={draft.resourceMode} onChange={(event) => onChange('resourceMode', event.target.value)}>
                        <option value="exact">Exact match</option>
                        <option value="contains">Contains</option>
                    </select>
                </label>

                <label className="fb-advanced-field">
                    Request ID
                    <input value={draft.requestId} placeholder="req_..." onChange={(event) => onChange('requestId', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    Server
                    <input value={draft.server} placeholder="prod-rp-1" onChange={(event) => onChange('server', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    Player
                    <input value={draft.player} placeholder="source, steam id, name" onChange={(event) => onChange('player', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    IP
                    <input value={draft.ip} placeholder="51.15.23.42" onChange={(event) => onChange('ip', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    Min duration ms
                    <input type="number" min="0" value={draft.durationMin} placeholder="200" onChange={(event) => onChange('durationMin', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    Max duration ms
                    <input type="number" min="0" value={draft.durationMax} placeholder="2500" onChange={(event) => onChange('durationMax', event.target.value)} />
                </label>

                <label className="fb-advanced-field">
                    Sort
                    <select value={draft.sort} onChange={(event) => onChange('sort', event.target.value)}>
                        <option value="newest">Newest first</option>
                        <option value="oldest">Oldest first</option>
                        <option value="level">Level</option>
                        <option value="resource">Resource</option>
                    </select>
                </label>

                <label className="fb-advanced-field">
                    Rows
                    <select value={draft.perPage} onChange={(event) => onChange('perPage', event.target.value)}>
                        <option value="25">25</option>
                        <option value="50">50</option>
                        <option value="100">100</option>
                        <option value="250">250</option>
                    </select>
                </label>

                <label className="fb-advanced-field fb-advanced-wide">
                    Export metadata columns
                    <input value={draft.metadataColumns} placeholder="charId, action, cash, atmCoords.x" onChange={(event) => onChange('metadataColumns', event.target.value)} />
                </label>
            </div>

            <div className="fb-query-builder">
                <div className="fb-query-builder-head">
                    <div>
                        <strong>Metadata query builder</strong>
                        <span>Combine nested metadata conditions with AND logic.</span>
                    </div>
                    <button type="button" className="fb-button sm" onClick={() => onMetadataAdd()}>
                        <Plus className="h-3.5 w-3.5" />
                        Condition
                    </button>
                </div>

                <datalist id="fb-metadata-keys">
                    {(suggestions.keys || []).map((item) => <option key={item.key} value={item.key}>{item.count}</option>)}
                </datalist>
                <datalist id="fb-metadata-values">
                    {(suggestions.values || []).map((item) => <option key={item.value} value={item.value}>{item.count}</option>)}
                </datalist>

                {conditions.length === 0 ? (
                    <div className="fb-query-empty">
                        <button type="button" onClick={() => onMetadataAdd({ key: 'charId', operator: 'exact', value: '1' })}>charId = 1</button>
                        <button type="button" onClick={() => onMetadataAdd({ key: 'action', operator: 'exact', value: 'rope_completed' })}>action = rope_completed</button>
                        <button type="button" onClick={() => onMetadataAdd({ key: 'cash', operator: 'gt', value: '100' })}>cash &gt; 100</button>
                    </div>
                ) : (
                    <div className="fb-query-rows">
                        {conditions.map((condition, index) => (
                            <div key={`${condition.key}-${index}`} className="fb-query-row">
                                <input
                                    list="fb-metadata-keys"
                                    value={condition.key}
                                    placeholder="metadata path"
                                    onChange={(event) => onMetadataChange(index, 'key', event.target.value)}
                                />
                                <select value={condition.operator} onChange={(event) => onMetadataChange(index, 'operator', event.target.value)}>
                                    {METADATA_OPERATORS.map((operator) => (
                                        <option key={operator.value} value={operator.value}>{operator.label}</option>
                                    ))}
                                </select>
                                <input
                                    list="fb-metadata-values"
                                    value={condition.value}
                                    placeholder={['exists', 'missing'].includes(condition.operator) ? 'no value needed' : 'value'}
                                    disabled={['exists', 'missing'].includes(condition.operator)}
                                    onChange={(event) => onMetadataChange(index, 'value', event.target.value)}
                                />
                                <button type="button" className="fb-icon-btn danger" onClick={() => onMetadataRemove(index)} title="Remove condition">
                                    <Trash2 className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                )}

                {(suggestions.keys || []).length > 0 && (
                    <div className="fb-query-suggestions">
                        <span>Keys</span>
                        {(suggestions.keys || []).slice(0, 12).map((item) => (
                            <button key={item.key} type="button" onClick={() => onMetadataAdd({ key: item.key, operator: 'exists', value: '' })}>
                                {item.key} <small>{item.count}</small>
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="fb-advanced-presets">
                <span><ListFilter className="h-3.5 w-3.5" /> Time range</span>
                {TIMEFRAMES.map((item) => (
                    <button
                        key={item.value || 'custom'}
                        type="button"
                        className={draft.timeframe === item.value ? 'active' : ''}
                        onClick={() => {
                            onChange('timeframe', item.value);
                            if (item.value) {
                                onChange('from', '');
                                onChange('to', '');
                            }
                        }}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
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
                <button
                    type="button"
                    className="fb-icon-btn"
                    title="Open details"
                    onClick={(event) => {
                        event.stopPropagation();
                        onSelect();
                    }}
                >
                    <MoreHorizontal className="h-3 w-3" />
                </button>
            </div>
        </div>
    );
}

function LogDetail({ log, onClose, onFilterResource, onApplyMetadataFilter, onTrace }) {
    const metadata = log.metadata || {};
    const context = detailContext(log);
    const payload = {
        id: log.id,
        level: safeLevel(log.level),
        timestamp: log.occurredAtIso,
        resource: log.resource,
        message: log.message,
        metadata,
    };

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
                    <InteractiveJson data={payload} onFilter={onApplyMetadataFilter} />
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
                        <button type="button" className="fb-button sm" onClick={() => onTrace(log)}>
                            <Activity className="h-3 w-3" />
                            Trace
                        </button>
                    </div>
                </section>
            </div>
        </aside>
    );
}

function InteractiveJson({ data, onFilter }) {
    const entries = Object.entries(data || {});

    return (
        <div className="fb-json-block" role="tree">
            <div className="fb-json-line">
                <span className="fb-json-brace">{'{'}</span>
            </div>
            {entries.map(([key, value], index) => (
                <JsonNode
                    key={key}
                    name={key}
                    value={value}
                    path={key}
                    depth={1}
                    comma={index < entries.length - 1}
                    onFilter={onFilter}
                />
            ))}
            <div className="fb-json-line">
                <span className="fb-json-brace">{'}'}</span>
            </div>
        </div>
    );
}

function JsonNode({ name, value, path, depth, comma, onFilter }) {
    const container = isJsonContainer(value);
    const entries = container ? Object.entries(value || {}) : [];
    const filterPath = metadataFilterPath(path);
    const primitive = !container;
    const canFilter = Boolean(filterPath);
    const applyFilter = () => {
        if (canFilter) {
            onFilter(filterPath, primitive ? value : undefined);
        }
    };

    if (container) {
        const open = Array.isArray(value) ? '[' : '{';
        const close = Array.isArray(value) ? ']' : '}';

        return (
            <>
                <div className="fb-json-line" style={{ '--json-depth': depth }}>
                    <button
                        type="button"
                        className={`fb-json-key ${canFilter ? 'clickable' : ''}`}
                        onClick={applyFilter}
                        disabled={!canFilter}
                        title={canFilter ? `Filter ${filterPath} exists` : undefined}
                    >
                        "{name}"
                    </button>
                    <span className="fb-json-punct">:</span>
                    <span className="fb-json-brace">{open}</span>
                    <span className="fb-json-count">{entries.length}</span>
                    {canFilter && (
                        <button type="button" className="fb-json-filter" onClick={applyFilter} title={`Filter ${filterPath} exists`}>
                            <Filter className="h-3 w-3" />
                        </button>
                    )}
                </div>
                {entries.map(([childKey, childValue], index) => (
                    <JsonNode
                        key={`${path}.${childKey}`}
                        name={childKey}
                        value={childValue}
                        path={`${path}.${childKey}`}
                        depth={depth + 1}
                        comma={index < entries.length - 1}
                        onFilter={onFilter}
                    />
                ))}
                <div className="fb-json-line" style={{ '--json-depth': depth }}>
                    <span className="fb-json-brace">{close}</span>
                    {comma && <span className="fb-json-punct">,</span>}
                </div>
            </>
        );
    }

    return (
        <div className="fb-json-line" style={{ '--json-depth': depth }}>
            <button
                type="button"
                className={`fb-json-key ${canFilter ? 'clickable' : ''}`}
                onClick={applyFilter}
                disabled={!canFilter}
                title={canFilter ? `Filter ${filterPath} = ${String(value)}` : undefined}
            >
                "{name}"
            </button>
            <span className="fb-json-punct">:</span>
            <button
                type="button"
                className={`fb-json-value ${jsonValueClass(value)} ${canFilter ? 'clickable' : ''}`}
                onClick={applyFilter}
                disabled={!canFilter}
                title={canFilter ? `Filter ${filterPath} = ${String(value)}` : undefined}
            >
                {jsonValuePreview(value)}
            </button>
            {canFilter && (
                <button type="button" className="fb-json-filter" onClick={applyFilter} title={`Filter ${filterPath} = ${String(value)}`}>
                    <Filter className="h-3 w-3" />
                </button>
            )}
            {comma && <span className="fb-json-punct">,</span>}
        </div>
    );
}

function LevelPill({ level }) {
    const normalized = safeLevel(level);

    return <span className={`fb-lvl-pill ${normalized}`}>{normalized}</span>;
}

function normalizeFilters(value = {}) {
    const levels = normalizeLevels(value.levels || value.level);
    const filters = metadataFilters(value);

    return {
        q: value.q || '',
        qMode: value.qMode || 'all',
        level: value.level || 'all',
        levels,
        resource: value.resource || '',
        resourceMode: value.resourceMode || 'exact',
        requestId: value.requestId || '',
        server: value.server || '',
        player: value.player || '',
        ip: value.ip || '',
        metadataKey: filters.length > 0 ? '' : value.metadataKey || '',
        metadataValue: filters.length > 0 ? '' : value.metadataValue || '',
        metadataMode: ['contains', 'exact', 'exists', 'missing', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(value.metadataMode) ? value.metadataMode : 'contains',
        metadataFilters: filters,
        metadataColumns: Array.isArray(value.metadataColumns) ? value.metadataColumns.join(', ') : value.metadataColumns || '',
        durationMin: value.durationMin || '',
        durationMax: value.durationMax || '',
        from: value.from || '',
        to: value.to || '',
        timeframe: value.timeframe || '',
        sort: value.sort || 'newest',
        perPage: value.perPage || 25,
    };
}

function defaultFilters() {
    return {
        q: '',
        qMode: 'all',
        level: 'all',
        levels: ['all'],
        resource: '',
        resourceMode: 'exact',
        requestId: '',
        server: '',
        player: '',
        ip: '',
        metadataKey: '',
        metadataValue: '',
        metadataMode: 'contains',
        metadataFilters: [],
        metadataColumns: '',
        durationMin: '',
        durationMax: '',
        from: '',
        to: '',
        timeframe: '',
        sort: 'newest',
        perPage: 25,
    };
}

function normalizeLevels(value) {
    const raw = Array.isArray(value) ? value : String(value || 'all').split(/[,|]/);
    const levels = raw
        .map((level) => String(level || '').trim().toLowerCase())
        .map((level) => (level === 'warning' ? 'warn' : level))
        .filter((level) => LEVELS.includes(level));

    return levels.length === 0 ? ['all'] : [...new Set(levels)];
}

function serializeFilters(value) {
    const filters = normalizeFilters(value);
    const levels = normalizeLevels(filters.levels);
    const conditions = metadataFilters(filters);

    return {
        q: filters.q || undefined,
        qMode: filters.qMode !== 'all' ? filters.qMode : undefined,
        level: levels.includes('all') ? 'all' : undefined,
        levels: levels.includes('all') ? undefined : levels.join(','),
        resource: filters.resource || undefined,
        resourceMode: filters.resource && filters.resourceMode !== 'exact' ? filters.resourceMode : undefined,
        requestId: filters.requestId || undefined,
        server: filters.server || undefined,
        player: filters.player || undefined,
        ip: filters.ip || undefined,
        metadataFilters: conditions.length > 0 ? JSON.stringify(conditions) : undefined,
        metadataKey: conditions.length === 0 ? filters.metadataKey || undefined : undefined,
        metadataValue: conditions.length === 0 ? filters.metadataValue || undefined : undefined,
        metadataMode: conditions.length === 0 && filters.metadataKey && filters.metadataMode !== 'contains' ? filters.metadataMode : undefined,
        metadataColumns: filters.metadataColumns || undefined,
        durationMin: filters.durationMin || undefined,
        durationMax: filters.durationMax || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        timeframe: filters.timeframe || undefined,
        sort: filters.sort !== 'newest' ? filters.sort : undefined,
        perPage: Number(filters.perPage) !== 25 ? filters.perPage : undefined,
        page: undefined,
    };
}

function levelIsActive(levels, level) {
    const normalized = normalizeLevels(levels);

    if (level === 'all') {
        return normalized.includes('all');
    }

    return normalized.includes(level);
}

function countActiveFilters(value) {
    const filters = normalizeFilters(value);
    const levels = normalizeLevels(filters.levels);
    const keys = [
        'q',
        'resource',
        'requestId',
        'server',
        'player',
        'ip',
        'durationMin',
        'durationMax',
        'from',
        'to',
        'timeframe',
    ];
    let count = keys.filter((key) => filters[key]).length;

    count += metadataFilters(filters).length;
    if (metadataFilters(filters).length === 0 && (filters.metadataKey || filters.metadataValue)) count++;
    if (!levels.includes('all')) count++;
    if (filters.qMode !== 'all') count++;
    if (filters.resource && filters.resourceMode !== 'exact') count++;
    if (metadataFilters(filters).length === 0 && filters.metadataKey && filters.metadataMode !== 'contains') count++;
    if (filters.sort !== 'newest') count++;
    if (Number(filters.perPage) !== 25) count++;

    return count;
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
    const normalized = normalizeFilters(filters);
    const levels = normalizeLevels(normalized.levels);
    const metadata = log.metadata || {};

    if (!levels.includes('all') && !levels.includes(safeLevel(log.level))) {
        return false;
    }

    if (normalized.resource) {
        const resource = String(log.resource || '').toLowerCase();
        const filter = normalized.resource.toLowerCase();

        if (normalized.resourceMode === 'contains') {
            if (!resource.includes(filter)) return false;
        } else if (resource !== filter) {
            return false;
        }
    }

    const query = (normalized.q || '').trim().toLowerCase();
    if (query) {
        const metadataText = JSON.stringify(metadata).toLowerCase();
        const haystack = {
            message: String(log.message || '').toLowerCase(),
            resource: String(log.resource || '').toLowerCase(),
            metadata: metadataText,
            all: `${log.message || ''} ${log.resource || ''} ${metadataText}`.toLowerCase(),
        }[normalized.qMode] || `${log.message || ''} ${log.resource || ''} ${metadataText}`.toLowerCase();

        if (!haystack.includes(query)) {
            return false;
        }
    }

    if (normalized.requestId && !metadataValueIncludes(metadata, ['request_id', 'requestId', 'request.id', 'trace_id', 'traceId'], normalized.requestId)) return false;
    if (normalized.server && !metadataValueIncludes(metadata, ['server_id', 'server', 'source'], normalized.server)) return false;
    if (normalized.player && !metadataValueIncludes(metadata, ['player_id', 'player', 'playerSource', 'player.source', 'player.id', 'charId', 'charName'], normalized.player)) return false;
    if (normalized.ip && !metadataValueIncludes(metadata, ['ip', 'player.ip'], normalized.ip)) return false;

    const conditions = metadataFilters(normalized);
    if (conditions.length > 0) {
        for (const condition of conditions) {
            if (!metadataConditionMatches(metadata, condition)) {
                return false;
            }
        }
    } else if (normalized.metadataKey) {
        const value = metadataPath(metadata, normalized.metadataKey);
        const exists = value !== undefined;

        if (normalized.metadataMode === 'missing') {
            if (exists) return false;
        } else if (!exists) {
            return false;
        } else if (normalized.metadataMode === 'exists' || !normalized.metadataValue) {
            // The existence check passed; keep evaluating the remaining filters.
        } else if (normalized.metadataMode === 'exact') {
            if (String(value) !== String(normalized.metadataValue)) return false;
        } else if (!String(value).toLowerCase().includes(normalized.metadataValue.toLowerCase())) {
            return false;
        }
    }

    const duration = Number(metadata.duration_ms ?? metadata.duration ?? 0);
    if (normalized.durationMin && duration < Number(normalized.durationMin)) return false;
    if (normalized.durationMax && duration > Number(normalized.durationMax)) return false;

    if (normalized.from || normalized.to || normalized.timeframe) {
        const occurredAt = log.occurredAtIso ? new Date(log.occurredAtIso) : null;

        if (!occurredAt || Number.isNaN(occurredAt.getTime())) {
            return false;
        }

        if (normalized.from && occurredAt < new Date(normalized.from)) {
            return false;
        }

        if (normalized.to && occurredAt > new Date(normalized.to)) {
            return false;
        }

        const timeframeStart = timeframeStartDate(normalized.timeframe);
        if (!normalized.from && timeframeStart && occurredAt < timeframeStart) {
            return false;
        }
    }

    return true;
}

function metadataValueIncludes(metadata, keys, needle) {
    const expected = String(needle || '').toLowerCase();

    return keys.some((key) => {
        const value = metadataPath(metadata, key);

        return value !== undefined && String(value).toLowerCase().includes(expected);
    });
}

function metadataFilters(value = {}) {
    let source = value.metadataFilters || [];

    if (typeof source === 'string') {
        try {
            source = JSON.parse(source);
        } catch {
            source = [];
        }
    }

    const conditions = Array.isArray(source)
        ? source
            .map((condition) => ({
                key: String(condition?.key || '').trim(),
                operator: normalizeMetadataOperator(condition?.operator || condition?.mode || 'contains'),
                value: String(condition?.value ?? ''),
            }))
            .filter((condition) => condition.key)
        : [];

    if (conditions.length > 0) {
        return conditions;
    }

    if (value.metadataKey) {
        return [{
            key: String(value.metadataKey),
            operator: normalizeMetadataOperator(value.metadataMode || 'contains'),
            value: String(value.metadataValue ?? ''),
        }];
    }

    return [];
}

function emptyMetadataFilter() {
    return { key: '', operator: 'contains', value: '' };
}

function normalizeMetadataOperator(value) {
    return ['contains', 'exact', 'exists', 'missing', 'ne', 'gt', 'gte', 'lt', 'lte'].includes(value) ? value : 'contains';
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

function activeMetadataKey(filters) {
    return metadataFilters(filters).find((condition) => condition.key)?.key || filters.metadataKey || '';
}

function suggestedViewName(filters) {
    const conditions = metadataFilters(filters);

    if (conditions[0]?.key) {
        const first = conditions[0];

        return `${first.key} ${first.operator} ${first.value || 'exists'}`;
    }

    if (filters.resource) return `resource ${filters.resource}`;
    if (!normalizeLevels(filters.levels).includes('all')) return `${normalizeLevels(filters.levels).join(', ')} logs`;
    if (filters.q) return `search ${filters.q}`;

    return 'New log view';
}

function metadataPath(metadata, path) {
    return String(path || '')
        .split('.')
        .filter(Boolean)
        .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), metadata);
}

function metadataFilterPath(path) {
    if (path === 'metadata' || !path.startsWith('metadata.')) {
        return null;
    }

    return path.slice('metadata.'.length);
}

function isJsonContainer(value) {
    return value !== null && typeof value === 'object';
}

function jsonValueClass(value) {
    if (typeof value === 'string') return 's';
    if (typeof value === 'number') return 'n';

    return 'b';
}

function jsonValuePreview(value) {
    if (typeof value === 'string') {
        return `"${value}"`;
    }

    if (value === null) {
        return 'null';
    }

    return String(value);
}

function timeframeStartDate(value) {
    const now = Date.now();

    return {
        '15m': new Date(now - 15 * 60 * 1000),
        '1h': new Date(now - 60 * 60 * 1000),
        '6h': new Date(now - 6 * 60 * 60 * 1000),
        '24h': new Date(now - 24 * 60 * 60 * 1000),
        '7d': new Date(now - 7 * 24 * 60 * 60 * 1000),
        '30d': new Date(now - 30 * 24 * 60 * 60 * 1000),
    }[value] || null;
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
