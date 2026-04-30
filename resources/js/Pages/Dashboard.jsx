import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Progress } from '@/Components/ui/progress';
import { Head, Link } from '@inertiajs/react';
import { Boxes, ExternalLink, HardDrive, KeyRound, ScrollText, Settings, UploadCloud } from 'lucide-react';

export default function Dashboard({ auth, team, stats, files, logs }) {
    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Dashboard" />

            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{team.slug}</p>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{team.name}</h1>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="green">{team.plan?.name ?? 'Free'}</Badge>
                        <Badge>{team.billingStatus}</Badge>
                    </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-4">
                    <Metric icon={HardDrive} label="Storage" value={team.storageUsed} detail={`${team.storageLimit} limit`} />
                    <Metric icon={Boxes} label="Media" value={String(stats.totalMedia)} detail={`${stats.images} images, ${stats.videos} videos`} />
                    <Metric icon={KeyRound} label="API keys" value={String(stats.activeApiKeys)} detail="active keys" />
                    <Metric icon={ScrollText} label="Logs 24h" value={String(stats.logs24h)} detail={`${stats.logsTotal} total logs`} />
                </div>

                <Card>
                    <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                        <CardTitle>Storage Usage</CardTitle>
                        <div className="flex gap-2">
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('media.index')}>
                                    <UploadCloud className="h-4 w-4" />
                                    Manage media
                                </Link>
                            </Button>
                            <Button asChild variant="secondary" size="sm">
                                <Link href={route('settings.index')}>
                                    <Settings className="h-4 w-4" />
                                    Public URL
                                </Link>
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between text-sm">
                            <span className="font-medium text-slate-700">{team.storageUsed}</span>
                            <span className="text-slate-500">{team.storagePercent}%</span>
                        </div>
                        <Progress value={team.storagePercent} className="mt-3" />
                        <div className="mt-3 break-all text-xs text-slate-500">
                            Public base URL: {team.publicBaseUrl ?? 'fallback application storage URL'}
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-6 xl:grid-cols-2">
                    <Panel title="Recent Media" action={<Link href={route('media.index')}>View all</Link>}>
                        {files.length === 0 ? (
                            <Empty>No uploads yet.</Empty>
                        ) : (
                            files.map((file) => (
                                <div key={file.id} className="grid grid-cols-[1fr_auto] gap-3 border-b border-slate-100 py-3 last:border-0">
                                    <div className="min-w-0">
                                        <div className="truncate text-sm font-medium text-slate-900">{file.filename}</div>
                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                                            <Badge>{file.type}</Badge>
                                            <span>{file.size}</span>
                                            <span>{file.createdAt}</span>
                                        </div>
                                    </div>
                                    <Button asChild variant="ghost" size="icon">
                                        <a href={file.url} target="_blank" rel="noreferrer">
                                            <ExternalLink className="h-4 w-4" />
                                        </a>
                                    </Button>
                                </div>
                            ))
                        )}
                    </Panel>

                    <Panel title="Recent Logs" action={<Link href={route('logs.index')}>View all</Link>}>
                        {logs.length === 0 ? (
                            <Empty>No logs yet.</Empty>
                        ) : (
                            logs.map((log, index) => (
                                <div key={`${log.createdAt}-${index}`} className="border-b border-slate-100 py-3 last:border-0">
                                    <div className="flex items-center gap-2">
                                        <Badge variant={log.level === 'error' || log.level === 'fatal' ? 'red' : log.level === 'warn' || log.level === 'warning' ? 'amber' : 'default'}>
                                            {log.level}
                                        </Badge>
                                        <span className="text-xs text-slate-500">{log.resource ?? 'server'}</span>
                                        <span className="text-xs text-slate-400">{log.occurredAt ?? log.createdAt}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">{log.message}</p>
                                </div>
                            ))
                        )}
                    </Panel>
                </div>
            </div>
        </AuthenticatedLayout>
    );
}

function Metric({ icon: Icon, label, value, detail }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-950 text-white">
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

function Panel({ title, action, children }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>{title}</CardTitle>
                {action && <div className="text-sm font-medium text-slate-700">{action}</div>}
            </CardHeader>
            <CardContent>{children}</CardContent>
        </Card>
    );
}

function Empty({ children }) {
    return <div className="py-8 text-center text-sm text-slate-500">{children}</div>;
}
