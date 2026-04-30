import ApplicationLogo from '@/Components/ApplicationLogo';
import ThemeToggle from '@/Components/ThemeToggle';
import { Link } from '@inertiajs/react';

export default function Guest({ children }) {
    return (
        <div className="min-h-screen flex flex-col sm:justify-center items-center pt-6 sm:pt-0 bg-slate-50">
            <div className="fixed right-4 top-4">
                <ThemeToggle />
            </div>

            <div>
                <Link href="/">
                    <ApplicationLogo className="flex items-center gap-2 text-slate-900" />
                </Link>
            </div>

            <div className="w-full sm:max-w-md mt-6 px-6 py-4 bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden sm:rounded-lg">
                {children}
            </div>
        </div>
    );
}
