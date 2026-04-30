import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
    return <div className={cn('rounded-lg border border-slate-200 bg-white shadow-sm', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
    return <div className={cn('border-b border-slate-100 px-5 py-4', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
    return <h3 className={cn('text-sm font-semibold text-slate-950', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
    return <div className={cn('px-5 py-4', className)} {...props} />;
}
