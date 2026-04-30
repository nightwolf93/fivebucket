# FiveBucket Logs

FiveBucket exposes the Fivemanage-compatible logs endpoint and can store entries either in the application database or in ClickHouse.

## API

```http
POST /api/logs
Authorization: <api-key>
Content-Type: application/json
```

The body can be a single object or an array:

```json
[
  {
    "level": "info",
    "message": "Player connected",
    "resource": "players",
    "metadata": {
      "playerSource": 42
    }
  }
]
```

The response stays compatible:

```json
{
  "status": "ok"
}
```

## Local Database Driver

Use this for development and tests:

```env
FIVEBUCKET_LOGS_DRIVER=database
```

Logs are stored in the `log_entries` table.

## ClickHouse Driver

ClickHouse is recommended for production log storage because it is open source, efficient for high-volume append-only event data, and fast for tenant-scoped analytics queries.

Start a local ClickHouse server:

```bash
docker run --rm --name fivebucket-clickhouse \
  -p 8123:8123 -p 9000:9000 \
  -e CLICKHOUSE_DB=default \
  clickhouse/clickhouse-server:latest
```

Configure FiveBucket:

```env
FIVEBUCKET_LOGS_DRIVER=clickhouse
CLICKHOUSE_URL=http://127.0.0.1:8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_USERNAME=
CLICKHOUSE_PASSWORD=
CLICKHOUSE_LOGS_TABLE=fivebucket_logs
CLICKHOUSE_LOGS_TTL_DAYS=90
```

Create the table:

```bash
php artisan fivebucket:logs-install
```

Use `CLICKHOUSE_LOGS_TTL_DAYS=0` to disable automatic retention cleanup.

## Logstash Or Vector

Logstash can be used before FiveBucket when you need to collect files, syslog, Docker output, or transform unstructured logs. It should not be treated as the storage engine. A typical pipeline is:

```text
servers -> Logstash/Vector -> FiveBucket /api/logs -> ClickHouse -> FiveBucket dashboard
```

For FiveM resources and SDK logs, sending directly to `/api/logs` is simpler and avoids operating an extra JVM service.
