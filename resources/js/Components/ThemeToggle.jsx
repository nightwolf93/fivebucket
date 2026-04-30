import { Button } from '@/Components/ui/button';
import { applyTheme, initialTheme } from '@/lib/theme';
import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function ThemeToggle({ className = '' }) {
    const [theme, setTheme] = useState(initialTheme);
    const isDark = theme === 'dark';

    useEffect(() => {
        applyTheme(theme, true);
    }, [theme]);

    return (
        <Button
            type="button"
            variant="secondary"
            size="icon"
            className={className}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            title={isDark ? 'Light theme' : 'Dark theme'}
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
        >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
    );
}
