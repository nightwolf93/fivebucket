#!/bin/sh
set -e

cd /var/www/html

mkdir -p \
    storage/app/public \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/framework/testing \
    storage/logs \
    bootstrap/cache

chown -R www-data:www-data storage bootstrap/cache

wait_for_tcp() {
    host="$1"
    port="$2"
    label="$3"

    if [ -z "$host" ] || [ -z "$port" ]; then
        return 0
    fi

    attempts="${WAIT_FOR_SERVICES_ATTEMPTS:-60}"

    until nc -z "$host" "$port"; do
        attempts=$((attempts - 1))

        if [ "$attempts" -le 0 ]; then
            echo "Timed out waiting for $label at $host:$port"
            return 1
        fi

        echo "Waiting for $label at $host:$port..."
        sleep 2
    done
}

if [ "${WAIT_FOR_SERVICES:-true}" = "true" ]; then
    if [ "${DB_CONNECTION:-mysql}" != "sqlite" ]; then
        wait_for_tcp "${DB_HOST:-mysql}" "${DB_PORT:-3306}" "database"
    fi

    if [ "${FIVEBUCKET_LOGS_DRIVER:-database}" = "clickhouse" ]; then
        clickhouse_host="$(php -r 'echo parse_url(getenv("CLICKHOUSE_URL") ?: "http://clickhouse:8123", PHP_URL_HOST) ?: "clickhouse";')"
        clickhouse_port="$(php -r '$url = getenv("CLICKHOUSE_URL") ?: "http://clickhouse:8123"; echo parse_url($url, PHP_URL_PORT) ?: 8123;')"
        wait_for_tcp "$clickhouse_host" "$clickhouse_port" "clickhouse"
    fi
fi

if [ "${RUN_MIGRATIONS:-false}" = "true" ]; then
    php artisan migrate --force
fi

if [ "${RUN_SEEDERS:-false}" = "true" ]; then
    php artisan db:seed --force
fi

if [ "${RUN_CLICKHOUSE_MIGRATIONS:-false}" = "true" ] && [ "${FIVEBUCKET_LOGS_DRIVER:-database}" = "clickhouse" ]; then
    php artisan fivebucket:logs-install --force
fi

if [ "${CREATE_STORAGE_LINK:-false}" = "true" ]; then
    php artisan storage:link || true
fi

if [ "${LARAVEL_CONFIG_CACHE:-true}" = "true" ]; then
    php artisan config:clear
    php artisan config:cache
fi

exec "$@"
