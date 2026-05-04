import { CopyButton, EmptyState, Field, KpiCard, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Copy, Eye, EyeOff, KeyRound, LockKeyhole, Route, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';

const scopes = ['media', 'logs', 'sdk'];

export default function ApiKeysIndex({ auth, team, apiBase, tokens, endpoints }) {
    const { flash } = usePage().props;
    const [revealed, setRevealed] = useState({});
    const [loading, setLoading] = useState({});
    const form = useForm({
        name: 'FiveM server',
        scopes: ['media', 'logs', 'sdk'],
    });

    const toggleScope = (scope) => {
        form.setData(
            'scopes',
            form.data.scopes.includes(scope)
                ? form.data.scopes.filter((item) => item !== scope)
                : [...form.data.scopes, scope],
        );
    };

    const createToken = (event) => {
        event.preventDefault();
        form.post(route('api-tokens.store'), {
            preserveScroll: true,
            onSuccess: () => form.reset('name'),
        });
    };

    const revealToken = async (token) => {
        if (revealed[token.id]?.token) {
            setRevealed((current) => ({ ...current, [token.id]: null }));
            return;
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
        } catch (error) {
            setRevealed((current) => ({
                ...current,
                [token.id]: {
                    token: null,
                    message: error.message,
                    available: false,
                },
            }));
        } finally {
            setLoading((current) => ({ ...current, [token.id]: false }));
        }
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="API Keys" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title="API Keys"
                    description="Credentials for FiveM resources, media uploads, logs ingestion, and SDK sessions."
                    actions={<Badge>{apiBase}</Badge>}
                />

                <div className="fb-kpis">
                    <KpiCard icon={KeyRound} label="Active keys" value={tokens.filter((token) => token.isActive).length} detail={`${tokens.length} total credentials`} />
                    <KpiCard icon={ShieldCheck} label="Scopes" value={scopes.length} detail="media · logs · sdk" />
                    <KpiCard icon={Route} label="Endpoints" value={endpoints.length} detail="compatibility routes" tone="muted" />
                    <KpiCard icon={LockKeyhole} label="Reveal" value="Encrypted" detail="new keys can be viewed later" />
                </div>

                {flash.apiToken && (
                    <div className="fb-alert success mb-3">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-[12px] font-semibold text-[var(--fg)]">New API key</div>
                                <code className="fb-inline-code mt-2 block fb-break">{flash.apiToken}</code>
                            </div>
                            <CopyButton value={flash.apiToken} />
                        </div>
                    </div>
                )}

                <div className="fb-grid" style={{ gridTemplateColumns: '420px minmax(0, 1fr)', marginBottom: 12 }}>
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Key</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createToken} className="fb-form-grid">
                                <Field label="Name" error={form.errors.name}>
                                    <input
                                        className="fb-input"
                                        value={form.data.name}
                                        onChange={(event) => form.setData('name', event.target.value)}
                                    />
                                </Field>

                                <div>
                                    <div className="fb-label mb-2">Scopes</div>
                                    <div className="fb-grid cols-3">
                                        {scopes.map((scope) => (
                                            <label key={scope} className={`fb-button ${form.data.scopes.includes(scope) ? 'primary' : ''}`}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.data.scopes.includes(scope)}
                                                    onChange={() => toggleScope(scope)}
                                                    className="sr-only"
                                                />
                                                {scope}
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <Button type="submit" disabled={form.processing}>
                                    <KeyRound className="h-4 w-4" />
                                    Create Key
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Compatibility API</CardTitle>
                                <p className="fb-panel-subtitle fb-break">{apiBase}</p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Method</th>
                                            <th>Path</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {endpoints.map((endpoint) => (
                                            <tr key={`${endpoint.method}-${endpoint.path}`}>
                                                <td><Badge variant={endpoint.method === 'GET' ? 'green' : endpoint.method === 'DELETE' ? 'red' : 'default'}>{endpoint.method}</Badge></td>
                                                <td><code className="fb-mono text-[11px] fb-muted">{endpoint.path}</code></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Existing Keys</CardTitle>
                        <Badge>{tokens.length} total</Badge>
                    </CardHeader>
                    <CardContent>
                        {tokens.length === 0 ? (
                            <EmptyState>No API keys yet.</EmptyState>
                        ) : (
                            <div className="fb-table-wrap">
                                <table className="fb-table">
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Prefix</th>
                                            <th>Scopes</th>
                                            <th>Last used</th>
                                            <th>Status</th>
                                            <th />
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {tokens.map((token) => (
                                            <tr key={token.id}>
                                                <td>
                                                    <div className="font-medium text-[var(--fg)]">{token.name}</div>
                                                    <div className="fb-mono text-[10px] fb-dim">created {token.createdAt}</div>
                                                    {revealed[token.id]?.token && (
                                                        <code className="fb-inline-code mt-2 block fb-break">{revealed[token.id].token}</code>
                                                    )}
                                                    {revealed[token.id]?.message && (
                                                        <div className="fb-alert warning mt-2 text-[11px]">{revealed[token.id].message}</div>
                                                    )}
                                                </td>
                                                <td><code className="fb-inline-code">{token.prefix}...</code></td>
                                                <td>
                                                    <div className="flex flex-wrap gap-1">
                                                        {token.scopes.map((scope) => <Badge key={scope}>{scope}</Badge>)}
                                                    </div>
                                                </td>
                                                <td className="fb-mono">{token.lastUsedAt ?? 'never'}</td>
                                                <td>
                                                    <div className="flex flex-wrap gap-1">
                                                        <Badge variant={token.isActive ? 'green' : 'red'}>{token.isActive ? 'active' : 'revoked'}</Badge>
                                                        {!token.canReveal && token.isActive && <Badge variant="amber">legacy</Badge>}
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex justify-end gap-2">
                                                        {token.isActive && (
                                                            <Button type="button" variant="secondary" size="sm" onClick={() => revealToken(token)} disabled={loading[token.id]}>
                                                                {revealed[token.id]?.token ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                                                                {revealed[token.id]?.token ? 'Hide' : 'View'}
                                                            </Button>
                                                        )}
                                                        {revealed[token.id]?.token && (
                                                            <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(revealed[token.id].token)}>
                                                                <Copy className="h-3.5 w-3.5" />
                                                                Copy
                                                            </Button>
                                                        )}
                                                        {token.isActive && (
                                                            <Button asChild variant="destructive" size="sm">
                                                                <Link href={route('api-tokens.destroy', token.id)} method="delete" as="button" preserveScroll>
                                                                    <Trash2 className="h-3.5 w-3.5" />
                                                                    Revoke
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}
