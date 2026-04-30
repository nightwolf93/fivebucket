<?php

namespace App\Services;

use App\Models\Plan;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Str;

class TeamProvisioner
{
    public function defaultTeamFor(User $user): Team
    {
        return $user->defaultTeam() ?? $this->createDefaultTeam($user);
    }

    public function createDefaultTeam(User $user): Team
    {
        $plan = Plan::query()->where('slug', 'free')->first();

        if (! $plan) {
            $plan = Plan::create([
                'name' => 'Free',
                'slug' => 'free',
                'included_bytes' => Plan::FREE_BYTES,
                'monthly_price_cents' => 0,
                'overage_price_cents_per_gb' => config('fivebucket.default_overage_price_cents_per_gb'),
                'is_active' => true,
            ]);
        }

        $team = Team::create([
            'owner_id' => $user->id,
            'plan_id' => $plan->id,
            'name' => $user->name."'s server",
            'slug' => $this->uniqueSlug($user->name),
            'storage_limit_bytes' => $plan->included_bytes,
            'billing_status' => 'free',
        ]);

        $team->members()->attach($user->id, ['role' => 'owner']);

        return $team;
    }

    private function uniqueSlug(string $name): string
    {
        $base = Str::slug($name) ?: 'team';

        do {
            $slug = $base.'-'.Str::lower(Str::random(6));
        } while (Team::query()->where('slug', $slug)->exists());

        return $slug;
    }
}
