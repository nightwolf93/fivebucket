import { Boxes } from 'lucide-react';

export default function ApplicationLogo({ className }) {
    return (
        <span className={className ?? 'flex items-center gap-2'}>
            <span className="fb-brand-mark">
                <Boxes className="h-4 w-4" />
            </span>
            <span className="fb-brand-word">FiveBucket</span>
        </span>
    );
}
