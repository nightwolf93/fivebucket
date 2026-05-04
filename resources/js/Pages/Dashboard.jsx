import { EmptyState, ExternalButton, KpiCard, PageHeader } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Progress } from '@/Components/ui/progress';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { Boxes, HardDrive, KeyRound, ScrollText, Settings, UploadCloud } from 'lucide-react';

export default function Dashboard({ auth, team, stats, files, logs }) {
    const activity = [
        ...files.slice(0, 3).map((file) => ({
            id: `file-${file.id}`,
            type: 'media',
            title: file.filename,
            detail: `${file.type} · ${file.size}`,
            time: file.createdAt,
        })),
        ...logs.slice(0, 3).map((log, index) => ({
            id: `log-${index}`,
            type: 'log',
            title: log.message || '(empty message)',
            detail: `${log.level} · ${log.resource ?? 'server'}`,
            time: log.occurredAt ?? log.createdAt,
        })),
    ].slice(0, 5);

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Dashboard" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.slug}
                    title={team.name}
                    description="Overview of your FiveM hosting surface: storage, media, API keys, logs, and delivery configuration."
                    actions={
                        <>
                            <Badge variant="green">{team.plan?.name ?? 'Free'}</Badge>
                            <Badge>{team.billingStatus}</Badge>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('media.index')}>
                                    <UploadCloud className="h-3.5 w-3.5" />
                                    Upload
                                </Link>
                            </Button>
                        </>
                    }
                />

                <div className="fb-kpis">
                    <KpiCard icon={HardDrive} label="Storage" value={team.storageUsed} detail={`${team.storageLimit} limit · ${team.storagePercent}% used`} />
                    <KpiCard icon={Boxes} label="Media" value={stats.totalMedia} detail={`${stats.images} images · ${stats.videos} videos`} />
                    <KpiCard icon={KeyRound} label="API keys" value={stats.activeApiKeys} detail="active credentials" tone="muted" />
                    <KpiCard icon={ScrollText} label="Logs 24h" value={stats.logs24h} detail={`${stats.logsTotal} total logs`} />
                </div>

                <div className="fb-grid" style={{ gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.8fr)', marginBottom: 12 }}>
                    <Card>
                        <CardHeader>
                            <div>
                                <CardTitle>Storage Usage</CardTitle>
                                <p className="fb-panel-subtitle">Current workspace quota and public delivery endpoint.</p>
                            </div>
                            <div className="fb-page-actions">
                                <Button asChild variant="secondary" size="sm">
                                    <Link href={route('media.index')}>
                                        <UploadCloud className="h-3.5 w-3.5" />
                                        Manage media
                                    </Link>
                                </Button>
                                <Button asChild variant="ghost" size="sm">
                                    <Link href={route('settings.index')}>
                                        <Settings className="h-3.5 w-3.5" />
                                        URL override
                                    </Link>
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between">
                                <span className="fb-mono text-[22px] font-semibold">{team.storageUsed}</span>
                                <span className="fb-badge">{team.storagePercent}%</span>
                            </div>
                            <Progress value={team.storagePercent} className="mt-3" />
                            <div className="mt-3 fb-break fb-mono text-[11px] fb-muted">
                                {team.publicBaseUrl ?? 'Using fallback application storage URL'}
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Activity</CardTitle>
                            <Button asChild variant="ghost" size="sm">
                                <Link href={route('logs.index')}>View all</Link>
                            </Button>
                        </CardHeader>
                        <CardContent className="fb-stack">
                            {activity.length === 0 ? (
                                <EmptyState compact>No activity yet.</EmptyState>
                            ) : (
                                activity.map((item) => (
                                    <div key={item.id} className="grid grid-cols-[24px_1fr_auto] items-center gap-3 rounded-md px-2 py-2 hover:bg-[var(--bg-hover)]">
                                        <div className={`fb-status-pill ${item.type === 'log' ? 'warn' : 'active'}`} />
                                        <div className="min-w-0">
                                            <div className="truncate text-[12px] font-medium text-[var(--fg)]">{item.title}</div>
                                            <div className="truncate fb-mono text-[10px] fb-dim">{item.detail}</div>
                                        </div>
                                        <div className="fb-mono text-[10px] fb-dim">{item.time}</div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="fb-grid cols-2">
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Media</CardTitle>
                            <Button asChild variant="ghost" size="sm">
                                <Link href={route('media.index')}>View library</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {files.length === 0 ? (
                                <EmptyState>No uploads yet.</EmptyState>
                            ) : (
                                <div className="fb-table-wrap">
                                    <table className="fb-table">
                                        <thead>
                                            <tr>
                                                <th>File</th>
                                                <th>Type</th>
                                                <th>Size</th>
                                                <th />
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {files.map((file) => (
                                                <tr key={file.id}>
                                                    <td>
                                                        <div className="font-medium text-[var(--fg)]">{file.filename}</div>
                                                        <div className="fb-mono text-[10px] fb-dim">{file.createdAt}</div>
                                                    </td>
                                                    <td><Badge>{file.type}</Badge></td>
                                                    <td className="fb-mono">{file.size}</td>
                                                    <td><ExternalButton href={file.url} label="Open" /></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Logs</CardTitle>
                            <Button asChild variant="ghost" size="sm">
                                <Link href={route('logs.index')}>Inspect logs</Link>
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {logs.length === 0 ? (
                                <EmptyState>No logs yet.</EmptyState>
                            ) : (
                                <div className="fb-table-wrap">
                                    {logs.map((log, index) => (
                                        <div key={`${log.createdAt}-${index}`} className="fb-log-row">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <Badge variant={levelVariant(log.level)}>{log.level}</Badge>
                                                <span className="fb-mono text-[10px] fb-dim">{log.resource ?? 'server'}</span>
                                                <span className="fb-mono text-[10px] fb-dim">{log.occurredAt ?? log.createdAt}</span>
                                            </div>
                                            <p className="mt-2 text-[12px] fb-muted">{log.message || '(empty message)'}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function levelVariant(level) {
    if (level === 'error' || level === 'fatal') return 'red';
    if (level === 'warn' || level === 'warning') return 'amber';
    if (level === 'info') return 'green';

    return 'default';
}
