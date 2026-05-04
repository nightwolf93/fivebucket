import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
    'fb-button focus-visible:outline-none disabled:pointer-events-none',
    {
        variants: {
            variant: {
                default: 'primary',
                secondary: '',
                ghost: 'ghost',
                destructive: 'danger',
            },
            size: {
                default: '',
                sm: 'sm',
                icon: 'icon',
            },
        },
        defaultVariants: {
            variant: 'default',
            size: 'default',
        },
    },
);

export function Button({ className, variant, size, asChild = false, ...props }) {
    const Comp = asChild ? Slot : 'button';

    return <Comp className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
