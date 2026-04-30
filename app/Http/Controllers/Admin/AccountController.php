<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\Team;
use App\Models\User;
use App\Support\ByteFormatter;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AccountController extends Controller
{
    public function index(): Response
    {
        $teams = Team::query()
            ->with(['owner', 'plan'])
            ->withCount(['apiTokens', 'mediaFiles', 'logEntries'])
            ->latest()
            ->get();

        return Inertia::render('Admin/Accounts', [
            'plans' => Plan::query()
                ->where('is_active', true)
                ->orderBy('included_bytes')
                ->get()
                ->map(fn (Plan $plan) => [
                    'id' => $plan->id,
                    'name' => $plan->name,
                    'slug' => $plan->slug,
                    'included' => ByteFormatter::human($plan->included_bytes),
                    'includedBytes' => $plan->included_bytes,
                ]),
            'users' => User::query()
                ->withCount(['ownedTeams'])
                ->latest()
                ->limit(100)
                ->get()
                ->map(fn (User $user) => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'isAdmin' => (bool) $user->is_admin,
                    'teamsCount' => $user->owned_teams_count,
                    'createdAt' => $user->created_at?->diffForHumans(),
                ]),
            'teams' => $teams->map(fn (Team $team) => [
                'id' => $team->id,
                'name' => $team->name,
                'slug' => $team->slug,
                'owner' => [
                    'id' => $team->owner?->id,
                    'name' => $team->owner?->name,
                    'email' => $team->owner?->email,
                ],
                'planId' => $team->plan_id,
                'planName' => $team->plan?->name,
                'billingStatus' => $team->billing_status,
                'storageUsed' => ByteFormatter::human($team->storage_used_bytes),
                'storageLimit' => ByteFormatter::human($team->storage_limit_bytes),
                'storageLimitGb' => ByteFormatter::bytesToGb($team->storage_limit_bytes),
                'storagePercent' => round(($team->storage_used_bytes / max($team->storage_limit_bytes, 1)) * 100, 1),
                'apiTokensCount' => $team->api_tokens_count,
                'mediaFilesCount' => $team->media_files_count,
                'logEntriesCount' => $team->log_entries_count,
                'publicBaseUrl' => $team->public_base_url,
                'customDomain' => $team->custom_domain,
                'createdAt' => $team->created_at?->diffForHumans(),
            ]),
        ]);
    }

    public function updateTeam(Request $request, Team $team): RedirectResponse
    {
        $validated = $request->validate([
            'storage_limit_gb' => ['required', 'numeric', 'min:0.01', 'max:100000'],
            'plan_id' => ['nullable', 'exists:plans,id'],
            'billing_status' => ['required', 'string', 'max:40'],
            'public_base_url' => ['nullable', 'url', 'max:255'],
        ]);

        $team->forceFill([
            'storage_limit_bytes' => ByteFormatter::gbToBytes((float) $validated['storage_limit_gb']),
            'plan_id' => $validated['plan_id'] ?? null,
            'billing_status' => $validated['billing_status'],
            'public_base_url' => isset($validated['public_base_url']) ? rtrim($validated['public_base_url'], '/') : null,
        ])->save();

        return back()->with('success', 'Team updated.');
    }

    public function updateUser(Request $request, User $user): RedirectResponse
    {
        $validated = $request->validate([
            'is_admin' => ['required', 'boolean'],
        ]);

        $user->forceFill(['is_admin' => (bool) $validated['is_admin']])->save();

        return back()->with('success', 'User role updated.');
    }
}
