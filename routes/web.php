<?php

use App\Http\Controllers\Admin\AccountController;
use App\Http\Controllers\ApiTokenController;
use App\Http\Controllers\AssetController;
use App\Http\Controllers\BillingController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\LogAlertRuleController;
use App\Http\Controllers\LogDashboardController;
use App\Http\Controllers\LogSavedViewController;
use App\Http\Controllers\LogWebhookEndpointController;
use App\Http\Controllers\MediaController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\RemoteActionController;
use App\Http\Controllers\TeamSettingsController;
use App\Models\Plan;
use App\Support\PricingCatalog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

Route::get('/', function (): RedirectResponse {
    return redirect()->route(auth()->check() ? 'dashboard' : 'login');
});

Route::get('/asset/{mediaFile:public_id}', [AssetController::class, 'show'])->name('assets.show');
Route::get('/docs', fn () => Inertia::render('Docs'))->name('docs');
Route::get('/pricing', fn () => Inertia::render('Pricing', PricingCatalog::pagePayload(
    Plan::query()->whereIn('slug', PricingCatalog::slugs())->get()
)))->name('pricing');

Route::get('/dashboard', [DashboardController::class, 'index'])->middleware(['auth', 'verified'])->name('dashboard');

Route::middleware('auth')->group(function () {
    Route::get('/api-keys', [ApiTokenController::class, 'index'])->name('api-keys.index');
    Route::post('/api-tokens', [ApiTokenController::class, 'store'])->name('api-tokens.store');
    Route::get('/api-tokens/{apiToken}/secret', [ApiTokenController::class, 'secret'])->name('api-tokens.secret');
    Route::delete('/api-tokens/{apiToken}', [ApiTokenController::class, 'destroy'])->name('api-tokens.destroy');
    Route::get('/media', [MediaController::class, 'index'])->name('media.index');
    Route::post('/media', [MediaController::class, 'store'])->name('media.store');
    Route::patch('/media/{mediaFile}', [MediaController::class, 'update'])->name('media.update');
    Route::get('/media/{mediaFile}/signed-url', [MediaController::class, 'signedUrl'])->name('media.signed-url');
    Route::delete('/media/{mediaFile}', [MediaController::class, 'destroy'])->name('media.destroy');
    Route::get('/actions', [RemoteActionController::class, 'index'])->name('actions.index');
    Route::post('/actions', [RemoteActionController::class, 'store'])->name('actions.store');
    Route::delete('/actions/{execution}', [RemoteActionController::class, 'cancel'])->name('actions.cancel');
    Route::get('/logs', [LogDashboardController::class, 'index'])->name('logs.index');
    Route::get('/logs/export', [LogDashboardController::class, 'export'])->name('logs.export');
    Route::get('/logs/metadata/suggestions', [LogDashboardController::class, 'metadataSuggestions'])->name('logs.metadata-suggestions');
    Route::post('/logs/saved-views', [LogSavedViewController::class, 'store'])->name('logs.saved-views.store');
    Route::delete('/logs/saved-views/{logSavedView}', [LogSavedViewController::class, 'destroy'])->name('logs.saved-views.destroy');
    Route::get('/alerts', [LogAlertRuleController::class, 'index'])->name('alerts.index');
    Route::post('/alerts/preview', [LogAlertRuleController::class, 'preview'])->name('alerts.preview');
    Route::post('/alerts', [LogAlertRuleController::class, 'store'])->name('alerts.store');
    Route::patch('/alerts/{alert}', [LogAlertRuleController::class, 'update'])->name('alerts.update');
    Route::delete('/alerts/{alert}', [LogAlertRuleController::class, 'destroy'])->name('alerts.destroy');
    Route::post('/alerts/{alert}/run', [LogAlertRuleController::class, 'run'])->name('alerts.run');
    Route::get('/webhooks', [LogWebhookEndpointController::class, 'index'])->name('webhooks.index');
    Route::post('/webhooks', [LogWebhookEndpointController::class, 'store'])->name('webhooks.store');
    Route::patch('/webhooks/{webhook}', [LogWebhookEndpointController::class, 'update'])->name('webhooks.update');
    Route::delete('/webhooks/{webhook}', [LogWebhookEndpointController::class, 'destroy'])->name('webhooks.destroy');
    Route::post('/webhooks/{webhook}/test', [LogWebhookEndpointController::class, 'test'])->name('webhooks.test');
    Route::get('/settings', [TeamSettingsController::class, 'edit'])->name('settings.index');
    Route::patch('/settings', [TeamSettingsController::class, 'update'])->name('settings.update');
    Route::post('/billing/checkout', [BillingController::class, 'checkout'])->name('billing.checkout');
    Route::post('/billing/portal', [BillingController::class, 'portal'])->name('billing.portal');
    Route::get('/billing/usage', [BillingController::class, 'usage'])->name('billing.usage');
    Route::patch('/billing/usage', [BillingController::class, 'updateUsage'])->name('billing.usage.update');

    Route::middleware('admin')->prefix('admin')->name('admin.')->group(function () {
        Route::get('/accounts', [AccountController::class, 'index'])->name('accounts.index');
        Route::patch('/teams/{team}', [AccountController::class, 'updateTeam'])->name('teams.update');
        Route::patch('/users/{user}', [AccountController::class, 'updateUser'])->name('users.update');
    });

    Route::get('/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');
});

require __DIR__.'/auth.php';
