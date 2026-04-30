import { cn } from '@/lib/utils';

export function Progress({ value = 0, className }) {
    const width = Math.max(0, Math.min(Number(value) || 0, 100));

    return (
        <div className={cn('h-2 overflow-hidden rounded-full bg-slate-100', className)}>
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${width}%` }} />
        </div>
    );
}
