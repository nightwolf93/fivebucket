<?php

namespace App\Services;

use App\Models\ApiToken;
use App\Models\MediaFile;
use App\Models\Team;
use Carbon\CarbonImmutable;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;

class FiveBucketStorage
{
    public function storeUploadedFile(Team $team, ?ApiToken $apiToken, UploadedFile $file, array $options = []): MediaFile
    {
        $size = $file->getSize() ?? filesize($file->getRealPath());
        $filename = $this->sanitizeFilename($options['filename'] ?? $file->getClientOriginalName() ?: 'upload');
        $mime = $file->getMimeType() ?: $file->getClientMimeType() ?: 'application/octet-stream';
        $extension = $this->extensionFor($filename, $mime);
        $contents = fopen($file->getRealPath(), 'rb');

        return $this->persist($team, $apiToken, $contents, $size, $filename, $mime, $extension, $options);
    }

    public function storeBase64(Team $team, ?ApiToken $apiToken, string $base64, array $options = []): MediaFile
    {
        $mime = null;
        $payload = $base64;

        if (preg_match('/^data:(?<mime>[-\w.\/+]+);base64,(?<data>.*)$/s', $base64, $matches)) {
            $mime = $matches['mime'];
            $payload = $matches['data'];
        }

        $contents = base64_decode($payload, true);

        if ($contents === false) {
            throw new HttpException(400, 'Invalid base64 payload.');
        }

        $mime ??= $options['mime_type'] ?? 'application/octet-stream';
        $filename = $this->sanitizeFilename($options['filename'] ?? 'upload.'.$this->extensionFromMime($mime));
        $extension = $this->extensionFor($filename, $mime);

        return $this->persist($team, $apiToken, $contents, strlen($contents), $filename, $mime, $extension, $options);
    }

    public function findForTeam(Team $team, string $path): ?MediaFile
    {
        return MediaFile::query()
            ->where('team_id', $team->id)
            ->where(function ($query) use ($path) {
                $query->where('public_id', $path)
                    ->orWhere('storage_key', $path);
            })
            ->first();
    }

    public function delete(MediaFile $file): void
    {
        DB::transaction(function () use ($file): void {
            $lockedFile = MediaFile::query()->whereKey($file->id)->lockForUpdate()->firstOrFail();

            if ($lockedFile->trashed()) {
                return;
            }

            Storage::disk($this->disk())->delete($lockedFile->storage_key);
            $lockedFile->delete();

            $team = Team::query()->whereKey($lockedFile->team_id)->lockForUpdate()->firstOrFail();
            $team->storage_used_bytes = max(0, $team->storage_used_bytes - $lockedFile->size_bytes);
            $team->save();

            $team->usageRecords()->create([
                'metric' => 'storage_bytes',
                'delta' => -$lockedFile->size_bytes,
                'reason' => 'file_deleted',
                'subject_type' => MediaFile::class,
                'subject_id' => $lockedFile->id,
            ]);
        });
    }

    public function createPresignedUrl(Team $team, ?ApiToken $apiToken, ?int $expiresAt = null, ?string $fileType = null, string $path = '/api/v3/file/presigned-url'): string
    {
        $expires = $expiresAt ? CarbonImmutable::createFromTimestamp($expiresAt) : now()->addMinutes(config('fivebucket.presigned_ttl_minutes'));
        $payload = $this->base64UrlEncode(json_encode([
            'team_id' => $team->id,
            'api_token_id' => $apiToken?->id,
            'file_type' => $fileType,
            'expires_at' => $expires->timestamp,
        ], JSON_THROW_ON_ERROR));
        $signature = hash_hmac('sha256', $payload, $this->tokenSecret());

        return url(trim($path, '/').'/'.$payload.'.'.$signature);
    }

    public function resolvePresignedToken(string $token): array
    {
        [$payload, $signature] = array_pad(explode('.', $token, 2), 2, null);

        if (! $payload || ! $signature || ! hash_equals(hash_hmac('sha256', $payload, $this->tokenSecret()), $signature)) {
            throw new HttpException(401, 'Invalid presigned upload token.');
        }

        $decoded = json_decode($this->base64UrlDecode($payload), true);

        if (! is_array($decoded) || empty($decoded['team_id']) || empty($decoded['expires_at'])) {
            throw new HttpException(401, 'Invalid presigned upload token.');
        }

        if ((int) $decoded['expires_at'] < now()->timestamp) {
            throw new HttpException(403, 'Presigned upload token has expired.');
        }

        $team = Team::query()->with('plan')->findOrFail($decoded['team_id']);
        $apiToken = ! empty($decoded['api_token_id']) ? ApiToken::query()->find($decoded['api_token_id']) : null;

        return [$team, $apiToken, $decoded];
    }

    public function metadata(mixed $value): ?array
    {
        if ($value === null || $value === '') {
            return null;
        }

        if (is_array($value)) {
            return $value;
        }

        $decoded = json_decode((string) $value, true);

        if (! is_array($decoded)) {
            throw new HttpException(422, 'metadata must be a JSON object.');
        }

        return $decoded;
    }

    public function truthy(mixed $value): bool
    {
        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }

    private function persist(Team $team, ?ApiToken $apiToken, mixed $contents, int $size, string $filename, string $mime, ?string $extension, array $options): MediaFile
    {
        if ($size <= 0) {
            throw new HttpException(400, 'File is empty.');
        }

        return DB::transaction(function () use ($team, $apiToken, $contents, $size, $filename, $mime, $extension, $options): MediaFile {
            $lockedTeam = Team::query()->whereKey($team->id)->lockForUpdate()->firstOrFail();

            if (! $lockedTeam->hasStorageFor($size)) {
                throw new HttpException(413, 'Storage quota exceeded.');
            }

            $publicId = $this->uniquePublicId();
            $path = $this->sanitizePath($options['path'] ?? null);
            $storageKey = $this->storageKey($lockedTeam, $publicId, $extension, $path);
            $type = $this->classify($mime);

            Storage::disk($this->disk())->put($storageKey, $contents, [
                'visibility' => 'public',
                'ContentType' => $mime,
            ]);

            $url = $this->publicUrl($storageKey, $lockedTeam);

            $file = MediaFile::create([
                'team_id' => $lockedTeam->id,
                'api_token_id' => $apiToken?->id,
                'public_id' => $publicId,
                'filename' => $filename,
                'storage_key' => $storageKey,
                'path' => $path,
                'mime_type' => $mime,
                'extension' => $extension,
                'type' => $type,
                'size_bytes' => $size,
                'metadata' => $this->metadata($options['metadata'] ?? null),
                'retention_exempt' => $this->truthy($options['retentionExempt'] ?? $options['retention_exempt'] ?? false),
                'url' => $url,
                'original_url' => $url,
            ]);

            $lockedTeam->increment('storage_used_bytes', $size);
            $lockedTeam->usageRecords()->create([
                'metric' => 'storage_bytes',
                'delta' => $size,
                'reason' => 'file_uploaded',
                'subject_type' => MediaFile::class,
                'subject_id' => $file->id,
            ]);

            return $file;
        });
    }

    private function uniquePublicId(): string
    {
        do {
            $id = Str::random(20);
        } while (MediaFile::query()->where('public_id', $id)->exists());

        return $id;
    }

    private function storageKey(Team $team, string $publicId, ?string $extension, ?string $path): string
    {
        $filename = $publicId.($extension ? '.'.$extension : '');
        $segments = array_filter([(string) $team->id, $path, $filename]);

        return implode('/', $segments);
    }

    private function sanitizeFilename(string $filename): string
    {
        $filename = basename(str_replace('\\', '/', $filename));
        $filename = preg_replace('/[^A-Za-z0-9._-]+/', '_', $filename) ?: 'upload';

        return trim($filename, '._') ?: 'upload';
    }

    private function sanitizePath(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        $segments = collect(explode('/', str_replace('\\', '/', $path)))
            ->map(fn (string $segment) => trim(preg_replace('/[^A-Za-z0-9._-]+/', '_', $segment), '._'))
            ->filter()
            ->values();

        return $segments->isEmpty() ? null : $segments->implode('/');
    }

    private function classify(string $mime): string
    {
        return match (true) {
            str_starts_with($mime, 'image/') => 'image',
            str_starts_with($mime, 'video/') => 'video',
            str_starts_with($mime, 'audio/') => 'audio',
            default => 'file',
        };
    }

    private function extensionFor(string $filename, string $mime): ?string
    {
        $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));

        return $extension ?: $this->extensionFromMime($mime);
    }

    private function extensionFromMime(string $mime): string
    {
        return match ($mime) {
            'image/jpeg' => 'jpg',
            'image/png' => 'png',
            'image/gif' => 'gif',
            'image/webp' => 'webp',
            'video/mp4' => 'mp4',
            'video/webm' => 'webm',
            'audio/mpeg' => 'mp3',
            'audio/ogg' => 'ogg',
            'audio/wav', 'audio/x-wav' => 'wav',
            default => 'bin',
        };
    }

    private function publicUrl(string $storageKey, Team $team): string
    {
        $baseUrl = $team->effectivePublicBaseUrl() ?: config('fivebucket.public_base_url');

        if ($baseUrl) {
            return rtrim($baseUrl, '/').'/'.str_replace('%2F', '/', rawurlencode($storageKey));
        }

        return Storage::disk($this->disk())->url($storageKey);
    }

    private function disk(): string
    {
        return config('fivebucket.storage_disk', 'public');
    }

    private function tokenSecret(): string
    {
        return (string) config('fivebucket.token_secret');
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function base64UrlDecode(string $value): string
    {
        return base64_decode(strtr($value, '-_', '+/').str_repeat('=', (4 - strlen($value) % 4) % 4));
    }
}
