<?php

namespace Tests\Feature;

use App\Events\MediaChanged;
use App\Models\ApiToken;
use App\Models\Team;
use App\Models\User;
use App\Services\TeamProvisioner;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ClientManagementTest extends TestCase
{
    use RefreshDatabase;

    public function test_client_pages_are_available_to_authenticated_users(): void
    {
        $user = User::factory()->create();
        app(TeamProvisioner::class)->createDefaultTeam($user);

        $this->get('/docs')->assertOk();
        $this->actingAs($user)->get('/dashboard')->assertOk();
        $this->actingAs($user)->get('/api-keys')->assertOk();
        $this->actingAs($user)->get('/media')->assertOk();
        $this->actingAs($user)->get('/logs')->assertOk();
        $this->actingAs($user)->get('/settings')->assertOk();
    }

    public function test_public_url_override_is_used_for_new_uploads(): void
    {
        Storage::fake('public');
        config(['fivebucket.storage_disk' => 'public']);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        $team->forceFill(['public_base_url' => 'https://assets.example.com'])->save();
        [, $plainToken] = ApiToken::issue($team, $user, 'Upload key');

        $response = $this->post('/api/v3/file', [
            'file' => UploadedFile::fake()->create('screen.png', 8, 'image/png'),
        ], [
            'Authorization' => $plainToken,
        ]);

        $response->assertOk()->assertJsonPath('status', 'ok');
        $this->assertStringStartsWith('https://assets.example.com/', $response->json('data.url'));
    }

    public function test_media_can_be_deleted_from_management_page(): void
    {
        Storage::fake('public');
        config(['fivebucket.storage_disk' => 'public']);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);
        [, $plainToken] = ApiToken::issue($team, $user, 'Upload key');

        $fileId = $this->post('/api/v3/file', [
            'file' => UploadedFile::fake()->create('clip.mp4', 16, 'video/mp4'),
        ], [
            'Authorization' => $plainToken,
        ])->json('data.id');

        $mediaFile = $team->mediaFiles()->where('public_id', $fileId)->firstOrFail();

        Event::fake([MediaChanged::class]);

        $this->actingAs($user)->delete(route('media.destroy', $mediaFile))->assertRedirect();
        $this->assertSoftDeleted('media_files', ['id' => $mediaFile->id]);
        Event::assertDispatched(MediaChanged::class);
    }

    public function test_media_can_be_uploaded_from_web_management_page(): void
    {
        Storage::fake('public');
        config([
            'fivebucket.storage_disk' => 'public',
            'fivebucket.public_base_url' => 'http://localhost/storage',
        ]);

        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        Event::fake([MediaChanged::class]);

        $this->actingAs($user)->post(route('media.store'), [
            'uploads' => [
                UploadedFile::fake()->create('screenshot.png', 12, 'image/png'),
                UploadedFile::fake()->create('radio.ogg', 8, 'audio/ogg'),
            ],
            'path' => 'evidence/session-1',
            'metadata' => json_encode(['player' => 'nightwolf']),
        ])->assertRedirect();

        $this->assertDatabaseHas('media_files', [
            'team_id' => $team->id,
            'filename' => 'screenshot.png',
            'type' => 'image',
            'path' => 'evidence/session-1',
        ]);

        $this->assertDatabaseHas('media_files', [
            'team_id' => $team->id,
            'filename' => 'radio.ogg',
            'type' => 'audio',
            'path' => 'evidence/session-1',
        ]);

        Event::assertDispatchedTimes(MediaChanged::class, 2);
    }

    public function test_admin_can_update_team_quota_and_user_role(): void
    {
        $admin = User::factory()->create(['is_admin' => true]);
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        $this->actingAs($admin)->patch(route('admin.teams.update', $team), [
            'storage_limit_gb' => 250,
            'plan_id' => null,
            'billing_status' => 'manual',
            'public_base_url' => 'https://cdn.example.com',
        ])->assertRedirect();

        $this->assertDatabaseHas('teams', [
            'id' => $team->id,
            'billing_status' => 'manual',
            'storage_limit_bytes' => 268435456000,
            'public_base_url' => 'https://cdn.example.com',
        ]);

        $this->actingAs($admin)->patch(route('admin.users.update', $user), [
            'is_admin' => true,
        ])->assertRedirect();

        $this->assertDatabaseHas('users', [
            'id' => $user->id,
            'is_admin' => true,
        ]);
    }

    public function test_non_admin_cannot_access_admin_accounts(): void
    {
        $user = User::factory()->create(['is_admin' => false]);
        app(TeamProvisioner::class)->createDefaultTeam($user);

        $this->actingAs($user)->get(route('admin.accounts.index'))->assertForbidden();
    }

    public function test_active_api_key_can_be_revealed_when_encrypted_secret_exists(): void
    {
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        [$apiToken, $plainTextToken] = ApiToken::issue($team, $user, 'Server key');

        $this->actingAs($user)
            ->getJson(route('api-tokens.secret', $apiToken))
            ->assertOk()
            ->assertJsonPath('available', true)
            ->assertJsonPath('token', $plainTextToken);
    }

    public function test_legacy_api_key_without_encrypted_secret_returns_unavailable(): void
    {
        $user = User::factory()->create();
        $team = app(TeamProvisioner::class)->createDefaultTeam($user);

        [$apiToken] = ApiToken::issue($team, $user, 'Legacy key');
        $apiToken->forceFill(['encrypted_token' => null])->save();

        $this->actingAs($user)
            ->getJson(route('api-tokens.secret', $apiToken))
            ->assertOk()
            ->assertJsonPath('available', false)
            ->assertJsonPath('token', null);
    }
}
