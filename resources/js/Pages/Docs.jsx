import ApplicationLogo from '@/Components/ApplicationLogo';
import { PageHeader } from '@/Components/Design';
import ThemeToggle from '@/Components/ThemeToggle';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/Components/ui/card';
import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head, Link } from '@inertiajs/react';
import { BookOpen, Copy, KeyRound, ScrollText, UploadCloud } from 'lucide-react';

const sections = [
    { id: 'auth', label: 'Auth' },
    { id: 'media', label: 'Media' },
    { id: 'logs', label: 'Logs' },
    { id: 'sdk', label: 'SDK' },
    { id: 'errors', label: 'Errors' },
];

const examples = {
    multipart: `POST /api/v3/file HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: multipart/form-data

file=@screenshot.png
metadata={"playerSource":42,"resource":"police"}`,
    uploadResponse: `{
  "status": "ok",
  "data": {
    "id": "01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
    "url": "https://cdn.example.com/uploads/01HV7AJ1KJ3W4Y9QH7N7B9XGRT.png",
    "originalUrl": "https://cdn.example.com/uploads/01HV7AJ1KJ3W4Y9QH7N7B9XGRT.png"
  }
}`,
    base64: `POST /api/v3/file/base64 HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "base64": "data:image/png;base64,iVBORw0KGgo...",
  "filename": "evidence.png",
  "metadata": {
    "caseId": "BCSO-1042"
  }
}`,
    listResponse: `{
  "status": "ok",
  "data": [
    {
      "id": "01HV7AJ1KJ3W4Y9QH7N7B9XGRT",
      "url": "https://cdn.example.com/uploads/evidence.png",
      "type": "image",
      "filename": "evidence.png",
      "size": 38291,
      "metadata": {
        "caseId": "BCSO-1042"
      }
    }
  ]
}`,
    logs: `POST /api/logs HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

[
  {
    "level": "info",
    "message": "Player connected",
    "resource": "players",
    "metadata": {
      "playerSource": 42,
      "license": "license:abc"
    }
  },
  {
    "level": "error",
    "message": "Vehicle spawn failed",
    "dataset": "vehicles",
    "timestamp": "2026-04-30T19:30:00Z"
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
      "timestamp": "2026-04-30T19:30:00Z"
    }
  ]
}`,
    sdk: `POST /api/sdk/report HTTP/1.1
Authorization: fbk_xxxxxxxxxxxxxxxxx
Content-Type: application/json

{
  "resource": "fivebucket",
  "version": "1.0.0",
  "server": "main",
  "metadata": {
    "artifact": "FXServer"
  }
}`,
    error: `{
  "status": "error",
  "message": "Invalid API token."
}`,
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
                    description="Routes, request formats, response envelopes, and examples for media hosting, logs, presigned uploads, and SDK endpoints."
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
                        <h1 className="fb-page-title mt-4">FiveBucket API Docs</h1>
                        <p className="fb-page-subtitle mt-3 max-w-3xl">
                            Routes, request formats, response envelopes, and examples for media hosting, logs, presigned uploads, and SDK endpoints.
                        </p>
                    </header>
                )}

                <Section id="auth" icon={KeyRound} title="Authentication">
                    <p className="text-[12px] leading-6 fb-muted">
                        Every protected API route accepts the API key either as the raw `Authorization` header or as the `apiKey` query parameter.
                    </p>
                    <div className="grid gap-4 md:grid-cols-2">
                        <CodeBlock language="http" code={`Authorization: fbk_xxxxxxxxxxxxxxxxx`} />
                        <CodeBlock language="http" code={`GET /api/v3/file?apiKey=fbk_xxxxxxxxxxxxxxxxx`} />
                    </div>
                </Section>

                <Section id="media" icon={UploadCloud} title="Media API">
                    <Endpoint method="GET" path="/api/v3/file" description="List uploaded media files for the current team." />
                    <Endpoint method="POST" path="/api/v3/file" description="Upload images, videos, audio, or arbitrary files with multipart form data." />
                    <Endpoint method="POST" path="/api/v3/file/base64" description="Upload a base64 encoded file." />
                    <Endpoint method="GET" path="/api/v3/file/presigned-url" description="Generate a temporary browser upload URL." />
                    <Endpoint method="POST" path="/api/v3/file/presigned-url/{token}" description="Upload to a generated presigned URL without exposing the API key." />
                    <Endpoint method="GET" path="/api/v3/file/{id}" description="Fetch one file metadata record." />
                    <Endpoint method="DELETE" path="/api/v3/file/{id}" description="Delete one media record and its R2 object." />

                    <Grid>
                        <Example title="Multipart upload" code={examples.multipart} language="http" />
                        <Example title="Upload response" code={examples.uploadResponse} language="json" />
                        <Example title="Base64 upload" code={examples.base64} language="http" />
                        <Example title="List response" code={examples.listResponse} language="json" />
                    </Grid>
                </Section>

                <Section id="logs" icon={ScrollText} title="Logs API">
                    <Endpoint method="POST" path="/api/logs" description="Legacy-compatible ingest route. Accepts one object or an array." />
                    <Endpoint method="POST" path="/api/v3/logs" description="Batch log ingest route. Accepts an array of log entries." />
                    <Endpoint method="POST" path="/api/v3/logs/discord" description="Discord webhook compatible ingest route." />

                    <Grid>
                        <Example title="Batch logs" code={examples.logs} language="http" />
                        <Example title="Discord webhook logs" code={examples.discord} language="http" />
                    </Grid>
                </Section>

                <Section id="sdk" icon={BookOpen} title="SDK Endpoints">
                    <Endpoint method="POST" path="/api/sdk/report" description="Report resource/version metadata from a FiveM resource." />
                    <Endpoint method="POST" path="/api/sdk/heartbeat" description="Public heartbeat endpoint used by SDK clients." />
                    <Endpoint method="POST" path="/api/sdk/invalidate" description="Invalidate SDK session state." />
                    <Example title="SDK report" code={examples.sdk} language="http" />
                </Section>

                <Section id="errors" title="Responses & Errors">
                    <p className="text-[12px] leading-6 fb-muted">
                        Successful responses use <code>{"{\"status\": \"ok\"}"}</code>. Failed responses use{' '}
                        <code>{"{\"status\": \"error\"}"}</code> and a human-readable message.
                    </p>
                    <div className="grid gap-4 md:grid-cols-3">
                        <Status code="200" label="OK" detail="Request accepted or file returned." />
                        <Status code="400" label="Bad Request" detail="Invalid payload or missing file." />
                        <Status code="401" label="Unauthorized" detail="Missing or invalid API key." />
                        <Status code="403" label="Forbidden" detail="API key does not have the required scope." />
                        <Status code="404" label="Not Found" detail="Media, token, or route not found." />
                        <Status code="500" label="Server Error" detail="Unexpected storage or application failure." />
                    </div>
                    <Example title="Error envelope" code={examples.error} language="json" />
                </Section>
            </main>
        </div>
    );
}

function Section({ id, icon: Icon, title, children }) {
    return (
        <Card id={id} className="scroll-mt-8">
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

function Endpoint({ method, path, description }) {
    return (
        <div className="grid gap-3 rounded-md border border-[var(--border)] px-3 py-3 md:grid-cols-[92px_1fr] md:items-center">
            <Badge variant={method === 'GET' ? 'green' : method === 'DELETE' ? 'red' : 'default'}>{method}</Badge>
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
                <div className="text-[11px] font-semibold fb-muted">{title}</div>
                <button type="button" className="fb-icon-button" onClick={() => navigator.clipboard?.writeText(code)}>
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
            .replace(/^(GET|POST|DELETE|PATCH|PUT)(\s+[^\n]+)/gm, '<span class="text-amber-300">$1</span><span class="text-sky-300">$2</span>')
            .replace(/^(Authorization|Content-Type|Accept):/gm, '<span class="text-violet-300">$1</span>:')
            .replace(/(fbk_[A-Za-z0-9_]+)/g, '<span class="text-emerald-300">$1</span>');
    }

    return escaped;
}

function escapeHtml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
}
