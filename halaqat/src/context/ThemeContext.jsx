import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage.js';

const ThemeContext = createContext(null);

export const THEME_MODES = ['light', 'dark', 'system'];

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode, systemDark) {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return mode;
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    const stored = readStorage(STORAGE_KEYS.theme, 'system');
    return THEME_MODES.includes(stored) ? stored : 'system';
  });
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // الاستجابة الفورية لتغير مظهر نظام التشغيل أثناء فتح الموقع.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (event) => setSystemDark(event.matches);
    if (mql.addEventListener) {
      mql.addEventListener('change', handler);
      return () => mql.removeEventListener('change', handler);
    }
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }, []);

  const resolved = resolveTheme(mode, systemDark);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-mode', mode);
  }, [resolved, mode]);

  const setMode = useCallback((next) => {
    const value = THEME_MODES.includes(next) ? next : 'system';
    setModeState(value);
    writeStorage(STORAGE_KEYS.theme, value);
  }, []);

  const toggle = useCallback(() => {
    setMode(resolved === 'dark' ? 'light' : 'dark');
  }, [resolved, setMode]);

  const value = useMemo(
    () => ({ mode, resolved, isDark: resolved === 'dark', setMode, toggle, modes: THEME_MODES }),
    [mode, resolved, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme يجب استخدامه داخل ThemeProvider');
  return ctx;
}
