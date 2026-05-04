<?php

namespace App\Http\Middleware;

use App\Services\TeamProvisioner;
use Illuminate\Http\Request;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that is loaded on the first page visit.
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): string|null
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        return [
            ...parent::share($request),
            'auth' => [
                'user' => $request->user() ? [
                    'id' => $request->user()->id,
                    'name' => $request->user()->name,
                    'email' => $request->user()->email,
                    'isAdmin' => (bool) $request->user()->is_admin,
                ] : null,
            ],
            'flash' => [
                'apiToken' => fn () => $request->session()->get('api_token'),
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'logSavedViews' => fn () => $request->user()
                ? app(TeamProvisioner::class)->defaultTeamFor($request->user())->logSavedViews()
                    ->where('pinned', true)
                    ->orderBy('sort_order')
                    ->limit(6)
                    ->get(['id', 'name', 'filters', 'pinned'])
                    ->map(fn ($view) => [
                        'id' => $view->id,
                        'name' => $view->name,
                        'filters' => $view->filters,
                        'pinned' => $view->pinned,
                    ])
                : [],
        ];
    }
}
