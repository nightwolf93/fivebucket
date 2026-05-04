# FiveBucket

FiveBucket is a Laravel SaaS for FiveM media hosting and log ingestion with a Fivemanage-compatible API surface. It stores media metadata in the database and file bytes on a configurable filesystem disk, with Cloudflare R2 supported through the S3-compatible driver.

## Stack

- Laravel 10, PHP 8.1+
- React + Inertia + Vite
- Tailwind with shadcn-ui style components
- SQLite locally, PostgreSQL recommended in production
- Cloudflare R2/S3-compatible storage
- ClickHouse-ready log storage with database fallback

## Local Setup

```bash
composer install
npm install
cp .env.example .env
php artisan key:generate
php artisan migrate --seed
php artisan storage:link
npm run dev
php artisan serve
```

The current local `.env` is already configured for SQLite and local public storage.

## R2 Configuration

Set the app to use the `r2` disk:

```env
FILESYSTEM_DISK=r2
FIVEBUCKET_STORAGE_DISK=r2
FIVEBUCKET_PUBLIC_BASE_URL=https://cdn.example.com

R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_REGION=auto
R2_BUCKET=
R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
R2_URL=https://cdn.example.com
```

## Compatible API

Authentication supports both:

```http
Authorization: <api-key>
```

and:

```http
?apiKey=<api-key>
```

Implemented routes:

- `POST /api/image`
- `POST /api/video`
- `POST /api/audio`
- `GET /api/v3/file`
- `POST /api/v3/file`
- `POST /api/v3/file/base64`
- `GET /api/v3/file/presigned-url`
- `POST /api/v3/file/presigned-url/{token}`
- `GET /api/v3/file/{id}`
- `DELETE /api/v3/file/{id}`
- `POST /api/v3/logs`
- `POST /api/v3/logs/discord`
- `POST /api/v2/image`
- `POST /api/v2/video`
- `POST /api/v2/audio`
- `GET /api/v2/presigned-url`
- `POST /api/v2/presigned-url/{token}`
- `DELETE /api/image/delete/{id}`
- `DELETE /api/video/delete/{id}`
- `DELETE /api/audio/delete/{id}`
- `POST /api/logs`
- `POST /api/sdk/report`
- `POST /api/sdk/heartbeat`
- `POST /api/sdk/invalidate`

Responses use the compatibility envelope:

```json
{
  "status": "ok",
  "data": {},
  "url": "https://...",
  "image": "https://..."
}
```

## Logs Storage

The default log driver stores entries in the relational database, which is ideal for local development. For production log volume, switch to ClickHouse:

```env
FIVEBUCKET_LOGS_DRIVER=clickhouse
CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_LOGS_TABLE=fivebucket_logs
CLICKHOUSE_LOGS_TTL_DAYS=90
```

Then create the ClickHouse table:

```bash
php artisan fivebucket:logs-install
```

See `docs/logs.md` for the local Docker command and the Logstash/Vector pipeline notes.

## Plans

Seeded plans:

- Free: 1 GB
- Growth: 10 GB
- Scale: 100 GB

Stripe checkout, customer portal, webhooks, subscription sync, and plan switching are implemented. Configure these values before enabling paid plans:

```env
STRIPE_KEY=
STRIPE_SECRET=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_GROWTH_10GB=
STRIPE_PRICE_SCALE_100GB=
```

The webhook endpoint is:

```text
/api/stripe/webhook
```

## Verification

```bash
npm run build
php artisan test
```

## Docker Deployment

Production Docker files are included:

- `Dockerfile`
- `docker-compose.yml`
- `.env.docker.example`
- `docker/nginx/default.conf`
- `docker/php/entrypoint.sh`
- `docker/php/php.ini`

Quick start:

```bash
cp .env.docker.example .env.production
docker run --rm php:8.2-cli-alpine php -r "echo 'base64:'.base64_encode(random_bytes(32)).PHP_EOL;"
docker compose --env-file .env.production up -d --build
```

Fill `.env.production` with the generated `APP_KEY`, R2 credentials, Stripe credentials, and your production domain before exposing the service.

See `docs/deployment.md` for the full deployment flow.
