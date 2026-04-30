import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import { Head, Link, router, useForm, usePage } from '@inertiajs/react';
import { useRef } from 'react';
import { Copy, ExternalLink, FileAudio, FileBox, FileVideo, Image, Search, Trash2, UploadCloud } from 'lucide-react';

const typeIcons = {
    image: Image,
    video: FileVideo,
    audio: FileAudio,
    file: FileBox,
};

export default function MediaIndex({ auth, filters, team, summary, files }) {
    const { flash } = usePage().props;
    const fileInput = useRef(null);
    const uploadForm = useForm({
        uploads: [],
        path: '',
        metadata: '',
        retention_exempt: false,
    });

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

            <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
                <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
                    <div>
                        <p className="text-sm font-medium text-slate-500">{team.name}</p>
                        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Assets & Media</h1>
                        <p className="mt-2 text-sm text-slate-600">Browse, preview, copy public URLs, and remove uploaded files.</p>
                    </div>
                    <Badge>{team.storageUsed} / {team.storageLimit}</Badge>
                </div>

                <div className="grid gap-4 md:grid-cols-4">
                    <Summary label="Images" value={summary.images} />
                    <Summary label="Videos" value={summary.videos} />
                    <Summary label="Audio" value={summary.audio} />
                    <Summary label="Other files" value={summary.files} />
                </div>

                {flash.success && (
                    <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
                        {flash.success}
                    </div>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Upload From Browser</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={submitUpload} className="grid gap-4 lg:grid-cols-[1fr_220px]">
                            <div className="space-y-4">
                                <label className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:bg-slate-100">
                                    <UploadCloud className="h-8 w-8 text-slate-500" />
                                    <span className="mt-3 text-sm font-medium text-slate-800">Choose images, videos, audio, or files</span>
                                    <span className="mt-1 text-xs text-slate-500">Multiple uploads are supported. Quotas are enforced per account.</span>
                                    <input
                                        ref={fileInput}
                                        type="file"
                                        multiple
                                        className="sr-only"
                                        accept="image/*,video/*,audio/*,*/*"
                                        onChange={(event) => uploadForm.setData('uploads', Array.from(event.target.files ?? []))}
                                    />
                                </label>

                                {uploadForm.data.uploads.length > 0 && (
                                    <div className="rounded-md border border-slate-200 bg-white p-3">
                                        <div className="text-xs font-medium text-slate-500">Selected files</div>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                            {uploadForm.data.uploads.map((file) => (
                                                <Badge key={`${file.name}-${file.size}`}>{file.name}</Badge>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {uploadForm.errors.uploads && <div className="text-sm text-red-600">{uploadForm.errors.uploads}</div>}
                                {uploadForm.progress && (
                                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${uploadForm.progress.percentage}%` }} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-4">
                                <label className="block text-sm font-medium text-slate-700">
                                    Folder path
                                    <input
                                        className="mt-1 h-10 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                        placeholder="screenshots/police"
                                        value={uploadForm.data.path}
                                        onChange={(event) => uploadForm.setData('path', event.target.value)}
                                    />
                                </label>

                                <label className="block text-sm font-medium text-slate-700">
                                    Metadata JSON
                                    <textarea
                                        className="mt-1 min-h-24 w-full rounded-md border-slate-300 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500"
                                        placeholder='{"server":"main"}'
                                        value={uploadForm.data.metadata}
                                        onChange={(event) => uploadForm.setData('metadata', event.target.value)}
                                    />
                                    {uploadForm.errors.metadata && <span className="mt-1 block text-xs text-red-600">{uploadForm.errors.metadata}</span>}
                                </label>

                                <label className="flex items-center gap-2 text-sm text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={uploadForm.data.retention_exempt}
                                        onChange={(event) => uploadForm.setData('retention_exempt', event.target.checked)}
                                        className="rounded border-slate-300 text-slate-950"
                                    />
                                    Exempt from retention cleanup
                                </label>

                                <Button type="submit" disabled={uploadForm.processing || uploadForm.data.uploads.length === 0} className="w-full">
                                    <UploadCloud className="h-4 w-4" />
                                    Upload media
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <CardTitle>Library</CardTitle>
                        <div className="flex flex-col gap-2 md:flex-row md:items-center">
                            <div className="relative">
                                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                                <input
                                    className="h-9 w-full rounded-md border-slate-300 pl-9 text-sm shadow-sm focus:border-slate-500 focus:ring-slate-500 md:w-72"
                                    placeholder="Search filename, id, path"
                                    defaultValue={filters.search}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') updateFilters({ search: event.currentTarget.value });
                                    }}
                                />
                            </div>
                            <div className="flex gap-1 rounded-md border border-slate-200 bg-white p-1">
                                {['all', 'image', 'video', 'audio', 'file'].map((type) => (
                                    <button
                                        key={type}
                                        type="button"
                                        onClick={() => updateFilters({ type })}
                                        className={`h-8 rounded px-3 text-xs font-medium ${filters.type === type ? 'bg-slate-950 text-white' : 'text-slate-600 hover:bg-slate-100'}`}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent>
                        {files.data.length === 0 ? (
                            <Empty>No media found.</Empty>
                        ) : (
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                {files.data.map((file) => (
                                    <AssetCard key={file.id} file={file} />
                                ))}
                            </div>
                        )}

                        {files.meta.lastPage > 1 && (
                            <div className="mt-6 flex flex-wrap gap-2">
                                {files.links.map((link, index) => (
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
            </div>
        </AuthenticatedLayout>
    );
}

function AssetCard({ file }) {
    const Icon = typeIcons[file.type] ?? FileBox;

    return (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <div className="flex aspect-video items-center justify-center bg-slate-100">
                {file.type === 'image' ? (
                    <img src={file.url} alt={file.filename} className="h-full w-full object-cover" loading="lazy" />
                ) : file.type === 'video' ? (
                    <video src={file.url} className="h-full w-full object-cover" controls />
                ) : file.type === 'audio' ? (
                    <div className="w-full px-4">
                        <Icon className="mx-auto mb-4 h-10 w-10 text-slate-500" />
                        <audio src={file.url} className="w-full" controls />
                    </div>
                ) : (
                    <Icon className="h-12 w-12 text-slate-500" />
                )}
            </div>
            <div className="space-y-3 p-4">
                <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-slate-950">{file.filename}</div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                        <Badge>{file.type}</Badge>
                        <span>{file.size}</span>
                        <span>{file.createdAt}</span>
                    </div>
                </div>
                <code className="block truncate rounded-md bg-slate-50 px-2 py-1 text-xs text-slate-500">{file.publicId}</code>
                <div className="flex gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => navigator.clipboard?.writeText(file.url)}>
                        <Copy className="h-4 w-4" />
                        Copy URL
                    </Button>
                    <Button asChild type="button" variant="secondary" size="sm">
                        <a href={file.url} target="_blank" rel="noreferrer">
                            <ExternalLink className="h-4 w-4" />
                            Open
                        </a>
                    </Button>
                    <Button asChild variant="destructive" size="sm">
                        <Link href={route('media.destroy', file.id)} method="delete" as="button" preserveScroll>
                            <Trash2 className="h-4 w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

function Summary({ label, value }) {
    return (
        <Card>
            <CardContent>
                <div className="text-sm text-slate-500">{label}</div>
                <div className="mt-1 text-2xl font-semibold text-slate-950">{value}</div>
            </CardContent>
        </Card>
    );
}

function Empty({ children }) {
    return <div className="py-14 text-center text-sm text-slate-500">{children}</div>;
}
