#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/fivebucket}"
BRANCH="${BRANCH:-master}"
ENV_FILE="${ENV_FILE:-.env.production}"

cd "$APP_DIR"

git fetch origin "$BRANCH"
git checkout "$BRANCH"
git pull --ff-only origin "$BRANCH"

docker compose --env-file "$ENV_FILE" up -d --build --remove-orphans
docker compose --env-file "$ENV_FILE" exec -T app php artisan migrate --force

if [ "${PRUNE_IMAGES:-true}" = "true" ]; then
    docker image prune -f
fi

docker compose --env-file "$ENV_FILE" ps
