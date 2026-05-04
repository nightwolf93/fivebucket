<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SdkActionExecution extends Model
{
    use HasFactory;

    public const STATUS_QUEUED = 'queued';

    public const STATUS_DELIVERED = 'delivered';

    public const STATUS_RUNNING = 'running';

    public const STATUS_SUCCEEDED = 'succeeded';

    public const STATUS_FAILED = 'failed';

    public const STATUS_TIMEOUT = 'timeout';

    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'team_id',
        'sdk_session_id',
        'sdk_action_id',
        'requested_by',
        'action_key',
        'action_label',
        'params',
        'status',
        'result',
        'error',
        'requested_at',
        'delivered_at',
        'started_at',
        'completed_at',
        'expires_at',
    ];

    protected $casts = [
        'params' => 'array',
        'result' => 'array',
        'requested_at' => 'datetime',
        'delivered_at' => 'datetime',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'expires_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function sdkSession(): BelongsTo
    {
        return $this->belongsTo(SdkSession::class);
    }

    public function sdkAction(): BelongsTo
    {
        return $this->belongsTo(SdkAction::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function isTerminal(): bool
    {
        return in_array($this->status, [
            self::STATUS_SUCCEEDED,
            self::STATUS_FAILED,
            self::STATUS_TIMEOUT,
            self::STATUS_CANCELLED,
        ], true);
    }
}
