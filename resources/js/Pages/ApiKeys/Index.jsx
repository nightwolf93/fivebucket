import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, useForm, usePage } from '@inertiajs/react';
import { Copy, Eye, EyeOff, KeyRound, Trash2 } from 'lucide-react';
import { useState } from 'react';

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

            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <Header title="API Keys" eyebrow={team.slug} description="Manage server credentials used by FiveM resources and NUI uploads." />

                {flash.apiToken && (
                    <Card className="border-emerald-200 bg-emerald-50">
                        <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                            <div className="min-w-0">
                                <div className="text-sm font-semibold text-emerald-950">New API key</div>
                                <code className="mt-1 block break-all rounded-md bg-white px-3 py-2 text-xs text-emerald-950 ring-1 ring-emerald-200">
                                    {flash.apiToken}
                                </code>
                            </div>
                            <Button type="button" variant="secondary" onClick={() => navigator.clipboard?.writeText(flash.apiToken)}>
                                <Copy className="h-4 w-4" />
                                Copy
                            </Button>
                        </CardContent>
                    </Card>
                )}

                <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create Key</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <form onSubmit={createToken} className="space-y-4">
                                <label className="block text-sm font-medium text-slate-700">
                                    Name
                                    <input
                                        className="mt-1 block h-10 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                        value={form.data.name}
                                        onChange={(event) => form.setData('name', event.target.value)}
                                    />
                                </label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['media', 'logs', 'sdk'].map((scope) => (
                                        <label key={scope} className="flex h-10 items-center justify-center gap-2 rounded-md border border-slate-200 text-sm text-slate-700">
                                            <input
                                                type="checkbox"
                                                checked={form.data.scopes.includes(scope)}
                                                onChange={() => toggleScope(scope)}
                                                className="rounded border-slate-300 text-slate-950 focus:ring-slate-500"
                                            />
                                            {scope}
                                        </label>
                                    ))}
                                </div>
                                <Button type="submit" disabled={form.processing} className="w-full">
                                    <KeyRound className="h-4 w-4" />
                                    Create Key
                                </Button>
                            </form>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Compatibility API</CardTitle>
                            <code className="mt-2 block break-all text-xs text-slate-500">{apiBase}</code>
                        </CardHeader>
                        <CardContent className="grid gap-3 md:grid-cols-2">
                            {endpoints.map((endpoint) => (
                                <div key={`${endpoint.method}-${endpoint.path}`} className="flex items-center gap-3 rounded-md border border-slate-200 px-3 py-2">
                                    <Badge variant={endpoint.method === 'GET' ? 'green' : 'default'}>{endpoint.method}</Badge>
                                    <code className="text-xs text-slate-600">{endpoint.path}</code>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                <Card>
                    <CardHeader>
                        <CardTitle>Existing Keys</CardTitle>
                    </CardHeader>
                    <CardContent className="divide-y divide-slate-100">
                        {tokens.length === 0 ? (
                            <Empty>No API keys yet.</Empty>
                        ) : (
                            tokens.map((token) => (
                                <div key={token.id} className="grid gap-3 py-4 md:grid-cols-[1fr_auto] md:items-start">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <div className="font-medium text-slate-950">{token.name}</div>
                                            <Badge variant={token.isActive ? 'green' : 'red'}>{token.isActive ? 'active' : 'revoked'}</Badge>
                                            {!token.canReveal && token.isActive && <Badge variant="amber">legacy</Badge>}
                                        </div>
                                        <div className="mt-1 text-xs text-slate-500">{token.prefix}... · {token.scopes.join(', ')} · created {token.createdAt}</div>
                                        {revealed[token.id]?.token && (
                                            <code className="mt-3 block break-all rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-700 ring-1 ring-slate-200">
                                                {revealed[token.id].token}
                                            </code>
                                        )}
                                        {revealed[token.id]?.message && (
                                            <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                                                {revealed[token.id].message}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap justify-start gap-2 md:justify-end">
                                        {token.isActive && (
                                            <Button type="button" variant="secondary" size="sm" onClick={() => revealToken(token)} disabled={loading[token.id]}>
                                                {revealed[token.id]?.token ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                                {revealed[token.id]?.token ? 'Hide' : 'View'}
                                            </Button>
                                        )}
                                        {revealed[token.id]?.token && (
                                            <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(revealed[token.id].token)}>
                                                <Copy className="h-4 w-4" />
                                                Copy
                                            </Button>
                                        )}
                                        {token.isActive && (
                                            <Button asChild variant="destructive" size="sm">
                                                <Link href={route('api-tokens.destroy', token.id)} method="delete" as="button" preserveScroll>
                                                    <Trash2 className="h-4 w-4" />
                                                    Revoke
                                                </Link>
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function Header({ title, eyebrow, description }) {
    return (
        <div>
            <p className="text-sm font-medium text-slate-500">{eyebrow}</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{title}</h1>
            <p className="mt-2 text-sm text-slate-600">{description}</p>
        </div>
    );
}

function Empty({ children }) {
    return <div className="py-8 text-center text-sm text-slate-500">{children}</div>;
}
