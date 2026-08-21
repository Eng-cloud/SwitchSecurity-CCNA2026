import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage.js';

const ThemeContext = createContext(null);

/**
 * أوضاع الواجهة الثلاثة + الاتّباع التلقائي للنظام.
 *  - calm  : وضع السكينة، الأساسي — عاجي دافئ وأخضر هادئ.
 *  - focus : نفس الهوية بحيوية أعلى، للمتابعة والإنجاز.
 *  - night : تصميم ليلي مستقل لا قلب ألوان.
 */
export const THEME_MODES = ['calm', 'focus', 'night', 'system'];

/** الوضع يحدد لوحة فاتحة أو داكنة، فتبقى بقية الأنماط على data-theme. */
const MODE_THEME = { calm: 'light', focus: 'light', night: 'dark' };

/** أسماء قديمة محفوظة في المتصفحات: تُترجم إلى الأوضاع الجديدة. */
const LEGACY = { light: 'calm', dark: 'night' };

function systemPrefersDark() {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveTheme(mode, systemDark) {
  if (mode === 'system') return systemDark ? 'dark' : 'light';
  return MODE_THEME[mode] ?? 'light';
}

/** الوضع الفعلي المعروض بعد حلّ «اتّباع النظام». */
function resolveMode(mode, systemDark) {
  if (mode === 'system') return systemDark ? 'night' : 'calm';
  return mode;
}

function sanitizeMode(value) {
  const migrated = LEGACY[value] ?? value;
  return THEME_MODES.includes(migrated) ? migrated : 'system';
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    return sanitizeMode(readStorage(STORAGE_KEYS.theme, 'system'));
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
  const resolvedMode = resolveMode(mode, systemDark);

  useEffect(() => {
    const root = document.documentElement;
    // data-theme يبقى فاتح/داكن فتعمل عليه كل الأنماط، وdata-mode يحمل الوضع.
    root.setAttribute('data-theme', resolved);
    root.setAttribute('data-mode', resolvedMode);
    root.setAttribute('data-theme-mode', mode);
  }, [resolved, resolvedMode, mode]);

  const setMode = useCallback((next) => {
    const value = sanitizeMode(next);
    setModeState(value);
    writeStorage(STORAGE_KEYS.theme, value);
  }, []);

  /** تبديل سريع بين السكينة والليل — أكثر ما يُطلب من الشريط العلوي. */
  const toggle = useCallback(() => {
    setMode(resolvedMode === 'night' ? 'calm' : 'night');
  }, [resolvedMode, setMode]);

  const value = useMemo(
    () => ({
      mode,
      resolved,
      resolvedMode,
      isDark: resolved === 'dark',
      isFocus: resolvedMode === 'focus',
      setMode,
      toggle,
      modes: THEME_MODES,
    }),
    [mode, resolved, resolvedMode, setMode, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme يجب استخدامه داخل ThemeProvider');
  return ctx;
}
