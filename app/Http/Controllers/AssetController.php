<?php

namespace App\Http\Controllers;

use App\Models\MediaFile;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\Response;

class AssetController extends Controller
{
    public function show(Request $request, MediaFile $mediaFile): Response
    {
        $mediaFile->loadMissing('team');

        if ($mediaFile->isPrivate() && ! $request->hasValidSignature()) {
            abort(403, 'A signed URL is required for this private media.');
        }

        $variantKey = $this->variantKeyForRequest($request, $mediaFile);

        if ($variantKey) {
            return $this->stream($mediaFile, $variantKey, 'image/webp', 'variant_served');
        }

        return $this->stream($mediaFile, $mediaFile->storage_key, (string) ($mediaFile->mime_type ?: 'application/octet-stream'), 'asset_served');
    }

    private function variantKeyForRequest(Request $request, MediaFile $mediaFile): ?string
    {
        if ($mediaFile->type !== 'image') {
            return null;
        }

        if (! $request->filled('w') && ! $request->filled('width') && ! $request->filled('h') && ! $request->filled('height') && ! $request->filled('q') && $request->query('format') !== 'webp') {
            return null;
        }

        if ($mediaFile->size_bytes > (int) config('fivebucket.variant_source_max_bytes', 31457280)) {
            return null;
        }

        $width = $this->dimension($request->query('w', $request->query('width')));
        $height = $this->dimension($request->query('h', $request->query('height')));
        $quality = max(1, min(100, (int) $request->query('q', 80)));

        if (! $width && ! $height && $request->query('format') !== 'webp') {
            return null;
        }

        $variantKey = sprintf(
            '_variants/%d/%s/%sx%s-q%d.webp',
            $mediaFile->team_id,
            $mediaFile->public_id,
            $width ?: 'auto',
            $height ?: 'auto',
            $quality,
        );

        if (Storage::disk($this->disk())->exists($variantKey)) {
            return $variantKey;
        }

        return $this->createWebpVariant($mediaFile, $variantKey, $width, $height, $quality);
    }

    private function createWebpVariant(MediaFile $mediaFile, string $variantKey, ?int $width, ?int $height, int $quality): ?string
    {
        if (! function_exists('imagecreatefromstring') || ! function_exists('imagewebp')) {
            return null;
        }

        $bytes = Storage::disk($this->disk())->get($mediaFile->storage_key);
        $source = @imagecreatefromstring($bytes);

        if (! $source) {
            return null;
        }

        try {
            $sourceWidth = imagesx($source);
            $sourceHeight = imagesy($source);

            [$targetWidth, $targetHeight] = $this->targetDimensions($sourceWidth, $sourceHeight, $width, $height);
            $target = imagecreatetruecolor($targetWidth, $targetHeight);

            imagealphablending($target, false);
            imagesavealpha($target, true);
            imagecopyresampled($target, $source, 0, 0, 0, 0, $targetWidth, $targetHeight, $sourceWidth, $sourceHeight);

            ob_start();
            imagewebp($target, null, $quality);
            $encoded = ob_get_clean();
            imagedestroy($target);

            if (! is_string($encoded) || $encoded === '') {
                return null;
            }

            Storage::disk($this->disk())->put($variantKey, $encoded, [
                'visibility' => 'public',
                'ContentType' => 'image/webp',
            ]);

            return $variantKey;
        } finally {
            imagedestroy($source);
        }
    }

    private function stream(MediaFile $mediaFile, string $storageKey, string $mime, string $reason): Response
    {
        $disk = Storage::disk($this->disk());

        if (! $disk->exists($storageKey)) {
            abort(404);
        }

        $stream = $disk->readStream($storageKey);

        if (! $stream) {
            abort(404);
        }

        $size = $this->safeSize($storageKey);
        $this->recordBandwidth($mediaFile, $size, $reason);

        return response()->stream(function () use ($stream): void {
            fpassthru($stream);
            fclose($stream);
        }, 200, array_filter([
            'Content-Type' => $mime,
            'Content-Length' => $size > 0 ? (string) $size : null,
            'Cache-Control' => $mediaFile->isPrivate() ? 'private, max-age=300' : 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]));
    }

    private function targetDimensions(int $sourceWidth, int $sourceHeight, ?int $width, ?int $height): array
    {
        if (! $width && ! $height) {
            return [$sourceWidth, $sourceHeight];
        }

        if ($width && ! $height) {
            $height = (int) round($sourceHeight * ($width / $sourceWidth));
        }

        if ($height && ! $width) {
            $width = (int) round($sourceWidth * ($height / $sourceHeight));
        }

        $width = max(1, min(4096, (int) $width));
        $height = max(1, min(4096, (int) $height));

        return [$width, $height];
    }

    private function dimension(mixed $value): ?int
    {
        $value = (int) $value;

        return $value > 0 ? max(16, min(4096, $value)) : null;
    }

    private function safeSize(string $storageKey): int
    {
        try {
            return (int) Storage::disk($this->disk())->size($storageKey);
        } catch (\Throwable) {
            return 0;
        }
    }

    private function recordBandwidth(MediaFile $mediaFile, int $size, string $reason): void
    {
        if ($size <= 0 || ! $mediaFile->team) {
            return;
        }

        try {
            $mediaFile->team->usageRecords()->create([
                'metric' => 'bandwidth_bytes',
                'delta' => $size,
                'reason' => $reason,
                'subject_type' => MediaFile::class,
                'subject_id' => $mediaFile->id,
                'metadata' => [
                    'public_id' => $mediaFile->public_id,
                    'storage_key' => $mediaFile->storage_key,
                ],
            ]);
        } catch (\Throwable $exception) {
            report($exception);
        }
    }

    private function disk(): string
    {
        return config('fivebucket.storage_disk', 'public');
    }
}
