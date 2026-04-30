# FiveBucket Roadmap

FiveBucket is a Laravel SaaS that provides a drop-in compatible replacement for Fivemanage media and logging APIs for FiveM servers. The first production target is changing only the domain, API keys, and dashboard account ownership while preserving request routes, request fields, and response envelopes expected by existing scripts.

## Product Scope

- Project name: FiveBucket.
- Backend: Laravel, no NextJS.
- Frontend: React through Vite/Inertia with shadcn-ui style components.
- Storage: Cloudflare R2 through S3-compatible APIs.
- Primary users: FiveM server owners that need media hosting, player evidence storage, and structured logs.
- SaaS model: account registration, teams/workspaces, API keys, usage quotas, plan upgrades, billing.
- Supported formats: images, videos, audio, and generic binary files where safe, with type classification for API compatibility.

## Compatibility Contract

The public compatibility surface must match Fivemanage as closely as practical:

- `Authorization: <api-key>` header authentication.
- `?apiKey=<api-key>` query authentication for upload endpoints used from browser/NUI scripts.
- JSON response envelope: `{ "status": "ok", "data": ... }`.
- Error responses should use stable HTTP status codes and a JSON message.
- API v3 file routes:
  - `GET /api/v3/file`
  - `POST /api/v3/file`
  - `POST /api/v3/file/base64`
  - `GET /api/v3/file/presigned-url`
  - `POST /api/v3/file/presigned-url/{token}`
  - `GET /api/v3/file/{path}`
  - `DELETE /api/v3/file/{path}`
- API v3 logging routes:
  - `POST /api/v3/logs`
  - `POST /api/v3/logs/discord`
- Legacy compatibility routes to keep common old integrations working:
  - `POST /api/v2/image`, `POST /api/v2/video`, `POST /api/v2/audio`
  - `GET /api/v2/presigned-url`
  - `POST /api/v2/presigned-url/{token}`
  - `DELETE /api/image/delete/{id}`
  - `DELETE /api/video/delete/{id}`
  - `DELETE /api/audio/delete/{id}`
  - `POST /api/logs`
- SDK session routes:
  - `POST /api/sdk/report`
  - `POST /api/sdk/heartbeat`
  - `POST /api/sdk/invalidate`

## Architecture

- Laravel app with API controllers, service classes, policies, jobs, and React dashboard.
- PostgreSQL for production metadata; SQLite may be used for local development.
- R2 bucket stores object bytes.
- Database stores users, teams, memberships, API tokens, file metadata, usage ledgers, log entries, plans, subscriptions, and billing events.
- API token values are shown only once, stored as SHA-256/HMAC hashes, scoped by capability.
- File object keys use team isolation: `{team_ulid}/{optional_path}/{file_ulid}.{extension}`.
- Public URLs use a configurable CDN/storage base URL and optionally custom domains.
- Uploads are streamed to disk/R2 where possible; base64 uploads decode into temporary streams.
- Usage accounting is transactional: quota is checked before writes and usage is updated after successful storage.

## Storage Plans

- Free: 1 GB included.
- Growth: 10 GB included.
- Scale: 100 GB included.
- Overage: configurable euro price per extra GB.
- Quotas apply per team/workspace.
- Storage usage counts active stored bytes, not deleted files.
- Logs may have their own retention policy and optional future billing dimension.

## Data Model

- `users`: Laravel users.
- `teams`: owner, name, slug, plan, storage limit, billing status.
- `team_members`: role-based membership.
- `api_tokens`: token hash, prefix, scopes, team, last used, revoked timestamp.
- `media_files`: public id, team, uploader token, original filename, storage key, path, mime, extension, type, size, metadata JSON, retention flag, URLs, deleted timestamp.
- `usage_records`: team, metric, delta bytes/count, reason, subject, timestamp.
- `log_entries`: team, level, message, resource, metadata, timestamp.
- `sdk_sessions`: team, token hash, sdk type, endpoint/resource/universe/job metadata, expiry, invalidated timestamp.
- `plans`: slug, included bytes, monthly price, overage price per GB.
- `subscriptions`: team, Stripe customer/subscription IDs, status, current period.
- `billing_events`: Stripe webhook event tracking.

## Development Phases

### Phase 1 - Foundation

- Scaffold Laravel 10 compatible with the current PHP 8.1 runtime.
- Install Laravel Breeze React/Inertia for auth and Vite frontend.
- Add shadcn-ui conventions and reusable app components.
- Configure local SQLite by default.
- Add S3/R2 filesystem configuration and `.env.example` placeholders.
- Add core models, migrations, factories, and seeders for plans.

### Phase 2 - API Keys and Teams

- Create default team when a user registers.
- Implement token creation, revocation, scope checks, and one-time token display.
- Add API authentication middleware supporting `Authorization` and `apiKey`.
- Add dashboard pages for team overview and API token management.

### Phase 3 - File Hosting API

- Implement multipart upload on `POST /api/v3/file`.
- Implement base64 upload on `POST /api/v3/file/base64`.
- Implement listing, metadata retrieval, and deletion.
- Add MIME classification for image, video, audio, and other.
- Add metadata parsing from JSON string.
- Add custom filename and folder path handling.
- Add quota enforcement and usage ledger writes.
- Add response format compatibility tests.

### Phase 4 - Presigned Uploads

- Generate signed temporary upload tokens.
- Implement token upload route with the same response format as normal upload.
- Support v2 compatibility presigned routes and `fileType` mapping.
- Add expiration, single-use option, and audit metadata.

### Phase 5 - Logs

- Implement `POST /api/v3/logs` accepting arrays.
- Implement `POST /api/logs` legacy route accepting single object or array.
- Implement Discord webhook payload ingestion at `/api/v3/logs/discord`.
- Add dashboard log search, filters, and retention settings.
- Plan optional ClickHouse adapter for high-volume production logs.

### Phase 6 - Dashboard

- Build dashboard shell with team switcher, storage usage, recent uploads, logs, billing state, and settings.
- Add file browser with filters by type/path, metadata view, copy URL, and delete.
- Add quota indicators and warning states.
- Add plan selection screens with Stripe disabled until Phase 8.

### Phase 7 - Operations and Security

- Add rate limiting per API key and per account.
- Add upload size limits per plan and MIME allow/deny lists.
- Add retention cleanup job.
- Add R2 delete reconciliation job.
- Add structured application logs and audit events.
- Add CORS configuration for FiveM/NUI usage.
- Add tests for auth, quota, upload, deletion, and response compatibility.

### Phase 8 - Stripe Billing

- Install and configure Laravel Cashier or direct Stripe SDK.
- Create Stripe products/prices for Free, 10 GB, 100 GB, and metered overage.
- Implement checkout, customer portal, subscription sync, and webhook handling.
- Report metered storage overage or calculate invoice items from usage records.
- Enforce billing state in quota checks.
- Add billing dashboard with invoices and plan changes.

## Initial MVP Acceptance Criteria

- A user can register, log in, and get a default team.
- A team can generate an API key.
- Existing FiveM scripts can upload screenshots by changing the host and API key.
- `POST /api/v3/file`, `POST /api/v3/file/base64`, `GET /api/v3/file`, `GET /api/v3/file/{id}`, and `DELETE /api/v3/file/{id}` work with R2-compatible storage.
- Presigned URL flow works for client/NUI uploads.
- Logs can be ingested and viewed.
- Free plan blocks uploads after 1 GB unless a higher plan is active.
- Stripe is prepared in schema/config and implemented after the core API is stable.

## Deployment Notes

- Required production services: PHP 8.1+ runtime, database, queue worker, scheduler, Cloudflare R2 bucket, CDN/custom domain, mail provider, Stripe account.
- Recommended production database: PostgreSQL.
- Recommended local development: SQLite and local disk storage until R2 credentials are configured.
- Required scheduled jobs: retention cleanup, deleted-file reconciliation, usage consistency audit.
- Required queue jobs: optional media analysis, delayed deletes, Stripe webhook processing, large log ingestion.
