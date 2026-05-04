<?php

use Illuminate\Support\Facades\Broadcast;

/*
|--------------------------------------------------------------------------
| Broadcast Channels
|--------------------------------------------------------------------------
|
| Here you may register all of the event broadcasting channels that your
| application supports. The given channel authorization callbacks are
| used to check if an authenticated user can listen to the channel.
|
*/

Broadcast::channel('App.Models.User.{id}', function ($user, $id) {
    return (int) $user->id === (int) $id;
});

$canAccessTeam = function ($user, $teamId): bool {
    $teamId = (int) $teamId;

    return $user->ownedTeams()->whereKey($teamId)->exists()
        || $user->teams()->whereKey($teamId)->exists();
};

Broadcast::channel('teams.{teamId}.logs', $canAccessTeam);
Broadcast::channel('teams.{teamId}.media', $canAccessTeam);
