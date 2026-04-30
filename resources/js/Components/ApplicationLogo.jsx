import { Cloud } from 'lucide-react';

export default function ApplicationLogo({ className }) {
    return (
        <span className={className}>
            <Cloud className="h-5 w-5" />
            <span className="font-semibold text-slate-950 dark:text-slate-50">FiveBucket</span>
        </span>
    );
}
