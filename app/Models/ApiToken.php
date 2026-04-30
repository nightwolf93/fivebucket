<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Arr;
use Illuminate\Support\Str;

class ApiToken extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'created_by',
        'name',
        'prefix',
        'token_hash',
        'encrypted_token',
        'scopes',
        'last_used_at',
        'revoked_at',
    ];

    protected $casts = [
        'scopes' => 'array',
        'encrypted_token' => 'encrypted',
        'last_used_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function issue(Team $team, ?User $user, string $name, array $scopes = ['media', 'logs', 'sdk']): array
    {
        $plain = 'fbk_'.Str::random(48);

        $token = self::create([
            'team_id' => $team->id,
            'created_by' => $user?->id,
            'name' => $name,
            'prefix' => substr($plain, 0, 12),
            'token_hash' => hash('sha256', $plain),
            'encrypted_token' => $plain,
            'scopes' => array_values(array_unique($scopes)),
        ]);

        return [$token, $plain];
    }

    public static function findActiveByPlainText(string $plainText): ?self
    {
        return self::query()
            ->where('token_hash', hash('sha256', $plainText))
            ->whereNull('revoked_at')
            ->with('team.plan')
            ->first();
    }

    public function allows(string $scope): bool
    {
        $scopes = $this->scopes ?? [];

        return in_array('*', $scopes, true)
            || in_array($scope, $scopes, true)
            || (Str::startsWith($scope, 'file:') && in_array('media', $scopes, true));
    }

    public function scopeLabel(): string
    {
        return implode(', ', Arr::wrap($this->scopes));
    }

    public function canRevealSecret(): bool
    {
        return $this->revoked_at === null && $this->encrypted_token !== null;
    }
}
