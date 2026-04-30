# FiveBucket Docker Deployment

This deployment runs FiveBucket with:

- PHP-FPM application container
- Nginx HTTP container
- MySQL 8.4
- Redis 7
- ClickHouse for scalable logs
- Cloudflare R2 for media storage

## 1. Prepare Environment

Copy the production environment template:

```bash
cp .env.docker.example .env.production
```

Generate a Laravel app key:

```bash
docker run --rm php:8.2-cli-alpine php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
```

Put the generated value in:

```env
APP_KEY=base64:...
```

Then update these production values:

```env
APP_URL=https://your-domain.example
HTTP_PORT=8080

DB_PASSWORD=change_me_db
MYSQL_PASSWORD=change_me_db
MYSQL_ROOT_PASSWORD=change_me_root

R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET=fivem
R2_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
FIVEBUCKET_PUBLIC_BASE_URL=https://pub-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx.r2.dev

CLICKHOUSE_PASSWORD=change_me_clickhouse

STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
```

Keep `.env.production` on the server only. It is ignored by git.

## 2. Build And Start

```bash
docker compose --env-file .env.production up -d --build
```

The `app` container will:

- wait for MySQL and ClickHouse
- run Laravel migrations
- seed the default storage plans
- create the ClickHouse logs table
- cache Laravel config

After the first successful boot you can set this to reduce startup work:

```env
RUN_SEEDERS=false
```

Keep `RUN_MIGRATIONS=true` if you want deploys to apply new migrations automatically.

## 3. Reverse Proxy

Expose the app through your host proxy to the Nginx container port.

Example with the default compose port:

```text
https://your-domain.example -> http://127.0.0.1:8080
```

Your reverse proxy should handle TLS certificates. Nginx inside Docker only serves HTTP.

## 4. Useful Commands

View logs:

```bash
docker compose --env-file .env.production logs -f app nginx
```

Run Artisan:

```bash
docker compose --env-file .env.production exec app php artisan about
```

Run migrations manually:

```bash
docker compose --env-file .env.production exec app php artisan migrate --force
```

Create or repair the ClickHouse logs table:

```bash
docker compose --env-file .env.production exec app php artisan fivebucket:logs-install --force
```

Restart workers:

```bash
docker compose --env-file .env.production restart queue scheduler
```

Update after pulling new code:

```bash
docker compose --env-file .env.production up -d --build
```

Or use the bundled update script:

```bash
APP_DIR=/opt/fivebucket ENV_FILE=.env.production ./deploy/update.sh
```

## 5. Backups

Back up these Docker volumes:

- `fivebucket-mysql`
- `fivebucket-clickhouse`
- `fivebucket-redis`
- `fivebucket-storage`

Media bytes are stored in R2 when `FIVEBUCKET_STORAGE_DISK=r2`, so the critical local data is MySQL and ClickHouse.

## 6. Production Notes

- Do not set `APP_DEBUG=true` in production.
- Do not expose MySQL, Redis, or ClickHouse ports publicly.
- Keep `APP_KEY` stable. Changing it will make encrypted API key reveal data unreadable.
- The generated Docker image does not contain `.env`, `.env.production`, R2 secrets, or Stripe secrets.
