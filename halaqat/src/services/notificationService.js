/** خدمة الإشعارات — قائمة، تعليم كمقروء، وتفضيلات. */

import { request } from '../mock/api.js';
import { getDb, mutateDb } from '../mock/db.js';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage.js';

/**
 * إشعارات الدور.
 * بعض الإشعارات تخصّ أكثر من دور ووجهتها تختلف بينهم (طلبات التسجيل مثلًا
 * تُراجَع من مسار المشرف ومن مسار الإدارة)، فيُحلّ الرابط بحسب الدور القارئ.
 */
export async function list(role) {
  return request(
    () =>
      getDb()
        .notifications.filter((item) => !item.roles || item.roles.includes(role))
        .map(({ linkByRole, ...item }) => ({
          ...item,
          link: linkByRole?.[role] ?? item.link ?? null,
        }))
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    { allowOffline: true },
  );
}

export async function markRead(id) {
  return request(() =>
    mutateDb((db) => {
      const item = db.notifications.find((notification) => notification.id === id);
      if (item) item.read = true;
      return item ? { ...item } : null;
    }),
  );
}

export async function markAllRead(role) {
  return request(() =>
    mutateDb((db) => {
      db.notifications.forEach((item) => {
        if (!item.roles || item.roles.includes(role)) item.read = true;
      });
      return true;
    }),
  );
}

const DEFAULT_PREFS = {
  sessions: true,
  tests: true,
  reports: true,
  goals: false,
  sound: false,
};

export function getPreferences() {
  return { ...DEFAULT_PREFS, ...(readStorage(STORAGE_KEYS.notificationPrefs, {}) ?? {}) };
}

export function savePreferences(changes) {
  const next = { ...getPreferences(), ...changes };
  writeStorage(STORAGE_KEYS.notificationPrefs, next);
  return next;
}
