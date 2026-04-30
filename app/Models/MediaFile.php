<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

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
        'metadata',
        'retention_exempt',
        'url',
        'original_url',
    ];

    protected $casts = [
        'size_bytes' => 'integer',
        'metadata' => 'array',
        'retention_exempt' => 'boolean',
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

    public function compatibilityPayload(): array
    {
        $url = $this->deliveryUrl();

        return [
            'id' => $this->public_id,
            'filename' => $this->filename,
            'type' => $this->type,
            'size' => $this->size_bytes,
            'metadata' => $this->metadata ?? new \stdClass(),
            'url' => $url,
            'originalUrl' => $url,
        ];
    }

    public function deliveryUrl(?Team $team = null): string
    {
        $team ??= $this->relationLoaded('team') ? $this->team : null;
        $baseUrl = $team?->effectivePublicBaseUrl() ?: config('fivebucket.public_base_url');

        if ($baseUrl) {
            return rtrim($baseUrl, '/').'/'.str_replace('%2F', '/', rawurlencode($this->storage_key));
        }

        return $this->url ?? '';
    }
}
