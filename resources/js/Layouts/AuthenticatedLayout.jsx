import { useState } from 'react';
import ApplicationLogo from '@/Components/ApplicationLogo';
import Dropdown from '@/Components/Dropdown';
import NavLink from '@/Components/NavLink';
import ResponsiveNavLink from '@/Components/ResponsiveNavLink';
import ThemeToggle from '@/Components/ThemeToggle';
import { Link } from '@inertiajs/react';
import { BookOpen, Boxes, ChevronDown, KeyRound, LayoutDashboard, Menu, ScrollText, Settings, Shield, X } from 'lucide-react';

export default function Authenticated({ user, header, children }) {
    const [showingNavigationDropdown, setShowingNavigationDropdown] = useState(false);
    const navItems = [
        { label: 'Dashboard', href: route('dashboard'), active: route().current('dashboard'), icon: LayoutDashboard },
        { label: 'API Keys', href: route('api-keys.index'), active: route().current('api-keys.*'), icon: KeyRound },
        { label: 'Media', href: route('media.index'), active: route().current('media.*'), icon: Boxes },
        { label: 'Logs', href: route('logs.index'), active: route().current('logs.*'), icon: ScrollText },
        { label: 'Docs', href: route('docs'), active: route().current('docs'), icon: BookOpen },
        { label: 'Settings', href: route('settings.index'), active: route().current('settings.*'), icon: Settings },
    ];

    if (user.isAdmin) {
        navItems.push({
            label: 'Admin',
            href: route('admin.accounts.index'),
            active: route().current('admin.*'),
            icon: Shield,
        });
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="border-b border-slate-200 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16">
                        <div className="flex">
                            <div className="shrink-0 flex items-center">
                                <Link href="/">
                                    <ApplicationLogo className="flex items-center gap-2 text-slate-900" />
                                </Link>
                            </div>

                            <div className="hidden space-x-7 sm:-my-px sm:ms-10 sm:flex">
                                {navItems.map((item) => (
                                    <NavLink key={item.label} href={item.href} active={item.active}>
                                        <span className="inline-flex items-center gap-2">
                                            <item.icon className="h-4 w-4" />
                                            {item.label}
                                        </span>
                                    </NavLink>
                                ))}
                            </div>
                        </div>

                        <div className="hidden sm:flex sm:items-center sm:ms-6">
                            <ThemeToggle />
                            <div className="ms-3 relative">
                                <Dropdown>
                                    <Dropdown.Trigger>
                                        <span className="inline-flex rounded-md">
                                            <button
                                                type="button"
                                                className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium leading-4 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none"
                                            >
                                                {user.name}
                                                <ChevronDown className="h-4 w-4" />
                                            </button>
                                        </span>
                                    </Dropdown.Trigger>

                                    <Dropdown.Content>
                                        <Dropdown.Link href={route('profile.edit')}>Profile</Dropdown.Link>
                                        <Dropdown.Link href={route('logout')} method="post" as="button">
                                            Log Out
                                        </Dropdown.Link>
                                    </Dropdown.Content>
                                </Dropdown>
                            </div>
                        </div>

                        <div className="-me-2 flex items-center gap-2 sm:hidden">
                            <ThemeToggle />
                            <button
                                onClick={() => setShowingNavigationDropdown((previousState) => !previousState)}
                                className="inline-flex items-center justify-center rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus:outline-none"
                            >
                                {showingNavigationDropdown ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                <div className={(showingNavigationDropdown ? 'block' : 'hidden') + ' sm:hidden'}>
                    <div className="pt-2 pb-3 space-y-1">
                        {navItems.map((item) => (
                            <ResponsiveNavLink key={item.label} href={item.href} active={item.active}>
                                {item.label}
                            </ResponsiveNavLink>
                        ))}
                    </div>

                    <div className="pt-4 pb-1 border-t border-slate-200">
                        <div className="px-4">
                            <div className="font-medium text-base text-slate-900">{user.name}</div>
                            <div className="font-medium text-sm text-slate-500">{user.email}</div>
                        </div>

                        <div className="mt-3 space-y-1">
                            <ResponsiveNavLink href={route('profile.edit')}>Profile</ResponsiveNavLink>
                            <ResponsiveNavLink method="post" href={route('logout')} as="button">
                                Log Out
                            </ResponsiveNavLink>
                        </div>
                    </div>
                </div>
            </nav>

            {header && (
                <header className="border-b border-slate-200 bg-white">
                    <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">{header}</div>
                </header>
            )}

            <main>{children}</main>
        </div>
    );
}
