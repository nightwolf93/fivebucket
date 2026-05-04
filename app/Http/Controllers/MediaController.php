<?php

namespace App\Http\Controllers;

use App\Models\MediaFile;
use App\Services\FiveBucketStorage;
use App\Services\TeamProvisioner;
use App\Support\ByteFormatter;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

class MediaController extends Controller
{
    public function __construct(
        private readonly TeamProvisioner $teams,
        private readonly FiveBucketStorage $storage,
    ) {}

    public function index(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());
        $type = $request->query('type');
        $search = trim((string) $request->query('search', ''));

        $query = $team->mediaFiles()->latest();

        if ($type && $type !== 'all') {
            $query->where('type', $type);
        }

        if ($search !== '') {
            $query->where(function ($builder) use ($search) {
                $builder->where('filename', 'like', "%{$search}%")
                    ->orWhere('public_id', 'like', "%{$search}%")
                    ->orWhere('path', 'like', "%{$search}%");
            });
        }

        $files = $query->paginate(24)->withQueryString();

        return Inertia::render('Media/Index', [
            'filters' => [
                'type' => $type ?: 'all',
                'search' => $search,
            ],
            'team' => [
                'id' => $team->id,
                'name' => $team->name,
                'storageUsed' => ByteFormatter::human($team->storage_used_bytes),
                'storageLimit' => ByteFormatter::human($team->storage_limit_bytes),
                'publicBaseUrl' => $team->effectivePublicBaseUrl(),
            ],
            'summary' => [
                'total' => $team->mediaFiles()->count(),
                'images' => $team->mediaFiles()->where('type', 'image')->count(),
                'videos' => $team->mediaFiles()->where('type', 'video')->count(),
                'audio' => $team->mediaFiles()->where('type', 'audio')->count(),
                'files' => $team->mediaFiles()->where('type', 'file')->count(),
            ],
            'files' => [
                'data' => $files->getCollection()->map(fn (MediaFile $file) => [
                    'id' => $file->id,
                    'publicId' => $file->public_id,
                    'filename' => $file->filename,
                    'type' => $file->type,
                    'mimeType' => $file->mime_type,
                    'path' => $file->path,
                    'size' => ByteFormatter::human($file->size_bytes),
                    'sizeBytes' => $file->size_bytes,
                    'url' => $file->deliveryUrl($team),
                    'assetUrl' => $file->assetUrl(),
                    'variantUrl' => $file->type === 'image'
                        ? ($file->isPrivate() ? $file->signedUrl(query: ['w' => 512, 'q' => 80, 'format' => 'webp']) : $file->variantUrl(width: 512, quality: 80))
                        : null,
                    'signedUrl' => $file->isPrivate() ? $file->signedUrl() : null,
                    'signedUrlEndpoint' => route('media.signed-url', $file),
                    'visibility' => $file->visibility ?? 'public',
                    'contentHash' => $file->content_hash,
                    'metadata' => $file->metadata ?? [],
                    'createdAt' => $file->created_at?->diffForHumans(),
                ]),
                'links' => $files->linkCollection(),
                'meta' => [
                    'currentPage' => $files->currentPage(),
                    'lastPage' => $files->lastPage(),
                    'total' => $files->total(),
                ],
            ],
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'uploads' => ['required', 'array', 'min:1', 'max:20'],
            'uploads.*' => ['required', 'file'],
            'path' => ['nullable', 'string', 'max:255'],
            'metadata' => ['nullable', 'string', 'max:10000'],
            'retention_exempt' => ['nullable', 'boolean'],
            'visibility' => ['nullable', 'string', 'in:public,private'],
        ]);

        $metadata = $this->decodeMetadata($validated['metadata'] ?? null);

        if ($metadata === false) {
            return back()->withErrors(['metadata' => 'Metadata must be a valid JSON object.'])->withInput();
        }

        $team = $this->teams->defaultTeamFor($request->user());
        $uploaded = 0;
        $deduplicated = 0;

        try {
            foreach ($request->file('uploads', []) as $upload) {
                $mediaFile = $this->storage->storeUploadedFile($team, null, $upload, [
                    'path' => $validated['path'] ?? null,
                    'metadata' => $metadata,
                    'retention_exempt' => (bool) ($validated['retention_exempt'] ?? false),
                    'visibility' => $validated['visibility'] ?? 'public',
                ]);

                $mediaFile->wasRecentlyCreated ? $uploaded++ : $deduplicated++;
            }
        } catch (HttpExceptionInterface $exception) {
            return back()->withErrors(['uploads' => $exception->getMessage()])->withInput();
        }

        return back()->with('success', trim($uploaded.' media uploaded'.($deduplicated > 0 ? " · {$deduplicated} duplicate reused" : '').'.'));
    }

    public function update(Request $request, MediaFile $mediaFile): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($mediaFile->team_id === $team->id, 404);

        $validated = $request->validate([
            'visibility' => ['required', 'string', 'in:public,private'],
        ]);

        $this->storage->updateVisibility($mediaFile, $validated['visibility']);

        return back()->with('success', 'Media visibility updated.');
    }

    public function signedUrl(Request $request, MediaFile $mediaFile): JsonResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($mediaFile->team_id === $team->id, 404);

        $expires = max(60, min(604800, (int) $request->query('expires', 900)));
        $query = array_filter([
            'w' => $request->query('w'),
            'h' => $request->query('h'),
            'q' => $request->query('q'),
            'format' => $request->query('format'),
        ], fn ($value) => $value !== null && $value !== '');

        return response()->json([
            'status' => 'ok',
            'url' => $mediaFile->signedUrl($expires, $query),
            'expiresIn' => $expires,
        ]);
    }

    public function destroy(Request $request, MediaFile $mediaFile): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($mediaFile->team_id === $team->id, 404);

        $this->storage->delete($mediaFile);

        return back()->with('success', 'Media deleted.');
    }

    private function decodeMetadata(?string $metadata): array|false|null
    {
        if (! $metadata) {
            return null;
        }

        $decoded = json_decode($metadata, true);

        return is_array($decoded) && array_keys($decoded) !== range(0, count($decoded) - 1) ? $decoded : false;
    }
}
