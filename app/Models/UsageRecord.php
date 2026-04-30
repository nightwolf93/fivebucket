<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class UsageRecord extends Model
{
    use HasFactory;

    protected $fillable = [
        'team_id',
        'metric',
        'delta',
        'reason',
        'subject_type',
        'subject_id',
        'metadata',
    ];

    protected $casts = [
        'delta' => 'integer',
        'metadata' => 'array',
    ];

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }
}
