import { cn } from '@/lib/utils';

export function Card({ className, ...props }) {
    return <div className={cn('fb-panel', className)} {...props} />;
}

export function CardHeader({ className, ...props }) {
    return <div className={cn('fb-panel-header', className)} {...props} />;
}

export function CardTitle({ className, ...props }) {
    return <h3 className={cn('fb-panel-title', className)} {...props} />;
}

export function CardContent({ className, ...props }) {
    return <div className={cn('fb-panel-content', className)} {...props} />;
}
