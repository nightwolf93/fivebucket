import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Link } from '@inertiajs/react';
import { Copy, ExternalLink } from 'lucide-react';

export function PageHeader({ eyebrow, title, description, actions }) {
    return (
        <div className="fb-page-header">
            <div>
                {eyebrow && <p className="fb-eyebrow">{eyebrow}</p>}
                <h1 className="fb-page-title">{title}</h1>
                {description && <p className="fb-page-subtitle">{description}</p>}
            </div>
            {actions && <div className="fb-page-actions">{actions}</div>}
        </div>
    );
}

export function KpiCard({ label, value, detail, icon: Icon, tone = 'default' }) {
    const color = tone === 'red' ? 'var(--lvl-error)' : tone === 'amber' ? 'var(--lvl-warn)' : tone === 'muted' ? 'var(--fg-dim)' : 'var(--accent)';

    return (
        <div className="fb-kpi">
            <div className="fb-kpi-top">
                <div className="fb-kpi-label">
                    <span className="fb-kpi-dot" style={{ background: color }} />
                    {label}
                </div>
                {Icon && <Icon className="h-4 w-4 fb-dim" />}
            </div>
            <div className="fb-kpi-value">{value}</div>
            {detail && <div className="fb-kpi-detail">{detail}</div>}
        </div>
    );
}

export function EmptyState({ children, compact = false }) {
    return <div className="fb-empty" style={compact ? { minHeight: 90 } : undefined}>{children}</div>;
}

export function Pagination({ links }) {
    if (!links?.length) return null;

    return (
        <div className="fb-pagination">
            {links.map((link, index) => (
                <Link
                    key={`${link.label}-${index}`}
                    href={link.url ?? '#'}
                    preserveScroll
                    className={`${link.active ? 'active' : ''} ${!link.url ? 'disabled' : ''}`}
                    dangerouslySetInnerHTML={{ __html: link.label }}
                />
            ))}
        </div>
    );
}

export function CopyButton({ value, label = 'Copy', size = 'sm' }) {
    return (
        <Button type="button" variant="secondary" size={size} onClick={() => navigator.clipboard?.writeText(value)}>
            <Copy className="h-3.5 w-3.5" />
            {label}
        </Button>
    );
}

export function ExternalButton({ href, label = 'Open' }) {
    return (
        <Button asChild type="button" variant="secondary" size="sm">
            <a href={href} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3.5 w-3.5" />
                {label}
            </a>
        </Button>
    );
}

export function Field({ label, help, error, children }) {
    return (
        <label className="fb-label">
            {label}
            <div className="mt-1">{children}</div>
            {help && <span className="fb-help">{help}</span>}
            {error && <span className="fb-error-text">{error}</span>}
        </label>
    );
}

export function SectionTitle({ icon: Icon, title, meta }) {
    return (
        <div className="flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 fb-dim" />}
            <span className="fb-panel-title">{title}</span>
            {meta && <Badge>{meta}</Badge>}
        </div>
    );
}
