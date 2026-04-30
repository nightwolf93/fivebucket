<?php

namespace App\Providers;

use App\Services\Logs\LogStorage;
use App\Services\Logs\LogStorageManager;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->bind(LogStorage::class, fn () => app(LogStorageManager::class)->resolve());
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
