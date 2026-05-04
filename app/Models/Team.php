<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Team extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id',
        'plan_id',
        'name',
        'slug',
        'storage_used_bytes',
        'storage_limit_bytes',
        'billing_status',
        'stripe_customer_id',
        'public_base_url',
        'custom_domain',
        'custom_domain_verified_at',
        'settings',
    ];

    protected $casts = [
        'storage_used_bytes' => 'integer',
        'storage_limit_bytes' => 'integer',
        'custom_domain_verified_at' => 'datetime',
        'settings' => 'array',
    ];

    public function effectivePublicBaseUrl(): ?string
    {
        return $this->public_base_url ?: ($this->custom_domain ? 'https://'.$this->custom_domain : null);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(Plan::class);
    }

    public function members(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'team_members')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function apiTokens(): HasMany
    {
        return $this->hasMany(ApiToken::class);
    }

    public function mediaFiles(): HasMany
    {
        return $this->hasMany(MediaFile::class);
    }

    public function logEntries(): HasMany
    {
        return $this->hasMany(LogEntry::class);
    }

    public function logSavedViews(): HasMany
    {
        return $this->hasMany(LogSavedView::class);
    }

    public function logWebhookEndpoints(): HasMany
    {
        return $this->hasMany(LogWebhookEndpoint::class);
    }

    public function logAlertRules(): HasMany
    {
        return $this->hasMany(LogAlertRule::class);
    }

    public function usageRecords(): HasMany
    {
        return $this->hasMany(UsageRecord::class);
    }

    public function remainingStorageBytes(): int
    {
        return max(0, $this->storage_limit_bytes - $this->storage_used_bytes);
    }

    public function hasStorageFor(int $bytes): bool
    {
        return $bytes <= $this->remainingStorageBytes();
    }
}
