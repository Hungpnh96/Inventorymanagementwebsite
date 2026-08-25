import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';
type ResolvedTheme = 'light' | 'dark';

interface ThemeCtx {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (t: Theme) => void;
}

const Ctx = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = 'theme';

function readStored(): Theme {
  if (typeof window === 'undefined') return 'light';
  const raw = localStorage.getItem(STORAGE_KEY);
  // Default = light. Only honor explicit dark or system choices the user previously made.
  return raw === 'dark' || raw === 'system' ? raw : 'light';
}

function resolve(t: Theme): ResolvedTheme {
  if (t === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return t;
}

function apply(resolved: ResolvedTheme) {
  const root = document.documentElement;
  if (resolved === 'dark') root.classList.add('dark');
  else root.classList.remove('dark');
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored());
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readStored()));

  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    apply(r);
    if (theme === 'system') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      if (theme === 'system') {
        const r = mq.matches ? 'dark' : 'light';
        setResolved(r);
        apply(r);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return <Ctx.Provider value={{ theme, resolved, setTheme: setThemeState }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useTheme must be used within ThemeProvider');
  return v;
}
