<?php

namespace App\Http\Controllers;

use App\Models\LogSavedView;
use App\Services\TeamProvisioner;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class LogSavedViewController extends Controller
{
    public function __construct(private readonly TeamProvisioner $teams)
    {
    }

    public function store(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'filters' => ['required', 'array'],
            'pinned' => ['nullable', 'boolean'],
        ]);

        $team = $this->teams->defaultTeamFor($request->user());

        $team->logSavedViews()->create([
            'user_id' => $request->user()->id,
            'name' => $validated['name'],
            'filters' => $this->cleanFilters($validated['filters']),
            'pinned' => $validated['pinned'] ?? true,
            'sort_order' => (int) $team->logSavedViews()->max('sort_order') + 1,
        ]);

        return back()->with('success', 'Log view saved.');
    }

    public function destroy(Request $request, LogSavedView $logSavedView): RedirectResponse
    {
        $team = $this->teams->defaultTeamFor($request->user());
        abort_unless($logSavedView->team_id === $team->id, 404);

        $logSavedView->delete();

        return back()->with('success', 'Log view deleted.');
    }

    private function cleanFilters(array $filters): array
    {
        unset($filters['page']);

        return collect($filters)
            ->filter(fn ($value) => $value !== null && $value !== '' && $value !== [] && $value !== ['all'])
            ->all();
    }
}
