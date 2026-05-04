import ApplicationLogo from '@/Components/ApplicationLogo';
import { PageHeader } from '@/Components/Design';
import ThemeToggle from '@/Components/ThemeToggle';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import {
    BookOpen,
    Box,
    CheckCircle2,
    Code2,
    Copy,
    FileJson,
    KeyRound,
    ListChecks,
    RadioTower,
    ScrollText,
    Server,
    ShieldCheck,
    Terminal,
    UploadCloud,
    Workflow,
} from 'lucide-react';

const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'install', label: 'Install' },
    { id: 'auth', label: 'Auth' },
    { id: 'lua-sdk', label: 'Lua SDK' },
    { id: 'js-sdk', label: 'JS/TS SDK' },
    { id: 'js-fivem', label: 'JS FiveM' },
    { id: 'media', label: 'Media API' },
    { id: 'framework-examples', label: 'Frameworks' },
    { id: 'logs', label: 'Logs API' },
    { id: 'sdk', label: 'SDK API' },
    { id: 'reference', label: 'Reference' },
    { id: 'errors', label: 'Errors' },
    { id: 'migration', label: 'Migration' },
];

const endpoints = [
    ['GET', '/api/v3/file', 'media', 'List media for the current team.'],
    ['POST', '/api/v3/file', 'media', 'Upload multipart file, image, video or audio.'],
    ['POST', '/api/v3/file/base64', 'media', 'Upload a base64 data URL or raw base64 payload.'],
    ['GET', '/api/v3/file/presigned-url', 'media', 'Create a temporary browser upload URL.'],
    ['POST', '/api/v3/file/presigned-url/{token}', 'public temporary token', 'Upload with a generated presigned token.'],
    ['GET', '/api/v3/file/{id}/signed-url', 'media', 'Create a temporary signed download URL for private media or variants.'],
    ['GET', '/asset/{id}?w=512&q=80&format=webp', 'public or signed', 'Serve original media or image variants through FiveBucket.'],
    ['GET', '/api/v3/file/{id}', 'media', 'Read one media metadata record.'],
    ['DELETE', '/api/v3/file/{id}', 'media', 'Delete one media object and its database record.'],
    ['POST', '/api/image', 'media', 'Legacy Fivemanage-compatible image upload.'],
    ['POST', '/api/video', 'media', 'Legacy Fivemanage-compatible video upload.'],
    ['POST', '/api/audio', 'media', 'Legacy Fivemanage-compatible audio upload.'],
    ['POST', '/api/logs', 'logs', 'Legacy-compatible log ingest. Accepts object or array.'],
    ['POST', '/api/v3/logs', 'logs', 'Batch log ingest. Accepts object or array.'],
    ['POST', '/api/v3/logs/discord', 'logs', 'Discord webhook-compatible log ingest.'],
    ['POST', '/api/sdk/report', 'sdk', 'Create a temporary SDK session token.'],
    ['POST', '/api/sdk/heartbeat', 'SDK token', 'Extend an SDK session.'],
    ['POST', '/api/sdk/invalidate', 'SDK token', 'Invalidate an SDK session.'],
];

const luaExports = [
    ['Request(method, path, options, cb)', 'Low-level HTTP wrapper with JSON encode/decode.'],
    ['RequestAwait(method, path, options)', 'Promise/Citizen.Await version of Request.'],
    ['Info/Warn/Error/Debug(message, metadata, resource, cb)', 'Convenience log helpers.'],
    ['Log(entry, cb)', 'Queue or send one normalized log entry.'],
    ['SendLogs(entries, cb)', 'Send an array immediately.'],
    ['FlushLogs(cb)', 'Flush the batched log queue.'],
    ['DiscordLog(payload, cb)', 'Send Discord-style webhook payloads.'],
    ['UploadBase64(base64, opts, cb)', 'Upload a base64 payload to /api/v3/file/base64.'],
    ['UploadContent(content, opts, cb)', 'Base64-encode a Lua string and upload it.'],
    ['UploadDataUrl(dataUrl, opts, cb)', 'Validate image/video/audio data URL then upload.'],
    ['UploadPhoneMedia(dataUrl, opts, cb)', 'Phone/media helper with metadata.'],
    ['UploadResourceFile(resource, path, opts, cb)', 'Read a resource file with LoadResourceFile and upload it.'],
    ['ListFiles(opts, cb)', 'List uploaded media with limit/page/type/path filters.'],
    ['GetFile(idOrPath, cb)', 'Fetch one media metadata record.'],
    ['DeleteFile(idOrPath, cb)', 'Delete one media file.'],
    ['CreatePresignedUrl(opts, cb)', 'Create a short-lived upload URL.'],
    ['CapturePlayerScreenshot(source, opts, cb)', 'Ask a client to capture and upload with screenshot-basic.'],
    ['ReportSdk(opts, cb)', 'Create a FiveBucket SDK session.'],
    ['HeartbeatSdk(cb)', 'Refresh the current SDK session.'],
    ['InvalidateSdk(cb)', 'Invalidate the current SDK session.'],
];

const examples = {
    install: `# server.cfg
ensure screenshot-basic

set fivebucket_base_url "https://fivebucket.nightwolf.fr"
set fivebucket_api_key "fbk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"

set fivebucket_logs_enabled "1"
set fivebucket_logs_batch "1"
set fivebucket_logs_batch_size "25"
set fivebucket_logs_flush_ms "10000"

set fivebucket_media_path "fivem"
set fivebucket_screenshot_mode "presigned"
set fivebucket_media_rate_max "6"
set fivebucket_media_rate_window "60"

set fivebucket_allow_client_capture "0"
set fivebucket_sdk_report "1"
set fivebucket_sdk_endpoint "167.71.27.45:30120"

ensure fivebucket`,
    auth: `Authorization: fbk_xxxxxxxxxxxxxxxxx
Authorization: Bearer fbk_xxxxxxxxxxxxxxxxx

GET /api/v3/file?apiKey=fbk_xxxxxxxxxxxxxxxxx`,
    luaServerLog: `-- server.lua from another FiveM resource
RegisterCommand('audit_buy', function(source, args)
  local item = args[1] or 'water'

  exports.fivebucket:Info('Player bought item', {
    playerSource = source,
    item = item,
    price = 12,
    request_id = ('buy-%s-%s'):format(source, os.time()),
  }, GetCurrentResourceName(), function(result)
    if not result.ok then
      print(('[fivebucket] log failed: %s'):format(result.error or 'unknown'))
    end
  end)
end, false)`,
    luaServerBatch: `-- Send several logs immediately, bypassing the queue.
exports.fivebucket:SendLogs({
  {
    level = 'info',
    message = 'Resource health check',
    resource = GetCurrentResourceName(),
    metadata = { server = GetConvar('sv_hostname', 'fivem') },
  },
  {
    level = 'warning',
    message = 'Inventory mismatch',
    resource = 'ox_inventory',
    dataset = 'inventory',
    metadata = { playerSource = source, expected = 10, actual = 8 },
  },
}, function(result)
  print(('logs sent ok=%s status=%s'):format(tostring(result.ok), tostring(result.status)))
end)`,
    luaScreenshot: `-- Server-side screenshot. API key stays server-side.
RegisterCommand('evidence_photo', function(source)
  if source == 0 then return end

  exports.fivebucket:CapturePlayerScreenshot(source, {
    path = 'screenshots/evidence',
    filename = ('player-%s.jpg'):format(source),
    metadata = {
      playerSource = source,
      reason = 'evidence',
      resource = GetCurrentResourceName(),
    },
    encoding = 'jpg',
    quality = 0.88,
  }, function(result)
    if result.ok and result.data and result.data.data then
      print(('uploaded: %s'):format(result.data.data.url))
    else
      print(('upload failed: %s'):format(result.error or 'unknown'))
    end
  end)
end, false)`,
    luaPhone: `-- Upload a phone/camera data URL from a server resource.
exports.fivebucket:UploadPhoneMedia(dataUrl, {
  phoneId = 'phn_01HX',
  app = 'camera',
  source = source,
  path = 'phone/camera',
  metadata = {
    characterId = 'char_42',
    location = 'Vinewood',
  },
}, function(result)
  if result.ok then
    print(('media url=%s type=%s size=%s'):format(result.url, result.kind, tostring(result.size)))
  else
    print(result.error)
  end
end)`,
    luaResourceFile: `-- Upload a JSON file stored inside a resource.
exports.fivebucket:UploadResourceFile(GetCurrentResourceName(), 'data/report.json', {
  path = 'reports',
  filename = 'daily-report.json',
  mimeType = 'application/json',
  metadata = {
    resource = GetCurrentResourceName(),
    generatedBy = 'cron',
  },
}, function(result)
  if result.ok then
    print(result.data.data.url)
  end
end)`,
    luaListDelete: `-- List, inspect and delete media.
exports.fivebucket:ListFiles({ limit = 20, type = 'image', path = 'screenshots/evidence' }, function(result)
  if not result.ok then return print(result.error) end

  for _, file in ipairs(result.data.data or {}) do
    print(('%s %s %s'):format(file.id, file.type, file.url))
  end
end)

exports.fivebucket:GetFile('01HV7AJ1KJ3W4Y9QH7N7B9XGRT', function(result)
  if result.ok then print(result.data.data.filename) end
end)

exports.fivebucket:DeleteFile('01HV7AJ1KJ3W4Y9QH7N7B9XGRT', function(result)
  print(('delete ok=%s'):format(tostring(result.ok)))
end)`,
    luaClient: `-- client.lua from another resource.
-- Requires: set fivebucket_allow_client_capture "1"
RegisterCommand('selfie', function()
  exports.fivebucket:CaptureScreenshot({
    path = 'screenshots/client',
    filename = ('selfie-%s.jpg'):format(GetGameTimer()),
    metadata = {
      resource = GetCurrentResourceName(),
    },
  }, function(result)
    if result.ok and result.data and result.data.data then
      print(('uploaded screenshot: %s'):format(result.data.data.url))
    else
      print(('capture failed: %s'):format(result.error or 'unknown'))
    end
  end)
end, false)`,
    luaSdk: `-- Manual SDK session control.
exports.fivebucket:ReportSdk({
  endpoint = '167.71.27.45:30120',
  resourceName = GetCurrentResourceName(),
  metadata = {
    artifact = GetConvar('version', 'unknown'),
    framework = 'ox_core',
  },
}, function(result)
  if result.ok then
    print(('SDK token active until %s'):format(result.data.expiresAt))
  else
    print(result.error)
  end
end)

exports.fivebucket:HeartbeatSdk(function(result)
  print(('heartbeat ok=%s'):format(tostring(result.ok)))
end)

exports.fivebucket:InvalidateSdk()`,
    jsServerExports: `// server.js from another FiveM resource
RegisterCommand('fb_js_log', (source, args) => {
  exports['fivebucket'].Info(
    'JS resource log',
    {
      playerSource: source,
      command: 'fb_js_log',
      args,
    },
    GetCurrentResourceName(),
    (result) => {
      if (!result.ok) {
        console.log('[fivebucket] log failed: ' + (result.error || 'unknown'));
      }
    }
  );
}, false);

RegisterCommand('fb_js_photo', (source) => {
  if (source === 0) return;

  exports['fivebucket'].CapturePlayerScreenshot(source, {
    path: 'screenshots/js',
    filename: 'player-' + source + '.jpg',
    metadata: { playerSource: source, resource: GetCurrentResourceName() },
  }, (result) => {
    const media = result.data && result.data.data;
    console.log(result.ok ? media.url : result.error);
  });
}, false);`,
    jsClientExports: `// client.js from another FiveM resource
// Requires: set fivebucket_allow_client_capture "1"
RegisterCommand('fb_js_selfie', () => {
  exports['fivebucket'].CaptureScreenshot({
    path: 'screenshots/client-js',
    filename: 'client-' + GetGameTimer() + '.jpg',
    metadata: { resource: GetCurrentResourceName() },
  }, (result) => {
    const media = result.data && result.data.data;
    console.log(result.ok ? media.url : result.error);
  });
}, false);`,
    jsDirectHttp: `// Server-side direct HTTP call without the Lua SDK.
// Never put API keys in client JS.
const BASE_URL = 'https://fivebucket.nightwolf.fr';
const API_KEY = GetConvar('fivebucket_api_key', '');

const payload = [{
  level: 'error',
  message: 'Vehicle spawn failed',
  resource: GetCurrentResourceName(),
  metadata: {
    model: 'adder',
    playerSource: 42,
  },
}];

PerformHttpRequest(BASE_URL + '/api/logs', (status, body) => {
  console.log('FiveBucket status=' + status + ' body=' + body);
}, 'POST', JSON.stringify(payload), {
  Authorization: API_KEY,
  'Content-Type': 'application/json',
  Accept: 'application/json',
});`,
    jsSdkBasic: `import { FiveBucketClient } from '@fivebucket/sdk';

const fivebucket = new FiveBucketClient({
  baseUrl: 'https://fivebucket.nightwolf.fr',
  apiKey: process.env.FIVEBUCKET_API_KEY,
});

await fivebucket.log({
  level: 'info',
  message: 'Admin command used',
  resource: 'moderation',
  metadata: {
    source: 12,
    command: 'bring',
    target: 42,
  },
});`,
    jsSdkPrivateUpload: `const uploaded = await fivebucket.uploadBase64(dataUrl, {
  filename: 'evidence.jpg',
  path: 'evidence/admin',
  visibility: 'private',
  metadata: {
    caseId: 'BCSO-1042',
    charId: 1,
  },
});

const signed = await fivebucket.signedFileUrl(uploaded.data.id, {
  expires: 900,
  w: 512,
  q: 80,
  format: 'webp',
});

console.log(signed.data.signedUrl);`,
    assetVariant: `GET /asset/01HV7AJ1KJ3W4Y9QH7N7B9XGRT?w=512&q=80&format=webp HTTP/1.1

HTTP/1.1 200 OK
Content-Type: image/webp
Cache-Control: public, max-age=31536000, immutable`,
    esxExample: `local ESX = exports.es_extended:getSharedObject()

RegisterCommand('fb_esx_audit', function(source, args)
  local player = ESX.GetPlayerFromId(source)

  exports.fivebucket:Info('ESX admin command used', {
    source = source,
    identifier = player and player.identifier or nil,
    charName = player and player.getName and player.getName() or GetPlayerName(source),
    group = player and player.getGroup and player.getGroup() or nil,
    command = args[1] or 'unknown',
    args = args,
    framework = 'esx',
  }, GetCurrentResourceName())
end, true)`,
    qbcoreExample: `local QBCore = exports['qb-core']:GetCoreObject()

QBCore.Commands.Add('fb_qb_audit', 'Audit admin command', {}, false, function(source, args)
  local player = QBCore.Functions.GetPlayer(source)
  local charinfo = player and player.PlayerData.charinfo or {}

  exports.fivebucket:Warn('QBCore admin command used', {
    source = source,
    citizenid = player and player.PlayerData.citizenid or nil,
    charName = ((charinfo.firstname or '') .. ' ' .. (charinfo.lastname or '')),
    command = 'fb_qb_audit',
    args = args,
    framework = 'qbcore',
  }, GetCurrentResourceName())
end, 'admin')`,
    oxCoreExample: `RegisterCommand('fb_ox_audit', function(source, args)
  local player = exports.ox_core:GetPlayer(source)
  local character = player and (player.char or {}) or {}

  exports.fivebucket:Info('ox_core admin command used', {
    source = source,
    charId = character.charId or character.id,
    charName = character.fullName or character.name,
    command = 'fb_ox_audit',
    args = args,
    framework = 'ox_core',
  }, GetCurrentResourceName())
end, true)`,
    multipart: `POST /api/v3/file HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: multipart/form-data

file=@screenshot.png
path=screenshots/police
visibility=private
metadata={"playerSource":42,"resource":"police","caseId":"BCSO-1042"}`,
    uploadResponse: `{
  "status": "ok",
  "url": "https://cdn.example.com/teams/team-id/screenshots/police/01HV7.png",
  "image": "https://cdn.example.com/teams/team-id/screenshots/police/01HV7.png",
    "data": {
    "id": "01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
    "url": "https://cdn.example.com/teams/team-id/screenshots/police/01HV7.png",
    "originalUrl": "https://cdn.example.com/teams/team-id/screenshots/police/01HV7.png",
    "assetUrl": "https://fivebucket.nightwolf.fr/asset/01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
    "variantUrl": "https://fivebucket.nightwolf.fr/asset/01HV7AJ1KJ3W4Y9QH7N7B9XGRT?w=512&q=80&format=webp",
    "visibility": "public",
    "duplicate": false
  }
}`,
    base64: `POST /api/v3/file/base64 HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "base64": "data:image/png;base64,iVBORw0KGgo...",
  "filename": "evidence.png",
  "path": "screenshots/evidence",
  "metadata": {
    "caseId": "BCSO-1042",
    "playerSource": 42
  }
}`,
    listResponse: `{
  "status": "ok",
  "data": [
    {
      "id": "01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
      "filename": "evidence.png",
      "type": "image",
      "size": 38291,
      "metadata": {
        "caseId": "BCSO-1042"
      },
      "url": "https://cdn.example.com/uploads/evidence.png",
      "originalUrl": "https://cdn.example.com/uploads/evidence.png",
      "assetUrl": "https://fivebucket.nightwolf.fr/asset/01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
      "variantUrl": "https://fivebucket.nightwolf.fr/asset/01HV7AJ1KJ3W4Y9QH7N7B9XGRT?w=512&q=80&format=webp",
      "visibility": "public"
    }
  ],
  "pagination": {
    "limit": 50,
    "page": 1,
    "total": 1
  }
}`,
    presigned: `GET /api/v3/file/presigned-url?expiresAt=1777900000 HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx

HTTP/1.1 200 OK
{
  "status": "ok",
  "data": {
    "presignedUrl": "https://fivebucket.nightwolf.fr/api/v3/file/presigned-url/eyJ..."
  }
}`,
    logs: `POST /api/logs HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

[
  {
    "level": "info",
    "message": "Player connected",
    "resource": "players",
    "dataset": "connections",
    "timestamp": "2026-05-04T10:30:00Z",
    "metadata": {
      "playerSource": 42,
      "license": "license:abc",
      "server_id": "prod-rp-1",
      "request_id": "connect-42-1777900000"
    }
  },
  {
    "level": "error",
    "message": "Vehicle spawn failed",
    "resource": "garage",
    "metadata": {
      "model": "adder",
      "duration_ms": 380
    }
  }
]`,
    discord: `POST /api/v3/logs/discord HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "username": "FiveBucket",
  "content": "Server started",
  "embeds": [
    {
      "title": "Player joined",
      "description": "Nightwolf joined the server",
      "timestamp": "2026-05-04T10:30:00Z"
    }
  ]
}`,
    sdkReport: `POST /api/sdk/report?sdkType=fivem&endpoint=167.71.27.45:30120&resourceName=fivebucket HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "resource": "fivebucket",
  "version": "1.0.0",
  "server": "Nightwolf RP",
  "metadata": {
    "artifact": "FXServer",
    "framework": "ox_core"
  }
}`,
    sdkResponse: `{
  "message": "SDK token created",
  "token": "sdk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "expiresAt": "2026-05-04T11:00:00.000000Z"
}`,
    error: `{
  "status": "error",
  "message": "API key does not have the required scope."
}`,
    migrationOld: `PerformHttpRequest('https://api.fivemanage.com/api/logs', cb, 'POST', json.encode(payload), {
  ['Authorization'] = token,
  ['Content-Type'] = 'application/json',
})`,
    migrationNew: `exports.fivebucket:Log(payload, cb)

exports.fivebucket:CapturePlayerScreenshot(source, {
  path = 'screenshots',
}, cb)`,
};

export default function Docs({ auth }) {
    if (auth.user) {
        return (
            <AuthenticatedLayout user={auth.user}>
                <Head title="Documentation" />
                <DocsPage dashboard />
            </AuthenticatedLayout>
        );
    }

    return (
        <div className="min-h-screen bg-[var(--app-bg)] text-[var(--fg)]">
            <Head title="Documentation" />

            <nav className="border-b border-[var(--border)] bg-[var(--surface)]">
                <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <Link href="/">
                        <ApplicationLogo />
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <Button asChild variant="secondary">
                            <Link href={auth.user ? route('dashboard') : route('login')}>
                                {auth.user ? 'Dashboard' : 'Login'}
                            </Link>
                        </Button>
                    </div>
                </div>
            </nav>

            <DocsPage />
        </div>
    );
}

function DocsPage({ dashboard = false }) {
    return (
        <div className={dashboard ? 'fb-page fb-docs-page' : 'mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[240px_1fr] lg:px-8'}>
            {dashboard && (
                <PageHeader
                    eyebrow="Resource"
                    title="Documentation"
                    description="Guide complet pour connecter un serveur FiveM, utiliser le SDK Lua, appeler l'API compatible Fivemanage et exploiter media/logs/SDK."
                    actions={<Badge>Fivemanage compatible</Badge>}
                />
            )}

            <aside className={dashboard ? 'fb-docs-sidebar' : 'hidden lg:block'}>
                <div className={dashboard ? 'fb-docs-nav' : 'sticky top-8 space-y-2'}>
                    {sections.map((section) => (
                        <a key={section.id} href={`#${section.id}`} className={dashboard ? 'fb-docs-nav-item' : 'block rounded-md px-3 py-2 text-[12px] font-medium fb-muted text-decoration-none hover:bg-[var(--surface)] hover:text-[var(--fg)]'}>
                            {section.label}
                        </a>
                    ))}
                </div>
            </aside>

            <main className={dashboard ? 'fb-docs-main' : 'space-y-8'}>
                {!dashboard && (
                    <header>
                        <Badge>Fivemanage compatible</Badge>
                        <h1 className="fb-page-title mt-4">FiveBucket Documentation</h1>
                        <p className="fb-page-subtitle mt-3 max-w-3xl">
                            Guide complet pour connecter un serveur FiveM, utiliser le SDK Lua, appeler l'API compatible Fivemanage et exploiter media/logs/SDK.
                        </p>
                    </header>
                )}

                <Section id="overview" icon={BookOpen} title="Overview">
                    <p className="text-[12px] leading-6 fb-muted">
                        FiveBucket remplace Fivemanage pour stocker les images, videos, fichiers audio, fichiers arbitraires et logs serveur. L'API reste compatible avec les routes Fivemanage courantes, mais ajoute un dashboard, des API keys scoper, ClickHouse pour les logs et un package Lua FiveM qui garde la cle API cote serveur.
                    </p>
                    <div className="grid gap-3 md:grid-cols-3">
                        <Feature icon={UploadCloud} title="Media hosting" detail="R2/S3, URL publique, base64, multipart, presigned upload et suppression." />
                        <Feature icon={ScrollText} title="Logs searchable" detail="Ingestion batch, metadata, niveaux, request_id, dashboards et exports." />
                        <Feature icon={ShieldCheck} title="Server-side SDK" detail="Exports Lua/JS utilisables sans exposer la cle API au client." />
                    </div>
                    <Callout>
                        Utilisez le SDK Lua pour les resources FiveM quand c'est possible. Utilisez les appels HTTP directs uniquement pour migrer une ancienne integration ou pour une integration non-FiveM.
                    </Callout>
                </Section>

                <Section id="install" icon={Terminal} title="Installation FiveM">
                    <p className="text-[12px] leading-6 fb-muted">
                        Copiez la resource `fivebucket` dans `resources/[nw]/fivebucket`, creez une API key dans le dashboard, puis ajoutez la configuration dans `server.cfg`. `screenshot-basic` doit demarrer avant `fivebucket`.
                    </p>
                    <Example title="server.cfg minimal + options utiles" code={examples.install} language="cfg" />
                    <div className="grid gap-3 md:grid-cols-2">
                        <Step number="1" title="Creer la cle">
                            Depuis API Keys, creez une cle avec les scopes `media`, `logs` et `sdk`.
                        </Step>
                        <Step number="2" title="Installer la resource">
                            Ajoutez `ensure screenshot-basic`, les convars FiveBucket, puis `ensure fivebucket`.
                        </Step>
                        <Step number="3" title="Tester">
                            En console serveur: `fivebucket_status`, `fivebucket_testlog`, puis ouvrez la page Logs.
                        </Step>
                        <Step number="4" title="Brancher vos scripts">
                            Depuis vos resources, appelez `exports.fivebucket:Info(...)` ou `exports.fivebucket:CapturePlayerScreenshot(...)`.
                        </Step>
                    </div>
                </Section>

                <Section id="auth" icon={KeyRound} title="Authentication & Scopes">
                    <p className="text-[12px] leading-6 fb-muted">
                        Les routes protegees acceptent la cle API dans `Authorization`, avec ou sans prefixe `Bearer`, ou en query `apiKey` pour compatibilite. En production, gardez la cle uniquement dans `server.cfg` ou dans l'environnement serveur.
                    </p>
                    <Grid>
                        <Example title="Auth formats accepted" code={examples.auth} language="http" />
                        <ReferenceTable
                            columns={['Scope', 'Permet']}
                            rows={[
                                ['media', 'Upload, list, read and delete files.'],
                                ['logs', 'Ingest logs and Discord webhook payloads.'],
                                ['sdk', 'Create FiveM SDK sessions.'],
                                ['*', 'All current API scopes.'],
                            ]}
                        />
                    </Grid>
                </Section>

                <Section id="lua-sdk" icon={Code2} title="Lua SDK FiveM">
                    <p className="text-[12px] leading-6 fb-muted">
                        Le package Lua expose des exports serveur et client. Les exports serveur appellent l'API avec la cle stockee dans `fivebucket_api_key`. Les exports client ne recoivent jamais la cle: ils demandent au serveur `fivebucket` de faire le travail.
                    </p>

                    <Grid>
                        <Example title="Server log helper" code={examples.luaServerLog} language="lua" />
                        <Example title="Batch logs" code={examples.luaServerBatch} language="lua" />
                        <Example title="Screenshot joueur serveur" code={examples.luaScreenshot} language="lua" />
                        <Example title="Client screenshot export" code={examples.luaClient} language="lua" />
                        <Example title="Phone media / data URL" code={examples.luaPhone} language="lua" />
                        <Example title="Upload resource file" code={examples.luaResourceFile} language="lua" />
                        <Example title="List / get / delete media" code={examples.luaListDelete} language="lua" />
                        <Example title="SDK report / heartbeat" code={examples.luaSdk} language="lua" />
                    </Grid>
                </Section>

                <Section id="js-sdk" icon={Code2} title="SDK JavaScript / TypeScript">
                    <p className="text-[12px] leading-6 fb-muted">
                        Le package officiel `@fivebucket/sdk` couvre les usages Node.js, panels internes, jobs d'administration et resources FiveM server-side JS. Il expose les uploads publics/prives, les signed URLs temporaires, les variants image et l'ingestion logs.
                    </p>
                    <Grid>
                        <Example title="Client TypeScript minimal" code={examples.jsSdkBasic} language="js" />
                        <Example title="Upload prive + signed variant" code={examples.jsSdkPrivateUpload} language="js" />
                    </Grid>
                    <Callout>
                        Le SDK JS/TS se trouve dans `packages/fivebucket-js`. Il est pret a compiler avec `npm run build` et n'ajoute aucune dependance runtime autre que `fetch`.
                    </Callout>
                </Section>

                <Section id="js-fivem" icon={Server} title="JavaScript FiveM">
                    <p className="text-[12px] leading-6 fb-muted">
                        En runtime JS FiveM, vous pouvez appeler les exports `fivebucket` de la meme facon. Pour les integrations HTTP directes, faites-les cote serveur uniquement et lisez la cle depuis une convar.
                    </p>
                    <Grid>
                        <Example title="JS serveur via exports FiveBucket" code={examples.jsServerExports} language="js" />
                        <Example title="JS client via capture export" code={examples.jsClientExports} language="js" />
                        <Example title="JS serveur HTTP direct" code={examples.jsDirectHttp} language="js" />
                    </Grid>
                </Section>

                <Section id="media" icon={UploadCloud} title="Media API">
                    <p className="text-[12px] leading-6 fb-muted">
                        Les medias supportent images, videos, audio et fichiers generiques. Les options communes sont `filename`, `path`, `metadata`, `retentionExempt`, `visibility=public|private` et `retention_exempt`. La reponse garde `url` au niveau racine pour compatibilite et expose aussi `assetUrl`, `variantUrl`, `signedUrl` et `duplicate`.
                    </p>
                    <Endpoint method="GET" path="/api/v3/file?limit=50&page=1&type=image&path=screenshots" description="List media. `limit` is capped at 100. Optional filters: `type`, `path`." />
                    <Endpoint method="POST" path="/api/v3/file" description="Multipart upload using field `file`, `image`, `video` or `audio`." />
                    <Endpoint method="POST" path="/api/v3/file/base64" description="JSON base64 upload. Accepts a data URL or base64 payload." />
                    <Endpoint method="GET" path="/api/v3/file/presigned-url" description="Generate a short-lived upload URL for browser/client uploads." />
                    <Endpoint method="GET" path="/api/v3/file/{id}/signed-url?expires=900&w=512&q=80&format=webp" description="Generate a temporary signed URL for private media or image variants." />
                    <Endpoint method="GET" path="/asset/{id}?w=512&q=80&format=webp" description="Serve an image variant as WebP. Private media requires a signed URL." />
                    <Endpoint method="GET / DELETE" path="/api/v3/file/{id}" description="Read or delete a single media object." />

                    <Grid>
                        <Example title="Multipart upload" code={examples.multipart} language="http" />
                        <Example title="Upload response" code={examples.uploadResponse} language="json" />
                        <Example title="Base64 upload" code={examples.base64} language="http" />
                        <Example title="List response" code={examples.listResponse} language="json" />
                        <Example title="Presigned URL" code={examples.presigned} language="http" />
                        <Example title="Image variant route" code={examples.assetVariant} language="http" />
                    </Grid>
                </Section>

                <Section id="framework-examples" icon={Workflow} title="Framework Examples">
                    <p className="text-[12px] leading-6 fb-muted">
                        Des exemples complets sont disponibles dans `examples/fivem/esx`, `examples/fivem/qbcore` et `examples/fivem/ox_core`. Ils montrent comment enrichir les logs avec les identifiants character/player de chaque framework.
                    </p>
                    <Grid>
                        <Example title="ESX admin audit" code={examples.esxExample} language="lua" />
                        <Example title="QBCore admin audit" code={examples.qbcoreExample} language="lua" />
                        <Example title="ox_core admin audit" code={examples.oxCoreExample} language="lua" />
                    </Grid>
                </Section>

                <Section id="logs" icon={ScrollText} title="Logs API">
                    <p className="text-[12px] leading-6 fb-muted">
                        Les logs sont optimises pour ClickHouse. Envoyez des tableaux pour reduire le nombre de requetes. Les champs standards sont `level`, `message`, `resource`, `dataset`, `timestamp` et `metadata`. Les niveaux `warning` et `critical` sont normalises en `warn` et `fatal`.
                    </p>
                    <Endpoint method="POST" path="/api/logs" description="Route legacy compatible. Accepts one object or an array." />
                    <Endpoint method="POST" path="/api/v3/logs" description="Route v3 batch. Accepts one object or an array." />
                    <Endpoint method="POST" path="/api/v3/logs/discord" description="Discord webhook compatible route. Embeds become log entries." />
                    <Grid>
                        <Example title="Batch logs with metadata" code={examples.logs} language="http" />
                        <Example title="Discord webhook logs" code={examples.discord} language="http" />
                    </Grid>
                    <ReferenceTable
                        columns={['Field', 'Type', 'Usage']}
                        rows={[
                            ['level', 'string', '`debug`, `info`, `warn`, `warning`, `error`, `fatal`, `critical`.'],
                            ['message', 'string', 'Main searchable message.'],
                            ['resource', 'string', 'FiveM resource name or logical service.'],
                            ['dataset', 'string', 'Extra grouping, copied into metadata if needed.'],
                            ['timestamp', 'ISO string', 'Event time. Defaults to server receive time.'],
                            ['metadata', 'object', 'Any JSON fields: playerSource, request_id, server_id, duration_ms, etc.'],
                        ]}
                    />
                </Section>

                <Section id="sdk" icon={RadioTower} title="SDK Session API">
                    <p className="text-[12px] leading-6 fb-muted">
                        Le SDK session sert a identifier une resource active et a maintenir un heartbeat. Le package Lua fait le `report` automatiquement au demarrage si `fivebucket_sdk_report=1`, puis renouvelle la session via `HeartbeatSdk`.
                    </p>
                    <Grid>
                        <Example title="Raw SDK report request" code={examples.sdkReport} language="http" />
                        <Example title="SDK report response" code={examples.sdkResponse} language="json" />
                        <Example title="Lua SDK controls" code={examples.luaSdk} language="lua" />
                    </Grid>
                </Section>

                <Section id="reference" icon={ListChecks} title="Reference">
                    <p className="text-[12px] leading-6 fb-muted">
                        Reference rapide des routes HTTP et des exports SDK. Les routes marquees `public temporary token` utilisent un token presigne et ne demandent pas la cle API principale.
                    </p>
                    <ReferenceTable columns={['Method', 'Path', 'Auth', 'Description']} rows={endpoints} />
                    <div className="mt-4" />
                    <ReferenceTable columns={['Lua export', 'Description']} rows={luaExports} />
                </Section>

                <Section id="errors" icon={FileJson} title="Responses & Errors">
                    <p className="text-[12px] leading-6 fb-muted">
                        Les routes media/logs renvoient une enveloppe JSON `status`. Les routes SDK renvoient directement `token`, `expiresAt` ou `message` pour rester compatibles avec les SDK clients.
                    </p>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Status code="200" label="OK" detail="Request accepted, file uploaded or resource returned." />
                        <Status code="400" label="Bad Request" detail="Invalid JSON, missing file, invalid SDK query." />
                        <Status code="401" label="Unauthorized" detail="Missing, invalid or expired API/SDK token." />
                        <Status code="403" label="Forbidden" detail="API key does not include the required scope." />
                        <Status code="404" label="Not Found" detail="Media or SDK session not found." />
                        <Status code="413" label="Too Large" detail="Upload exceeds quota or package-side size limits." />
                    </div>
                    <Example title="Error envelope" code={examples.error} language="json" />
                </Section>

                <Section id="migration" icon={Workflow} title="Migration depuis Fivemanage">
                    <p className="text-[12px] leading-6 fb-muted">
                        Pour une migration rapide, remplacez le domaine Fivemanage par votre domaine FiveBucket et gardez les routes. Pour une integration plus propre, utilisez les exports SDK et retirez les tokens des scripts client.
                    </p>
                    <Grid>
                        <Example title="Ancien appel HTTP direct" code={examples.migrationOld} language="lua" />
                        <Example title="Nouveau pattern avec SDK" code={examples.migrationNew} language="lua" />
                    </Grid>
                    <Callout>
                        Le changement le plus important est la securite: avec `CapturePlayerScreenshot` en mode `presigned`, le client upload le fichier sans connaitre la cle API FiveBucket.
                    </Callout>
                </Section>
            </main>
        </div>
    );
}

function Section({ id, icon: Icon, title, children }) {
    return (
        <Card id={id} className="scroll-mt-20">
            <CardHeader className="flex flex-row items-center gap-3">
                {Icon && (
                    <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[var(--accent)] text-white">
                        <Icon className="h-4 w-4" />
                    </div>
                )}
                <CardTitle className="text-base">{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    );
}

function Feature({ icon: Icon, title, detail }) {
    return (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="flex items-center gap-2 text-[12px] font-semibold text-[var(--fg)]">
                <Icon className="h-4 w-4 fb-dim" />
                {title}
            </div>
            <p className="mt-2 text-[11px] leading-5 fb-dim">{detail}</p>
        </div>
    );
}

function Step({ number, title, children }) {
    return (
        <div className="grid grid-cols-[30px_1fr] gap-3 rounded-md border border-[var(--border)] bg-[var(--bg)] p-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent-bg)] font-mono text-[11px] font-semibold text-[var(--accent-strong)]">
                {number}
            </div>
            <div>
                <div className="text-[12px] font-semibold text-[var(--fg)]">{title}</div>
                <p className="mt-1 text-[11px] leading-5 fb-muted">{children}</p>
            </div>
        </div>
    );
}

function Callout({ children }) {
    return (
        <div className="flex gap-3 rounded-md border border-[var(--accent-border)] bg-[var(--accent-bg)] p-3 text-[12px] leading-6 text-[var(--fg)]">
            <CheckCircle2 className="mt-1 h-4 w-4 flex-none text-[var(--accent-strong)]" />
            <div>{children}</div>
        </div>
    );
}

function Endpoint({ method, path, description }) {
    return (
        <div className="grid gap-3 rounded-md border border-[var(--border)] px-3 py-3 md:grid-cols-[110px_1fr] md:items-center">
            <Badge variant={method.includes('GET') ? 'green' : method.includes('DELETE') ? 'red' : 'default'}>{method}</Badge>
            <div className="min-w-0">
                <code className="break-all text-[12px] font-semibold text-[var(--fg)]">{path}</code>
                <p className="mt-1 text-[11px] fb-dim">{description}</p>
            </div>
        </div>
    );
}

function Grid({ children }) {
    return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

function Example({ title, code, language }) {
    return (
        <div className="overflow-hidden rounded-md border border-[var(--border)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--bg)] px-3 py-2">
                <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold fb-muted">
                    <Box className="h-3.5 w-3.5 fb-dim" />
                    <span className="truncate">{title}</span>
                    {language && <Badge>{language}</Badge>}
                </div>
                <button type="button" className="fb-icon-btn" onClick={() => navigator.clipboard?.writeText(code)} title="Copy">
                    <Copy className="h-4 w-4" />
                </button>
            </div>
            <CodeBlock code={code} language={language} />
        </div>
    );
}

function CodeBlock({ code, language }) {
    return (
        <pre className="fb-code overflow-auto p-4 text-xs leading-6">
            <code dangerouslySetInnerHTML={{ __html: highlight(code, language) }} />
        </pre>
    );
}

function ReferenceTable({ columns, rows }) {
    return (
        <div className="fb-table-wrap">
            <table className="fb-table">
                <thead>
                    <tr>
                        {columns.map((column) => <th key={column}>{column}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, index) => (
                        <tr key={`${row[0]}-${index}`}>
                            {row.map((cell, cellIndex) => (
                                <td key={`${row[0]}-${cellIndex}`}>
                                    {cellIndex === 0 ? (
                                        <code className="fb-inline-code fb-break">{cell}</code>
                                    ) : (
                                        <span className="fb-break" dangerouslySetInnerHTML={{ __html: inlineFormat(String(cell)) }} />
                                    )}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function Status({ code, label, detail }) {
    return (
        <div className="rounded-md border border-[var(--border)] p-3">
            <div className="flex items-center gap-2">
                <Badge variant={code.startsWith('2') ? 'green' : code.startsWith('4') ? 'amber' : 'red'}>{code}</Badge>
                <span className="text-[12px] font-semibold text-[var(--fg)]">{label}</span>
            </div>
            <p className="mt-2 text-[11px] leading-5 fb-dim">{detail}</p>
        </div>
    );
}

function highlight(code, language) {
    const escaped = escapeHtml(code);

    if (language === 'json') {
        return escaped
            .replace(/(&quot;[^&]+&quot;)(\s*:)/g, '<span class="text-sky-300">$1</span>$2')
            .replace(/(:\s*)(&quot;.*?&quot;)/g, '$1<span class="text-emerald-300">$2</span>')
            .replace(/\b(true|false|null)\b/g, '<span class="text-amber-300">$1</span>')
            .replace(/\b(\d+)\b/g, '<span class="text-violet-300">$1</span>');
    }

    if (language === 'http') {
        return escaped
            .replace(/^(GET|POST|DELETE|PATCH|PUT|HTTP\/1\.1)(\s+[^\n]+)?/gm, '<span class="text-amber-300">$1</span><span class="text-sky-300">$2</span>')
            .replace(/^(Authorization|Content-Type|Accept):/gm, '<span class="text-violet-300">$1</span>:')
            .replace(/(fbk_[A-Za-z0-9_]+)/g, '<span class="text-emerald-300">$1</span>')
            .replace(/(sdk_[A-Za-z0-9_]+)/g, '<span class="text-emerald-300">$1</span>');
    }

    if (language === 'lua') {
        return escaped
            .replace(/(--.*)$/gm, '<span class="text-slate-400">$1</span>')
            .replace(/\b(local|function|end|if|then|else|elseif|return|for|in|do|while|true|false|nil)\b/g, '<span class="text-violet-300">$1</span>')
            .replace(/\b(exports|RegisterCommand|PerformHttpRequest|GetCurrentResourceName|GetConvar|GetGameTimer|print)\b/g, '<span class="text-sky-300">$1</span>')
            .replace(/(&#039;.*?&#039;|&quot;.*?&quot;)/g, '<span class="text-emerald-300">$1</span>');
    }

    if (language === 'js') {
        return escaped
            .replace(/(\/\/.*)$/gm, '<span class="text-slate-400">$1</span>')
            .replace(/\b(const|let|var|function|return|if|else|true|false|null|undefined)\b/g, '<span class="text-violet-300">$1</span>')
            .replace(/\b(RegisterCommand|PerformHttpRequest|GetCurrentResourceName|GetConvar|GetGameTimer|console|exports)\b/g, '<span class="text-sky-300">$1</span>')
            .replace(/(&#039;.*?&#039;|&quot;.*?&quot;)/g, '<span class="text-emerald-300">$1</span>');
    }

    if (language === 'cfg' || language === 'bash') {
        return escaped
            .replace(/^(#.*)$/gm, '<span class="text-slate-400">$1</span>')
            .replace(/\b(ensure|set|setr|add_ace)\b/g, '<span class="text-amber-300">$1</span>')
            .replace(/(&quot;.*?&quot;)/g, '<span class="text-emerald-300">$1</span>');
    }

    return escaped;
}

function inlineFormat(value) {
    return escapeHtml(value).replace(/`([^`]+)`/g, '<code class="fb-inline-code">$1</code>');
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}
