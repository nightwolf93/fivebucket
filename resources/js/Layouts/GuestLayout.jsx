import ApplicationLogo from '@/Components/ApplicationLogo';
import ThemeToggle from '@/Components/ThemeToggle';
import { Link } from '@inertiajs/react';

export default function Guest({
    children,
    title = 'Sign in to FiveBucket',
    subtitle = 'Access your workspace, browse logs, and manage your media library.',
    alt,
}) {
    return (
        <div className="fb-auth-page">
            <main className="fb-auth-form-panel">
                <div className="fb-auth-header">
                    <Link href="/" className="flex items-center gap-2 text-decoration-none">
                        <ApplicationLogo />
                    </Link>
                    <div className="flex items-center gap-3">
                        {alt}
                        <ThemeToggle />
                    </div>
                </div>

                <div className="fb-auth-form">
                    <div className="fb-auth-eyebrow">Account access</div>
                    <h1>{title}</h1>
                    <p className="fb-auth-lede">{subtitle}</p>
                    {children}
                </div>

                <div className="fb-auth-footer">
                    <div className="flex gap-4">
                        <Link href={route('docs')}>Docs</Link>
                        <a href="mailto:support@fivebucket.nightwolf.fr">Contact</a>
                    </div>
                    <div className="fb-status-pill active">service online</div>
                </div>
            </main>

            <aside className="fb-auth-side">
                <div className="fb-hero-console">
                    <div className="fb-hero-console-head">
                        <span className="fb-hero-console-dot" />
                        <span className="fb-hero-console-dot" />
                        <span className="fb-hero-console-dot" />
                        <span className="ml-auto fb-mono text-[10px] fb-dim">fivebucket.lua</span>
                    </div>
                    <div className="fb-hero-console-body">
                        <pre className="fb-code m-0">{`exports.fivebucket:Info('Player connected', {
  source = source,
  resource = GetCurrentResourceName()
})

exports.fivebucket:CapturePlayerScreenshot(source, {
  path = 'screenshots/profiles'
}, function(result)
  print(result.data.data.url)
end)`}</pre>
                    </div>
                </div>
            </aside>
        </div>
    );
}
