<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
        'expires_at',
        'invalidated_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
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
}
