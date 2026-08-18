import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage.js';
import useMediaQuery, { BREAKPOINTS } from '../hooks/useMediaQuery.js';

const A11yContext = createContext(null);

const DEFAULTS = {
  fontScale: 'normal', // normal | large | xlarge
  contrast: 'normal', // normal | high
  motion: 'system', // system | normal | reduced
};

const VALID = {
  fontScale: ['normal', 'large', 'xlarge'],
  contrast: ['normal', 'high'],
  motion: ['system', 'normal', 'reduced'],
};

function sanitize(stored) {
  const result = { ...DEFAULTS };
  if (stored && typeof stored === 'object') {
    for (const key of Object.keys(DEFAULTS)) {
      if (VALID[key].includes(stored[key])) result[key] = stored[key];
    }
  }
  return result;
}

export function A11yProvider({ children }) {
  const [settings, setSettings] = useState(() => sanitize(readStorage(STORAGE_KEYS.a11y)));
  const systemReducedMotion = useMediaQuery(BREAKPOINTS.reducedMotion);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-font-scale', settings.fontScale);
    root.setAttribute('data-contrast', settings.contrast);
    // 'system' يترك القرار لاستعلام الوسائط في CSS.
    if (settings.motion === 'system') root.removeAttribute('data-motion');
    else root.setAttribute('data-motion', settings.motion);
    writeStorage(STORAGE_KEYS.a11y, settings);
  }, [settings]);

  const setSetting = useCallback((key, value) => {
    if (!VALID[key]?.includes(value)) return;
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback(() => setSettings({ ...DEFAULTS }), []);

  const reducedMotion =
    settings.motion === 'reduced' || (settings.motion === 'system' && systemReducedMotion);

  const value = useMemo(
    () => ({ settings, setSetting, reset, reducedMotion, systemReducedMotion, defaults: DEFAULTS }),
    [settings, setSetting, reset, reducedMotion, systemReducedMotion],
  );

  return <A11yContext.Provider value={value}>{children}</A11yContext.Provider>;
}

export function useA11y() {
  const ctx = useContext(A11yContext);
  if (!ctx) throw new Error('useA11y يجب استخدامه داخل A11yProvider');
  return ctx;
}
