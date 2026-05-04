import { CopyButton, EmptyState, ExternalButton, Field, KpiCard, PageHeader, Pagination } from '@/Components/Design';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useEffect, useRef, useState } from 'react';
import { Archive, FileAudio, FileBox, FileVideo, Image, Search, Trash2, UploadCloud } from 'lucide-react';

const typeIcons = {
    image: Image,
    video: FileVideo,
    audio: FileAudio,
    file: FileBox,
};

const filterTypes = ['all', 'image', 'video', 'audio', 'file'];

export default function MediaIndex({ auth, filters, team, summary, files }) {
    const { flash } = usePage().props;
    const fileInput = useRef(null);
    const [items, setItems] = useState(files.data);
    const [liveSummary, setLiveSummary] = useState(summary);
    const [liveCount, setLiveCount] = useState(0);
    const uploadForm = useForm({
        uploads: [],
        path: '',
        metadata: '',
        retention_exempt: false,
    });

    useEffect(() => {
        setItems(files.data);
        setLiveSummary(summary);
        setLiveCount(0);
    }, [files.data, summary]);

    useEffect(() => {
        if (!team?.id || !window.Echo) {
            return undefined;
        }

        const channelName = `teams.${team.id}.media`;
        const channel = window.Echo.private(channelName);

        channel
            .listen('.media.created', (event) => {
                if (!event.file) {
                    return;
                }

                setLiveSummary((current) => applyMediaDelta(current, event.file.type, 1));
                setLiveCount((count) => count + 1);

                if (!matchesMediaFilters(event.file, filters)) {
                    return;
                }

                setItems((current) => {
                    if (current.some((file) => file.id === event.file.id)) {
                        return current;
                    }

                    return [event.file, ...current].slice(0, 120);
                });
            })
            .listen('.media.deleted', (event) => {
                if (!event.deleted) {
                    return;
                }

                setLiveSummary((current) => applyMediaDelta(current, event.deleted.type, -1));
                setLiveCount((count) => count + 1);
                setItems((current) => current.filter((file) => file.id !== event.deleted.id && file.publicId !== event.deleted.publicId));
            });

        return () => window.Echo.leave(channelName);
    }, [filters, team?.id]);

    const updateFilters = (next) => {
        router.get(route('media.index'), { ...filters, ...next }, { preserveState: true, replace: true });
    };

    const submitUpload = (event) => {
        event.preventDefault();
        uploadForm.post(route('media.store'), {
            forceFormData: true,
            preserveScroll: true,
            onSuccess: () => {
                uploadForm.reset('uploads', 'metadata');
                if (fileInput.current) fileInput.current.value = '';
            },
        });
    };

    return (
        <AuthenticatedLayout user={auth.user}>
            <Head title="Media" />

            <div className="fb-page">
                <PageHeader
                    eyebrow={team.name}
                    title="Assets & Media"
                    description="Browse, preview, upload, copy public URLs, and remove files stored through FiveBucket."
                    actions={(
                        <div className="fb-page-actions">
                            <Badge>{team.storageUsed} / {team.storageLimit}</Badge>
                            <Badge variant={liveCount > 0 ? 'green' : 'default'}>{liveCount > 0 ? `${liveCount} live updates` : 'Live ready'}</Badge>
                        </div>
                    )}
                />

                <div className="fb-kpis">
                    <KpiCard icon={Archive} label="Total files" value={liveSummary.total} detail="all uploaded assets" />
                    <KpiCard icon={Image} label="Images" value={liveSummary.images} detail="screenshots, photos, evidence" />
                    <KpiCard icon={FileVideo} label="Videos" value={liveSummary.videos} detail="clips and recordings" tone="muted" />
                    <KpiCard icon={FileAudio} label="Audio" value={liveSummary.audio} detail={`${liveSummary.files} other files`} tone="muted" />
                </div>

                {flash.success && <div className="fb-alert success mb-3">{flash.success}</div>}

                <Card className="mb-3">
                    <CardHeader>
                        <div>
                            <CardTitle>Upload From Browser</CardTitle>
                            <p className="fb-panel-subtitle">Images, videos, audio and arbitrary files. Quotas are enforced server-side.</p>
                        </div>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitUpload} className="fb-grid" style={{ gridTemplateColumns: 'minmax(0, 1fr) 280px' }}>
                            <div className="fb-stack">
                                <label className="fb-upload-zone">
                                    <div>
                                        <UploadCloud className="mx-auto h-8 w-8 fb-muted" />
                                        <div className="mt-3 text-[13px] font-semibold text-[var(--fg)]">Choose media files</div>
                                        <div className="mt-1 text-[11px] fb-dim">Multiple uploads supported · R2-backed storage</div>
                                        <input
                                            ref={fileInput}
                                            type="file"
                                            multiple
                                            className="sr-only"
                                            accept="image/*,video/*,audio/*,*/*"
                                            onChange={(event) => uploadForm.setData('uploads', Array.from(event.target.files ?? []))}
                                        />
                                    </div>
                                </label>

                                {uploadForm.data.uploads.length > 0 && (
                                    <div className="fb-panel-content rounded-md border border-[var(--border)] bg-[var(--bg)]">
                                        <div className="fb-label">Selected files</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {uploadForm.data.uploads.map((file) => (
                                                <Badge key={`${file.name}-${file.size}`}>{file.name}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {uploadForm.errors.uploads && <div className="fb-error-text">{uploadForm.errors.uploads}</div>}
                                {uploadForm.progress && (
                                    <div className="fb-progress">
                                        <div className="fb-progress-bar" style={{ width: `${uploadForm.progress.percentage}%` }} />
                                    </div>
                                )}
                            </div>

                            <div className="fb-form-grid">
                                <Field label="Folder path" help="Example: screenshots/police">
                                    <input
                                        className="fb-input"
                                        placeholder="screenshots/police"
                                        value={uploadForm.data.path}
                                        onChange={(event) => uploadForm.setData('path', event.target.value)}
                                    />
                                </Field>

                                <Field label="Metadata JSON" error={uploadForm.errors.metadata}>
                                    <textarea
                                        className="fb-textarea"
                                        placeholder='{"server":"main"}'
                                        value={uploadForm.data.metadata}
                                        onChange={(event) => uploadForm.setData('metadata', event.target.value)}
                                    />
                                </Field>

                                <label className="flex items-center gap-2 text-[12px] fb-muted">
                                    <input
                                        type="checkbox"
                                        checked={uploadForm.data.retention_exempt}
                                        onChange={(event) => uploadForm.setData('retention_exempt', event.target.checked)}
                                        className="rounded border-[var(--border)] bg-[var(--bg)] text-emerald-500"
                                    />
                                    Retention exempt
                                </label>

                                <Button type="submit" disabled={uploadForm.processing || uploadForm.data.uploads.length === 0}>
                                    <UploadCloud className="h-4 w-4" />
                                    Upload media
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <div>
                            <CardTitle>Library</CardTitle>
                            <p className="fb-panel-subtitle">{files.meta.total} matching files · {team.publicBaseUrl ?? 'fallback public URL'}</p>
                        </div>
                        <div className="fb-page-actions">
                            <label className="relative">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 fb-dim" />
                                <input
                                    className="fb-input w-72 pl-9"
                                    placeholder="Search filename, id, path"
                                    defaultValue={filters.search}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') updateFilters({ search: event.currentTarget.value });
                                    }}
                                />
                            </label>
                            <div className="fb-segmented">
                                {filterTypes.map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => updateFilters({ type })}
                                        className={filters.type === type ? 'active' : ''}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {items.length === 0 ? (
                            <EmptyState>No media found.</EmptyState>
                        ) : (
                            <div className="fb-grid cols-3">
                                {items.map((file) => (
                                    <AssetCard key={file.id} file={file} />
                                ))}
                            </div>
                        )}

                        {files.meta.lastPage > 1 && <Pagination links={files.links} />}
                    </CardContent>
                </Card>
            </div>
        </AuthenticatedLayout>
    );
}

function applyMediaDelta(summary, type, delta) {
    const next = { ...summary };
    const key = summaryKeyForType(type);

    next.total = Math.max(0, Number(next.total || 0) + delta);

    if (key) {
        next[key] = Math.max(0, Number(next[key] || 0) + delta);
    }

    return next;
}

function summaryKeyForType(type) {
    return {
        image: 'images',
        video: 'videos',
        audio: 'audio',
        file: 'files',
    }[type];
}

function matchesMediaFilters(file, filters) {
    if (filters.type && filters.type !== 'all' && file.type !== filters.type) {
        return false;
    }

    const query = (filters.search || '').trim().toLowerCase();
    if (!query) {
        return true;
    }

    const haystack = `${file.filename || ''} ${file.publicId || ''} ${file.path || ''}`.toLowerCase();

    return haystack.includes(query);
}

function AssetCard({ file }) {
    const Icon = typeIcons[file.type] ?? FileBox;

    return (
        <div className="fb-media-card">
            <div className="fb-media-preview">
                {file.type === 'image' ? (
                    <img src={file.url} alt={file.filename} loading="lazy" />
                ) : file.type === 'video' ? (
                    <video src={file.url} controls />
                ) : file.type === 'audio' ? (
                    <div className="w-full px-4">
                        <Icon className="mx-auto mb-4 h-10 w-10 fb-muted" />
                        <audio src={file.url} className="w-full" controls />
                    </div>
                ) : (
                    <Icon className="h-12 w-12 fb-muted" />
                )}
            </div>
            <div className="p-3">
                <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[var(--fg)]">{file.filename}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                        <Badge>{file.type}</Badge>
                        <span className="fb-mono text-[10px] fb-dim">{file.size}</span>
                        <span className="fb-mono text-[10px] fb-dim">{file.createdAt}</span>
                    </div>
                </div>
                <code className="fb-inline-code mt-3 block truncate">{file.publicId}</code>
                {file.path && <div className="mt-2 truncate fb-mono text-[10px] fb-dim">{file.path}</div>}
                <div className="mt-3 flex flex-wrap gap-2">
                    <CopyButton value={file.url} label="URL" />
                    <ExternalButton href={file.url} />
                    <Button asChild variant="destructive" size="sm">
                        <Link href={route('media.destroy', file.id)} method="delete" as="button" preserveScroll>
                            <Trash2 className="h-3.5 w-3.5" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
