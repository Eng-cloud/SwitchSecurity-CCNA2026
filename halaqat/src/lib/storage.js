/**
 * غلاف آمن حول localStorage.
 * لا يرمي استثناءً أبدًا (وضع التصفح الخاص / تعطيل التخزين / JSON تالف).
 */

const PREFIX = 'halaqat.';

function available() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = `${PREFIX}__probe__`;
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const memoryFallback = new Map();
const canUseStorage = available();

export function readStorage(key, fallback = null) {
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  try {
    const raw = canUseStorage ? window.localStorage.getItem(fullKey) : memoryFallback.get(fullKey);
    if (raw == null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeStorage(key, value) {
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  try {
    const raw = JSON.stringify(value);
    if (canUseStorage) window.localStorage.setItem(fullKey, raw);
    else memoryFallback.set(fullKey, raw);
    return true;
  } catch {
    return false;
  }
}

export function removeStorage(key) {
  const fullKey = key.startsWith(PREFIX) ? key : PREFIX + key;
  try {
    if (canUseStorage) window.localStorage.removeItem(fullKey);
    else memoryFallback.delete(fullKey);
    return true;
  } catch {
    return false;
  }
}

/** يمسح كل مفاتيح المنصة فقط (لا يلمس مفاتيح تطبيقات أخرى). */
export function clearAppStorage(except = []) {
  const keep = new Set(except.map((k) => (k.startsWith(PREFIX) ? k : PREFIX + k)));
  try {
    if (canUseStorage) {
      const keys = Object.keys(window.localStorage).filter(
        (k) => k.startsWith(PREFIX) && !keep.has(k),
      );
      keys.forEach((k) => window.localStorage.removeItem(k));
    } else {
      [...memoryFallback.keys()].forEach((k) => {
        if (!keep.has(k)) memoryFallback.delete(k);
      });
    }
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  theme: 'theme',
  a11y: 'a11y',
  session: 'session',
  db: 'db',
  notificationPrefs: 'notificationPrefs',
  quranPrefs: 'quranPrefs',
  offlinePages: 'offlinePages',
};
