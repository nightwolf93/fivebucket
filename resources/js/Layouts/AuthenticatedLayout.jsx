import ApplicationLogo from '@/Components/ApplicationLogo';
import ThemeToggle from '@/Components/ThemeToggle';
import { Link, router, usePage } from '@inertiajs/react';
import {
    BookOpen,
    Boxes,
    ChevronDown,
    KeyRound,
    LayoutDashboard,
    LogOut,
    Menu,
    Search,
    ScrollText,
    Settings,
    Shield,
    User,
    X,
} from 'lucide-react';
import { useState } from 'react';

const baseNavigation = [
    {
        title: null,
        items: [
            { label: 'Dashboard', href: () => route('dashboard'), active: () => route().current('dashboard'), icon: LayoutDashboard },
            { label: 'Logs', href: () => route('logs.index'), active: () => route().current('logs.*'), icon: ScrollText, trail: 'L' },
            { label: 'Media', href: () => route('media.index'), active: () => route().current('media.*'), icon: Boxes },
            { label: 'API Keys', href: () => route('api-keys.index'), active: () => route().current('api-keys.*'), icon: KeyRound },
        ],
    },
    {
        title: 'Resource',
        items: [
            { label: 'Documentation', href: () => route('docs'), active: () => route().current('docs'), icon: BookOpen },
            { label: 'Settings', href: () => route('settings.index'), active: () => route().current('settings.*'), icon: Settings },
        ],
    },
];

export default function Authenticated({ user, children }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const { team } = usePage().props;

    const navigation = baseNavigation.map((section) => ({
        ...section,
        items: [...section.items],
    }));

    if (user?.isAdmin) {
        navigation[1].items.push({
            label: 'Admin',
            href: () => route('admin.accounts.index'),
            active: () => route().current('admin.*'),
            icon: Shield,
        });
    }

    const activeItem = navigation
        .flatMap((section) => section.items)
        .find((item) => item.active());
    const initials = initialsFor(user?.name || user?.email || 'FB');

    return (
        <div className="fb-shell">
            <aside className="fb-sidebar">
                <Link href={route('dashboard')} className="fb-brand">
                    <ApplicationLogo />
                    <span className="fb-brand-badge">v1</span>
                </Link>

                <NavigationSections sections={navigation} />

                <Link href={route('settings.index')} className="fb-org-switcher">
                    <div className="fb-org-avatar">{initialsFor(team?.name || user?.name || 'FB')}</div>
                    <div className="fb-org-meta">
                        <div className="fb-org-name">{team?.name || user?.name}</div>
                        <div className="fb-org-plan">{team?.plan?.name || 'workspace'} · {team?.slug || 'fivebucket'}</div>
                    </div>
                    <ChevronDown className="h-3.5 w-3.5 fb-dim" />
                </Link>
            </aside>

            <main className="fb-main">
                <div className="fb-mobilebar">
                    <Link href={route('dashboard')} className="flex items-center gap-2 text-decoration-none">
                        <ApplicationLogo />
                    </Link>
                    <div className="flex items-center gap-2">
                        <ThemeToggle />
                        <button type="button" className="fb-button icon" onClick={() => setMobileOpen((value) => !value)}>
                            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                        </button>
                    </div>
                </div>

                {mobileOpen && (
                    <div className="fb-mobile-nav">
                        <NavigationSections sections={navigation} onNavigate={() => setMobileOpen(false)} />
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            <Link href={route('profile.edit')} className="fb-button ghost sm">
                                <User className="h-3.5 w-3.5" />
                                Profile
                            </Link>
                            <Link href={route('logout')} method="post" as="button" className="fb-button ghost sm">
                                <LogOut className="h-3.5 w-3.5" />
                                Log out
                            </Link>
                        </div>
                    </div>
                )}

                <div className="fb-topbar">
                    <div className="fb-crumbs">
                        <span className="fb-crumb-server">{team?.slug || 'fivebucket'}</span>
                        <span className="fb-crumb-sep">/</span>
                        <span className="fb-crumb-current">{activeItem?.label || 'Dashboard'}</span>
                    </div>

                    <div className="fb-topbar-spacer" />

                    <button
                        type="button"
                        className="fb-search"
                        onClick={() => {
                            if (route().current('logs.*')) {
                                document.querySelector('.fb-logs-search input')?.focus();
                            } else {
                                router.visit(route('logs.index'));
                            }
                        }}
                    >
                        <Search className="h-3.5 w-3.5" />
                        <span>Search logs, assets, keys...</span>
                        <span className="fb-kbd">/</span>
                    </button>

                    <ThemeToggle />

                    <Link href={route('profile.edit')} className="fb-user-chip">
                        <span className="fb-avatar">{initials}</span>
                        <span>{user?.name}</span>
                        <ChevronDown className="h-3 w-3 fb-dim" />
                    </Link>

                    <Link href={route('logout')} method="post" as="button" className="fb-button ghost icon" title="Log out">
                        <LogOut className="h-4 w-4" />
                    </Link>
                </div>

                <div className="fb-content">{children}</div>
            </main>
        </div>
    );
}

function NavigationSections({ sections, onNavigate }) {
    return sections.map((section, index) => (
        <div key={section.title || index}>
            {section.title && <div className="fb-nav-section-title">{section.title}</div>}
            {section.items.map((item) => {
                const Icon = item.icon;
                const active = item.active();

                return (
                    <Link
                        key={item.label}
                        href={item.href()}
                        onClick={onNavigate}
                        className={`fb-nav-item ${active ? 'active' : ''}`}
                    >
                        <Icon className="fb-nav-icon" />
                        <span>{item.label}</span>
                        {item.trail && <span className="fb-nav-trail">{item.trail}</span>}
                    </Link>
                );
            })}
        </div>
    ));
}

function initialsFor(value) {
    return String(value || 'FB')
        .split(/\s|-/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'FB';
}
