import { useEffect, useState } from 'react';

export type StocksTheme = 'dark' | 'light';

const STORAGE_KEY = 'stocks-theme';

export function useStocksTheme() {
  const [theme, setTheme] = useState<StocksTheme>(() => {
    try {
      return (localStorage.getItem(STORAGE_KEY) as StocksTheme | null) ?? 'dark';
    } catch {
      return 'dark';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Ignore localStorage failures.
    }
  }, [theme]);

  return {
    theme,
    setTheme,
    themeClassName: theme === 'dark' ? 'stocks-theme-dark' : 'stocks-theme-light',
  };
}