<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    use HasFactory;

    public const FREE_BYTES = 1073741824;
    public const GROWTH_BYTES = 10737418240;
    public const SCALE_BYTES = 107374182400;

    protected $fillable = [
        'name',
        'slug',
        'included_bytes',
        'monthly_price_cents',
        'overage_price_cents_per_gb',
        'max_upload_bytes',
        'stripe_price_id',
        'is_active',
    ];

    protected $casts = [
        'included_bytes' => 'integer',
        'monthly_price_cents' => 'integer',
        'overage_price_cents_per_gb' => 'integer',
        'max_upload_bytes' => 'integer',
        'is_active' => 'boolean',
    ];

    public function teams(): HasMany
    {
        return $this->hasMany(Team::class);
    }
}
