import { cn } from '@/lib/utils';

export function Progress({ value = 0, className }) {
    const width = Math.max(0, Math.min(Number(value) || 0, 100));

    return (
        <div className={cn('fb-progress', className)}>
            <div className="fb-progress-bar" style={{ width: `${width}%` }} />
        </div>
    );
}
