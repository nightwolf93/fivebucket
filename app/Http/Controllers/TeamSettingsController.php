<?php

namespace App\Http\Controllers;

use App\Services\TeamProvisioner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class TeamSettingsController extends Controller
{
    public function __construct(private readonly TeamProvisioner $teams)
    {
    }

    public function edit(Request $request): Response
    {
        $team = $this->teams->defaultTeamFor($request->user());

        return Inertia::render('Settings/Index', [
            'team' => [
                'name' => $team->name,
                'slug' => $team->slug,
                'publicBaseUrl' => $team->public_base_url,
                'customDomain' => $team->custom_domain,
                'customDomainVerifiedAt' => $team->custom_domain_verified_at?->toISOString(),
                'effectivePublicBaseUrl' => $team->effectivePublicBaseUrl(),
            ],
            'storage' => [
                'disk' => config('fivebucket.storage_disk'),
                'fallbackPublicBaseUrl' => config('fivebucket.public_base_url'),
            ],
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'public_base_url' => ['nullable', 'url', 'max:255'],
            'custom_domain' => ['nullable', 'regex:/^[A-Za-z0-9.-]+$/', 'max:255'],
        ]);

        $team = $this->teams->defaultTeamFor($request->user());
        $customDomain = $this->normalizeDomain($validated['custom_domain'] ?? null);

        $team->forceFill([
            'public_base_url' => $this->normalizeUrl($validated['public_base_url'] ?? null),
            'custom_domain' => $customDomain,
            'custom_domain_verified_at' => $customDomain === $team->custom_domain ? $team->custom_domain_verified_at : null,
        ])->save();

        return back()->with('success', 'Public URL settings saved.');
    }

    private function normalizeUrl(?string $url): ?string
    {
        return $url ? rtrim(trim($url), '/') : null;
    }

    private function normalizeDomain(?string $domain): ?string
    {
        if (! $domain) {
            return null;
        }

        return strtolower(preg_replace('/^https?:\/\//', '', trim($domain, " \t\n\r\0\x0B/")));
    }
}
