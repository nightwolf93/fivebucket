<!DOCTYPE html>
<html lang="{{ str_replace('_', '-', app()->getLocale()) }}">
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">

        <title inertia>{{ config('app.name', 'FiveBucket') }}</title>
        <link rel="icon" type="image/svg+xml" href="/favicon.svg">

        <!-- Fonts -->
        <link rel="preconnect" href="https://fonts.bunny.net">
        <link href="https://fonts.bunny.net/css?family=inter:400,500,600,700|jetbrains-mono:400,500,600&display=swap" rel="stylesheet" />

        <!-- Scripts -->
        @php
            $realtimeKey = config('broadcasting.connections.pusher.key');
            $fiveBucketConfig = [
                'name' => config('app.name', 'FiveBucket'),
                'realtime' => [
                    'enabled' => config('broadcasting.default') === 'pusher' && filled($realtimeKey),
                    'key' => $realtimeKey,
                    'host' => config('fivebucket.realtime.client_host'),
                    'port' => config('fivebucket.realtime.client_port'),
                    'scheme' => config('fivebucket.realtime.client_scheme'),
                ],
            ];
        @endphp
        <script>
            window.FiveBucket = @json($fiveBucketConfig);
        </script>
        @routes
        @viteReactRefresh
        @vite(['resources/js/app.jsx', "resources/js/Pages/{$page['component']}.jsx"])
        @inertiaHead
    </head>
    <body class="font-sans antialiased">
        @inertia
    </body>
</html>
