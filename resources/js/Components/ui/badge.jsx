import { cn } from '@/lib/utils';

const variants = {
    default: '',
    green: 'green',
    amber: 'amber',
    red: 'red',
};

export function Badge({ className, variant = 'default', ...props }) {
    return (
        <span
            className={cn(
                'fb-badge',
                variants[variant],
                className,
            )}
            {...props}
        />
    );
}
