const storageKey = 'fivebucket-theme';

export function initialTheme() {
    if (typeof window === 'undefined') {
        return 'light';
    }

    const stored = window.localStorage.getItem(storageKey);

    if (stored === 'light' || stored === 'dark') {
        return stored;
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme, persist = false) {
    if (typeof document === 'undefined') {
        return;
    }

    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;

    if (persist && typeof window !== 'undefined') {
        window.localStorage.setItem(storageKey, theme);
    }
}
