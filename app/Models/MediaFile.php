<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\URL;

class MediaFile extends Model
{
    use HasFactory;
    use SoftDeletes;

    protected $fillable = [
        'team_id',
        'api_token_id',
        'public_id',
        'filename',
        'storage_key',
        'path',
        'mime_type',
        'extension',
        'type',
        'size_bytes',
        'content_hash',
        'metadata',
        'retention_exempt',
        'visibility',
        'duplicate_of_id',
        'url',
        'original_url',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'metadata' => 'array',
        'retention_exempt' => 'boolean',
        'duplicate_of_id' => 'integer',
        'deleted_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function apiToken(): BelongsTo
    {
        return $this->belongsTo(ApiToken::class);
    }

    public function duplicateOf(): BelongsTo
    {
        return $this->belongsTo(self::class, 'duplicate_of_id');
    }

    public function compatibilityPayload(): array
    {
        $url = $this->deliveryUrl();

        return [
            'id' => $this->public_id,
            'filename' => $this->filename,
            'type' => $this->type,
            'size' => $this->size_bytes,
            'metadata' => $this->metadata ?? new \stdClass,
            'url' => $url,
            'originalUrl' => $url,
            'assetUrl' => $this->assetUrl(),
            'variantUrl' => $this->type === 'image'
                ? ($this->isPrivate() ? $this->signedUrl(query: ['w' => 512, 'q' => 80, 'format' => 'webp']) : $this->variantUrl(width: 512, quality: 80))
                : null,
            'signedUrl' => $this->isPrivate() ? $this->signedUrl() : null,
            'visibility' => $this->visibility ?? 'public',
            'contentHash' => $this->content_hash,
        ];
    }

    public function deliveryUrl(?Team $team = null): string
    {
        if ($this->isPrivate()) {
            return $this->signedUrl();
        }

        $team ??= $this->relationLoaded('team') ? $this->team : Team::query()->find($this->team_id);
        $baseUrl = $team?->effectivePublicBaseUrl() ?: config('fivebucket.public_base_url');

        if ($baseUrl) {
            return rtrim($baseUrl, '/').'/'.str_replace('%2F', '/', rawurlencode($this->storage_key));
        }

        return $this->url ?? '';
    }

    public function assetUrl(array $query = []): string
    {
        return route('assets.show', ['mediaFile' => $this->public_id, ...$query]);
    }

    public function variantUrl(?int $width = null, ?int $height = null, int $quality = 80): string
    {
        return $this->assetUrl(array_filter([
            'w' => $width,
            'h' => $height,
            'q' => $quality,
            'format' => 'webp',
        ], fn ($value) => $value !== null && $value !== ''));
    }

    public function signedUrl(?int $expiresInSeconds = null, array $query = []): string
    {
        $expiresInSeconds ??= (int) config('fivebucket.signed_download_ttl_seconds', 900);

        return URL::temporarySignedRoute(
            'assets.show',
            now()->addSeconds(max(60, min(604800, $expiresInSeconds))),
            ['mediaFile' => $this->public_id, ...$query],
        );
    }

    public function isPrivate(): bool
    {
        return ($this->visibility ?? 'public') === 'private';
    }
}
