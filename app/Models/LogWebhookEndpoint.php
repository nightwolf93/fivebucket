<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class LogWebhookEndpoint extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'name',
        'type',
        'url',
        'enabled',
        'last_used_at',
        'last_status_code',
        'failure_count',
        'last_error',
    ];

    protected $casts = [
        'url' => 'encrypted',
        'enabled' => 'boolean',
        'last_used_at' => 'datetime',
        'last_status_code' => 'integer',
        'failure_count' => 'integer',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function alertRules(): HasMany
    {
        return $this->hasMany(LogAlertRule::class);
    }

    public function maskedUrl(): string
    {
        $url = (string) $this->url;

        if ($url === '') {
            return '';
        }

        $host = parse_url($url, PHP_URL_HOST) ?: 'webhook';

        return $host.'/'.Str::mask(substr($url, -12), '*', 0, 8);
    }
}
