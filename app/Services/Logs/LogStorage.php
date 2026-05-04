<?php

namespace App\Services\Logs;

use App\Models\ApiToken;
use App\Models\Team;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

interface LogStorage
{
    public function store(Team $team, ?ApiToken $token, array $entries): int;

    public function search(Team $team, array $filters = []): LengthAwarePaginator;

    public function export(Team $team, array $filters = [], int $limit = 5000): array;

    public function count(Team $team, array $filters = []): int;

    public function metadataSuggestions(Team $team, array $filters = [], ?string $key = null, int $limit = 1000): array;

    public function summary(Team $team): array;

    public function recent(Team $team, int $limit = 10): array;
}
