# FiveBucket - Deploiement production

Derniere mise a jour: 2026-05-04

Ce document decrit le deploiement actuellement en place pour FiveBucket. Les secrets complets ne sont pas ecrits ici volontairement, car ce fichier peut etre versionne et pousse sur GitHub. Les valeurs reelles sont sur le serveur dans `/opt/fivebucket/.env.production`.

## Resume

- Domaine public: `https://fivebucket.nightwolf.fr`
- Serveur: `167.71.27.45`
- Utilisateur SSH: `root`
- Cle SSH locale utilisee: `C:\Users\Nightwolf\.ssh\id_rsa`
- Repository Git: `https://github.com/nightwolf93/fivebucket.git`
- Branche de production: `master`
- Dossier serveur: `/opt/fivebucket`
- Fichier env serveur: `/opt/fivebucket/.env.production`
- Script de mise a jour serveur: `/usr/local/bin/fivebucket-update`

## Ce qui est deploye

FiveBucket tourne avec Docker Compose et un reverse proxy Nginx installe sur l'hote.

Services Docker:

- `app`: Laravel PHP-FPM
- `nginx`: Nginx interne Docker, expose sur `127.0.0.1:8080` via le port hote `8080`
- `queue`: worker Laravel Redis
- `scheduler`: scheduler Laravel
- `mysql`: MySQL 8.4
- `redis`: Redis 7
- `clickhouse`: ClickHouse 24.12 pour les logs
- `soketi`: serveur WebSocket open source auto-heberge pour le live logs/media

Stockage persistant Docker:

- `fivebucket_fivebucket-mysql`: donnees MySQL
- `fivebucket_fivebucket-clickhouse`: donnees ClickHouse
- `fivebucket_fivebucket-redis`: donnees Redis
- `fivebucket_fivebucket-storage`: storage Laravel local

Stockage media:

- Driver applicatif: Cloudflare R2 compatible S3
- Bucket: `fivem`
- Endpoint S3: `https://910ea9bd897d545879ffcf1304db6846.r2.cloudflarestorage.com`
- URL publique R2 dev: `https://pub-1563daddee7647f28e0907f3b6f5553e.r2.dev`

Logs applicatifs:

- Driver: ClickHouse
- Table: `fivebucket_logs`
- TTL par defaut: `90` jours

Realtime:

- Driver Laravel: `pusher` compatible, utilise uniquement le protocole
- Serveur reel: `soketi` dans Docker, aucun appel a Pusher.com
- Channels prives: `teams.{id}.logs` et `teams.{id}.media`
- Proxy WebSocket Docker Nginx: chemins `/app` et `/apps`

## Nginx hote

Le vhost hote est cree ici:

```text
/etc/nginx/sites-available/fivebucket.nightwolf.fr
/etc/nginx/sites-enabled/fivebucket.nightwolf.fr
```

Flux HTTP:

```text
Cloudflare HTTPS -> Nginx hote -> http://127.0.0.1:8080 -> Nginx Docker -> PHP-FPM Laravel
```

Le vhost transmet les headers proxy Cloudflare:

- `X-Forwarded-For`
- `X-Forwarded-Host`
- `X-Forwarded-Proto`
- `X-Forwarded-Port`

Cote Laravel, `TrustProxies` fait confiance aux proxies pour eviter les redirects incorrects en `:80`.

## Credentials et secrets

Les secrets complets sont uniquement dans:

```text
/opt/fivebucket/.env.production
```

Permissions attendues:

```bash
chmod 600 /opt/fivebucket/.env.production
```

Inventaire des credentials:

| Service | Identifiant non secret | Secret |
| --- | --- | --- |
| Laravel | `APP_KEY` | Dans `/opt/fivebucket/.env.production` |
| MySQL app | `DB_USERNAME=fivebucket` | `DB_PASSWORD` dans `.env.production` |
| MySQL root | `root` | `MYSQL_ROOT_PASSWORD` dans `.env.production` |
| Redis | pas de password configure par defaut | verifier `REDIS_PASSWORD` |
| ClickHouse | `CLICKHOUSE_USERNAME=default` | `CLICKHOUSE_PASSWORD` dans `.env.production` |
| R2 bucket | `R2_BUCKET=fivem` | voir lignes R2 dans `.env.production` |
| R2 access key | `d523a02e...e43ab9d` | `R2_SECRET_ACCESS_KEY` dans `.env.production` |
| Cloudflare R2 token | `cfat_XSt...` | a conserver hors Git |
| Stripe | a configurer plus tard | `STRIPE_SECRET`, `STRIPE_WEBHOOK_SECRET` |

Ne jamais ajouter les valeurs completes de `APP_KEY`, `DB_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `CLICKHOUSE_PASSWORD`, `R2_SECRET_ACCESS_KEY`, `STRIPE_SECRET` ou token Cloudflare dans un fichier versionne.

## Variables importantes

Extrait attendu dans `/opt/fivebucket/.env.production`:

```env
APP_ENV=production
APP_DEBUG=false
APP_URL=https://fivebucket.nightwolf.fr
SESSION_SECURE_COOKIE=true

FIVEBUCKET_ENV_FILE=.env.production
HTTP_PORT=8080

DB_CONNECTION=mysql
DB_HOST=mysql
DB_PORT=3306
DB_DATABASE=fivebucket
DB_USERNAME=fivebucket

CACHE_DRIVER=redis
QUEUE_CONNECTION=redis
SESSION_DRIVER=redis
REDIS_HOST=redis

FILESYSTEM_DISK=r2
FIVEBUCKET_STORAGE_DISK=r2
FIVEBUCKET_PUBLIC_BASE_URL=https://pub-1563daddee7647f28e0907f3b6f5553e.r2.dev
R2_REGION=auto
R2_BUCKET=fivem
R2_URL=https://pub-1563daddee7647f28e0907f3b6f5553e.r2.dev
R2_ENDPOINT=https://910ea9bd897d545879ffcf1304db6846.r2.cloudflarestorage.com
R2_USE_PATH_STYLE_ENDPOINT=false

FIVEBUCKET_LOGS_DRIVER=clickhouse
CLICKHOUSE_URL=http://clickhouse:8123
CLICKHOUSE_DATABASE=default
CLICKHOUSE_LOGS_TABLE=fivebucket_logs
CLICKHOUSE_LOGS_TTL_DAYS=90

BROADCAST_DRIVER=pusher
PUSHER_APP_ID=fivebucket
PUSHER_APP_KEY=fivebucket
PUSHER_HOST=soketi
PUSHER_PORT=6001
PUSHER_SCHEME=http
SOKETI_DEFAULT_APP_ID=fivebucket
SOKETI_DEFAULT_APP_KEY=fivebucket
SOKETI_DEFAULT_APP_SECRET=voir_env_production

FIVEBUCKET_WEBSOCKET_HOST=
FIVEBUCKET_WEBSOCKET_PORT=
FIVEBUCKET_WEBSOCKET_SCHEME=
```

## Mise a jour production

Depuis le serveur:

```bash
ssh -i C:\Users\Nightwolf\.ssh\id_rsa root@167.71.27.45
fivebucket-update
```

Equivalent manuel:

```bash
cd /opt/fivebucket
git fetch origin master
git checkout master
git pull --ff-only origin master
docker compose --env-file .env.production up -d --build --remove-orphans
docker compose --env-file .env.production exec -T app php artisan migrate --force
docker image prune -f
docker compose --env-file .env.production ps
```

Le script `/usr/local/bin/fivebucket-update` utilise:

```bash
APP_DIR=/opt/fivebucket
BRANCH=master
ENV_FILE=.env.production
PRUNE_IMAGES=true
```

## Commandes utiles

Etat des containers:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production ps
```

Logs applicatifs:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production logs -f app nginx queue scheduler soketi
```

Tester le serveur WebSocket interne:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production ps soketi
```

Executer Artisan:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production exec app php artisan about
```

Relancer les workers:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production restart queue scheduler
```

Reparer/creer la table ClickHouse des logs:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production exec app php artisan fivebucket:logs-install --force
```

Tester R2 depuis Laravel:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production exec app php artisan tinker
```

Puis:

```php
Storage::disk('r2')->put('healthcheck.txt', 'ok');
Storage::disk('r2')->delete('healthcheck.txt');
```

## Verification publique

Tester les routes principales:

```bash
curl -I https://fivebucket.nightwolf.fr/
curl -I https://fivebucket.nightwolf.fr/login
curl -I https://fivebucket.nightwolf.fr/docs
```

Resultat attendu:

- `/` retourne `302` vers `/login`
- `/login` retourne `200`
- `/docs` retourne `200`

Verifier Nginx hote:

```bash
nginx -t
systemctl status nginx
```

Recharger Nginx:

```bash
systemctl reload nginx
```

Le vhost Nginx hote doit transmettre les upgrades WebSocket vers Docker:

```nginx
proxy_http_version 1.1;
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection "upgrade";
```

## Sauvegardes

Donnees critiques a sauvegarder:

- volume Docker MySQL: `fivebucket_fivebucket-mysql`
- volume Docker ClickHouse: `fivebucket_fivebucket-clickhouse`
- fichier env serveur: `/opt/fivebucket/.env.production`

Les medias sont stockes dans Cloudflare R2. Le volume `fivebucket_fivebucket-storage` contient surtout le storage Laravel local et reste utile a sauvegarder, mais les assets publics passent par R2 lorsque `FIVEBUCKET_STORAGE_DISK=r2`.

Exemple de dump MySQL:

```bash
cd /opt/fivebucket
docker compose --env-file .env.production exec mysql mysqldump -u root -p fivebucket > fivebucket.sql
```

Exemple de backup ClickHouse brut:

```bash
docker run --rm -v fivebucket_fivebucket-clickhouse:/data -v /root/backups:/backup alpine tar czf /backup/fivebucket-clickhouse.tgz -C /data .
```

## Notes Cloudflare

Le HTTPS public est servi par Cloudflare pour `fivebucket.nightwolf.fr`.

L'origine serveur reste en HTTP local derriere Cloudflare:

```text
Cloudflare -> http://167.71.27.45:80 -> Nginx hote -> Docker port 8080
```

Si le mode Cloudflare doit passer en `Full strict`, ajouter un certificat Origin Cloudflare sur Nginx hote ou generer un certificat Let's Encrypt avec le DNS en mode `DNS only` pendant la validation.

## Notes de securite

- Garder `APP_DEBUG=false` en production.
- Ne pas exposer MySQL, Redis ou ClickHouse sur Internet.
- Garder `APP_KEY` stable: changer cette cle rend illisibles les donnees chiffrees comme les secrets d'API keys.
- Ne pas pousser `.env.production`.
- Ne pas mettre de secrets complets dans ce markdown.
