<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LogAlertRule extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'log_webhook_endpoint_id',
        'name',
        'filters',
        'threshold_count',
        'window_minutes',
        'cooldown_minutes',
        'enabled',
        'last_triggered_at',
        'last_count',
        'last_checked_at',
        'message_template',
    ];

    protected $casts = [
        'filters' => 'array',
        'threshold_count' => 'integer',
        'window_minutes' => 'integer',
        'cooldown_minutes' => 'integer',
        'enabled' => 'boolean',
        'last_triggered_at' => 'datetime',
        'last_count' => 'integer',
        'last_checked_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function webhookEndpoint(): BelongsTo
    {
        return $this->belongsTo(LogWebhookEndpoint::class, 'log_webhook_endpoint_id');
    }

    public function inCooldown(): bool
    {
        if (! $this->last_triggered_at || $this->cooldown_minutes <= 0) {
            return false;
        }

        return $this->last_triggered_at->gt(now()->subMinutes($this->cooldown_minutes));
    }
}
