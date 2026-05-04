import { EmptyState, Field, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Copy,
    Eye,
    EyeOff,
    KeyRound,
    LockKeyhole,
    MoreHorizontal,
    Plus,
    ShieldCheck,
    Terminal,
    Trash2,
    X,
} from 'lucide-react';
import { Fragment, useRef, useState } from 'react';

const scopeOptions = [
    { id: 'media', label: 'Media', detail: 'upload, list, delete files' },
    { id: 'logs', label: 'Logs', detail: 'ingest server logs' },
    { id: 'sdk', label: 'SDK', detail: 'resource reports and sessions' },
    { id: '*', label: 'Full access', detail: 'all current API scopes' },
];

export default function ApiKeysIndex({ auth, team, apiBase, tokens, endpoints }) {
    const { flash } = usePage().props;
    const [revealed, setRevealed] = useState({});
    const [loading, setLoading] = useState({});
    const [expanded, setExpanded] = useState({});
    const [createOpen, setCreateOpen] = useState(tokens.length === 0);
    const nameInput = useRef(null);
    const form = useForm({
        name: 'FiveM server',
        scopes: ['media', 'logs', 'sdk'],
    });

    const activeCount = tokens.filter((token) => token.isActive).length;
    const visibleToken = flash.apiToken || firstRevealedToken(revealed);
    const setupToken = visibleToken || 'fbk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
    const setupCommand = `# server.cfg
ensure fivebucket
setr fivebucket_token "${setupToken}"
setr fivebucket_endpoint "${apiBase.replace(/\/api\/v3$/, '')}"
setr fivebucket_resource "$\{GetCurrentResourceName()}"`;

    const toggleScope = (scope) => {
        if (scope === '*') {
            form.setData('scopes', form.data.scopes.includes('*') ? [] : ['*']);
            return;
        }

        const current = form.data.scopes.filter((item) => item !== '*');
        const next = current.includes(scope)
            ? current.filter((item) => item !== scope)
            : [...current, scope];

        form.setData('scopes', next);
    };

    const openCreate = () => {
        setCreateOpen(true);
        window.setTimeout(() => nameInput.current?.focus(), 40);
    };

    const createToken = (event) => {
        event.preventDefault();
        form.post(route('api-tokens.store'), {
            preserveScroll: true,
            onSuccess: () => {
                form.reset('name');
                setCreateOpen(false);
            },
        });
    };

    const fetchSecret = async (token) => {
        if (!token.canReveal) {
            const payload = {
                token: null,
                message: 'This key cannot be revealed. Create a new encrypted key to view it later.',
                available: false,
            };
            setRevealed((current) => ({ ...current, [token.id]: payload }));
            return payload;
        }

        setLoading((current) => ({ ...current, [token.id]: true }));

        try {
            const response = await fetch(route('api-tokens.secret', token.id), {
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            });

            if (!response.ok) {
                throw new Error('Unable to reveal this key.');
            }

            const payload = await response.json();
            setRevealed((current) => ({
                ...current,
                [token.id]: {
                    token: payload.token,
                    message: payload.message,
                    available: payload.available,
                },
            }));

            return payload;
        } catch (error) {
            const payload = {
                token: null,
                message: error.message,
                available: false,
            };

            setRevealed((current) => ({ ...current, [token.id]: payload }));
            return payload;
        } finally {
            setLoading((current) => ({ ...current, [token.id]: false }));
        }
    };

    const toggleReveal = async (token) => {
        if (revealed[token.id]?.token || revealed[token.id]?.message) {
            setRevealed((current) => ({ ...current, [token.id]: null }));
            return;
        }

        await fetchSecret(token);
    };

    const copyToken = async (token) => {
        const current = revealed[token.id];
        const payload = current?.token ? current : await fetchSecret(token);

        if (payload?.token) {
            navigator.clipboard?.writeText(payload.token);
        }
    };

    const copySetup = () => navigator.clipboard?.writeText(setupCommand);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="API Keys" />

            <div className="fb-page fb-api-keys-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="API Keys"
                    description="Authenticate FiveM resources for media upload, log ingestion and SDK calls through the FiveBucket API."
                    actions={(
                        <>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('docs')}>
                                    <BookOpen className="h-3.5 w-3.5" />
                                    Docs
                                </Link>
                            </Button>
                            <Button type="button" size="sm" onClick={openCreate}>
                                <Plus className="h-3.5 w-3.5" />
                                New API key
                            </Button>
                        </>
                    )}
                />

                <div className="fb-key-security">
                    <ShieldCheck className="h-4 w-4" />
                    <span>
                        Keys are encrypted at rest and can be revealed from this page while active. Store them in your
                        <code> server.cfg </code>
                        as
                        <code> setr fivebucket_token </code>
                        and rotate production keys regularly.
                    </span>
                    <span className="fb-key-security-meta">{activeCount} active / {tokens.length} total</span>
                </div>

                {flash.apiToken && (
                    <div className="fb-alert success mb-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[var(--fg)]">New API key</div>
                                <code className="fb-inline-code mt-2 block fb-break">{flash.apiToken}</code>
                            </div>
                            <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(flash.apiToken)}>
                                <Copy className="h-3.5 w-3.5" />
                                Copy
                            </Button>
                        </div>
                    </div>
                )}

                {createOpen && (
                    <div className="fb-key-create">
                        <div className="fb-panel-header">
                            <div>
                                <h3 className="fb-panel-title">Create API key</h3>
                                <p className="fb-panel-subtitle">Generate a scoped credential for a server, bot or integration.</p>
                            </div>
                            <button type="button" className="fb-icon-btn" title="Close" onClick={() => setCreateOpen(false)}>
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                        <form onSubmit={createToken} className="fb-key-create-body">
                            <Field label="Name" error={form.errors.name}>
                                <input
                                    ref={nameInput}
                                    className="fb-input"
                                    value={form.data.name}
                                    onChange={(event) => form.setData('name', event.target.value)}
                                    placeholder="production-server"
                                />
                            </Field>

                            <div className="fb-key-scope-grid">
                                {scopeOptions.map((scope) => {
                                    const active = form.data.scopes.includes(scope.id);

                                    return (
                                        <button
                                            key={scope.id}
                                            type="button"
                                            className={`fb-key-scope ${active ? 'active' : ''}`}
                                            onClick={() => toggleScope(scope.id)}
                                            aria-pressed={active}
                                        >
                                            <span>{scope.label}</span>
                                            <small>{scope.detail}</small>
                                        </button>
                                    );
                                })}
                            </div>

                            {form.errors.scopes && <div className="fb-error-text">{form.errors.scopes}</div>}

                            <div className="fb-key-create-actions">
                                <Badge>{apiBase}</Badge>
                                <Button type="submit" disabled={form.processing || form.data.scopes.length === 0}>
                                    <KeyRound className="h-4 w-4" />
                                    Create Key
                                </Button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="fb-simple-table">
                    {tokens.length === 0 ? (
                        <EmptyState>No API keys yet. Create one to connect your FiveM resource.</EmptyState>
                    ) : (
                        <table>
                            <thead>
                                <tr>
                                    <th style={{ width: '20%' }}>Name</th>
                                    <th style={{ width: '28%' }}>Key</th>
                                    <th>Scopes</th>
                                    <th>Last used</th>
                                    <th>Created</th>
                                    <th>Status</th>
                                    <th style={{ width: 116 }} />
                                </tr>
                            </thead>
                            <tbody>
                                {tokens.map((token) => (
                                    <Fragment key={token.id}>
                                        <tr>
                                            <td>
                                                <div className="font-semibold text-[var(--fg)]">{token.name}</div>
                                                <div className="fb-mono text-[10px] fb-dim">id {token.id}</div>
                                            </td>
                                            <td>
                                                <div className="fb-key-secret-cell">
                                                    <code className="fb-key-mono fb-break">
                                                        {revealed[token.id]?.token || `${token.prefix}********************************`}
                                                    </code>
                                                    {token.isActive && (
                                                        <>
                                                            <button
                                                                type="button"
                                                                className="fb-icon-btn"
                                                                title={revealed[token.id]?.token ? 'Hide key' : 'Reveal key'}
                                                                onClick={() => toggleReveal(token)}
                                                                disabled={loading[token.id]}
                                                            >
                                                                {revealed[token.id]?.token ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                            </button>
                                                            <button
                                                                type="button"
                                                                className="fb-icon-btn"
                                                                title="Copy key"
                                                                onClick={() => copyToken(token)}
                                                                disabled={loading[token.id]}
                                                            >
                                                                <Copy className="h-3.5 w-3.5" />
                                                            </button>
                                                        </>
                                                    )}
                                                </div>
                                                {revealed[token.id]?.message && (
                                                    <div className="fb-alert warning mt-2 text-[11px]">{revealed[token.id].message}</div>
                                                )}
                                            </td>
                                            <td>
                                                <div className="flex flex-wrap gap-1">
                                                    {token.scopes.map((scope) => <Badge key={scope}>{scopeLabel(scope)}</Badge>)}
                                                </div>
                                            </td>
                                            <td className="fb-mono">{token.lastUsedAt ?? 'never'}</td>
                                            <td className="fb-mono">{token.createdAt ?? 'unknown'}</td>
                                            <td>
                                                <span className={`fb-token-status ${token.isActive ? 'active' : 'revoked'}`}>
                                                    {token.isActive ? 'active' : 'revoked'}
                                                </span>
                                                {!token.canReveal && token.isActive && <Badge variant="amber" className="ml-2">legacy</Badge>}
                                            </td>
                                            <td>
                                                <div className="fb-key-actions">
                                                    <button
                                                        type="button"
                                                        className="fb-icon-btn"
                                                        title="Key details"
                                                        onClick={() => setExpanded((current) => ({ ...current, [token.id]: !current[token.id] }))}
                                                    >
                                                        <MoreHorizontal className="h-4 w-4" />
                                                    </button>
                                                    {token.isActive && (
                                                        <Link
                                                            href={route('api-tokens.destroy', token.id)}
                                                            method="delete"
                                                            as="button"
                                                            preserveScroll
                                                            className="fb-icon-btn danger"
                                                            title="Revoke key"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Link>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expanded[token.id] && (
                                            <tr key={`${token.id}-details`} className="fb-key-details-row">
                                                <td colSpan={7}>
                                                    <div className="fb-key-details">
                                                        <div>
                                                            <div className="fb-label">Server config</div>
                                                            <pre className="fb-code mt-2">{setupForToken(apiBase, revealed[token.id]?.token || `${token.prefix}...`)}</pre>
                                                        </div>
                                                        <div>
                                                            <div className="fb-label">Compatibility endpoints</div>
                                                            <div className="fb-key-endpoints">
                                                                {endpoints.map((endpoint) => (
                                                                    <span key={`${token.id}-${endpoint.method}-${endpoint.path}`} className="fb-key-endpoint">
                                                                        <Badge variant={methodVariant(endpoint.method)}>{endpoint.method}</Badge>
                                                                        <code>{endpoint.path}</code>
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </Fragment>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="fb-key-setup">
                    <div>
                        <div className="flex items-center gap-2">
                            <Terminal className="h-4 w-4 fb-dim" />
                            <h3 className="fb-panel-title">Quick setup</h3>
                        </div>
                        <p className="fb-panel-subtitle">
                            Drop this in your server.cfg to start sending media and logs with the FiveBucket resource.
                        </p>
                    </div>
                    <Button type="button" variant="secondary" size="sm" onClick={copySetup}>
                        <Copy className="h-3.5 w-3.5" />
                        Copy config
                    </Button>
                    <pre className="fb-code fb-key-setup-code">{setupCommand}</pre>
                </div>

                <div className="fb-key-footnote">
                    <LockKeyhole className="h-3.5 w-3.5" />
                    <span>Revoked keys stay listed for audit context and cannot authenticate new API requests.</span>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function firstRevealedToken(revealed) {
    return Object.values(revealed).find((item) => item?.token)?.token || null;
}

function scopeLabel(scope) {
    return scope === '*' ? 'full' : scope;
}

function methodVariant(method) {
    if (method === 'GET') return 'green';
    if (method === 'DELETE') return 'red';

    return 'default';
}

function setupForToken(apiBase, token) {
    return `ensure fivebucket
setr fivebucket_token "${token}"
setr fivebucket_endpoint "${apiBase.replace(/\/api\/v3$/, '')}"`;
}
