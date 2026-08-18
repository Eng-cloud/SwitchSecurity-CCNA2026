/**
 * طبقة Mock API — تحاكي شبكة حقيقية:
 * تأخير، أخطاء، وحالة اتصال قابلة للتبديل لتجربة حالة Offline.
 *
 * كل الخدمات تمر من هنا، فاستبدالها بـ fetch حقيقي لاحقًا يتم في مكان واحد.
 */

export class ApiError extends Error {
  constructor(code, messageKey = 'state.errorHint', details = null) {
    super(code);
    this.name = 'ApiError';
    this.code = code;
    this.messageKey = messageKey;
    this.details = details;
  }
}

/* ---------- حالة الاتصال (محاكاة) ---------- */
let offline = false;
const offlineListeners = new Set();

export function isOffline() {
  return offline;
}

export function setOffline(value) {
  const next = Boolean(value);
  if (next === offline) return offline;
  offline = next;
  offlineListeners.forEach((listener) => {
    try {
      listener(offline);
    } catch {
      /* لا نسمح لمستمع واحد بإسقاط البقية */
    }
  });
  return offline;
}

export function subscribeOffline(listener) {
  offlineListeners.add(listener);
  return () => offlineListeners.delete(listener);
}

/* ---------- التأخير ---------- */
// في بيئة الاختبار نُلغي التأخير حتى تبقى الاختبارات سريعة وحتمية.
const IS_TEST =
  (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') ||
  (typeof navigator !== 'undefined' && navigator.webdriver === true);

export const LATENCY = IS_TEST ? { min: 0, max: 0 } : { min: 160, max: 420 };

export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomLatency() {
  if (LATENCY.max === 0) return 0;
  return Math.round(LATENCY.min + Math.random() * (LATENCY.max - LATENCY.min));
}

/**
 * ينفّذ عملية وهمية مع محاكاة الشبكة.
 * @param {Function} handler الدالة التي تُنتج البيانات
 * @param {object} options { latency, allowOffline, failWith }
 */
export async function request(handler, options = {}) {
  const { latency, allowOffline = false, failWith = null } = options;
  await delay(latency ?? randomLatency());

  if (offline && !allowOffline) {
    throw new ApiError('offline', 'state.offlineHint');
  }
  if (failWith) {
    throw new ApiError(failWith.code ?? 'error', failWith.messageKey ?? 'state.errorHint');
  }

  try {
    return await handler();
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError('unexpected', 'state.errorHint', error?.message ?? null);
  }
}

/** ترقيم صفحات موحّد لكل القوائم. */
export function paginate(items, { page = 1, perPage = 10 } = {}) {
  const safePerPage = Math.max(1, Number(perPage) || 10);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePerPage));
  const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (safePage - 1) * safePerPage;
  return {
    items: items.slice(start, start + safePerPage),
    page: safePage,
    perPage: safePerPage,
    total,
    totalPages,
    from: total === 0 ? 0 : start + 1,
    to: Math.min(start + safePerPage, total),
  };
}

/** بحث نصي عربي متسامح مع الهمزات والتاء المربوطة. */
export function normalizeArabic(value) {
  return String(value ?? '')
    .replace(/[ً-ْٰ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesQuery(value, query) {
  const q = normalizeArabic(query);
  if (!q) return true;
  return normalizeArabic(value).includes(q);
}
