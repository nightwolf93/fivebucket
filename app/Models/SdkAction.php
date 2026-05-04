<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SdkAction extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'sdk_session_id',
        'action_key',
        'label',
        'description',
        'category',
        'schema',
        'metadata',
        'dangerous',
        'requires_confirmation',
        'timeout_seconds',
        'enabled',
        'last_seen_at',
    ];

    protected $casts = [
        'schema' => 'array',
        'metadata' => 'array',
        'dangerous' => 'boolean',
        'requires_confirmation' => 'boolean',
        'timeout_seconds' => 'integer',
        'enabled' => 'boolean',
        'last_seen_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function sdkSession(): BelongsTo
    {
        return $this->belongsTo(SdkSession::class);
    }

    public function executions(): HasMany
    {
        return $this->hasMany(SdkActionExecution::class);
    }
}
