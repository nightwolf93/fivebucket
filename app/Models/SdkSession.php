<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdkSession extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'api_token_id',
        'token_hash',
        'sdk_type',
        'endpoint',
        'resource_name',
        'universe_id',
        'job_id',
        'metadata',
        'expires_at',
        'last_seen_at',
        'invalidated_at',
    ];

    protected $casts = [
        'metadata' => 'array',
        'expires_at' => 'datetime',
        'last_seen_at' => 'datetime',
        'invalidated_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function apiToken(): BelongsTo
    {
        return $this->belongsTo(ApiToken::class);
    }

    public function actions(): HasMany
    {
        return $this->hasMany(SdkAction::class);
    }

    public function actionExecutions(): HasMany
    {
        return $this->hasMany(SdkActionExecution::class);
    }

    public function isOnline(): bool
    {
        return $this->invalidated_at === null && $this->expires_at !== null && $this->expires_at->isFuture();
    }
}
