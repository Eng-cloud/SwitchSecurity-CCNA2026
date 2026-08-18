/**
 * التنسيق العربي: أرقام، نسب، تواريخ، مدد زمنية.
 * كل الدوال تتحمل القيم غير الصالحة وتعيد نصًا آمنًا.
 */

const LOCALE = 'ar-SA';
// نستخدم الأرقام اللاتينية (الهندية الشرقية اختيارية) لسهولة القراءة في الجداول والإحصاءات.
const NUMBER_LOCALE = 'ar-SA-u-nu-latn';

export function formatNumber(value, options = {}) {
  // null/undefined/'' ليست صفرًا — نعرض شرطة بدل رقم مضلل.
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat(NUMBER_LOCALE, options).format(n);
  } catch {
    return String(n);
  }
}

export function formatPercent(value, { decimals = 0 } = {}) {
  if (value == null || value === '') return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  const clamped = Math.max(0, Math.min(100, n));
  return `${formatNumber(clamped, { maximumFractionDigits: decimals })}%`;
}

/** كسر مثل 2 / 3 */
export function formatFraction(done, total) {
  return `${formatNumber(done)} / ${formatNumber(total)}`;
}

function toDate(input) {
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;
  if (typeof input === 'number') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    const d = new Date(input);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

export function formatDate(input, options) {
  const d = toDate(input);
  if (!d) return '—';
  try {
    return new Intl.DateTimeFormat(
      NUMBER_LOCALE,
      options ?? { year: 'numeric', month: 'long', day: 'numeric' },
    ).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

export function formatShortDate(input) {
  return formatDate(input, { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function formatDateTime(input) {
  return formatDate(input, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatTime(input) {
  return formatDate(input, { hour: '2-digit', minute: '2-digit' });
}

export function formatWeekday(input) {
  return formatDate(input, { weekday: 'long' });
}

/** mm:ss لعدادات التسجيل والاختبار */
export function formatDuration(totalSeconds) {
  const s = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(s / 60);
  const seconds = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(minutes)}:${pad(seconds)}`;
}

/** وصف نسبي بسيط: الآن / قبل N دقيقة / أمس / تاريخ */
export function formatRelative(input, t) {
  const d = toDate(input);
  if (!d) return '—';
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return t('time.justNow');
  if (diffMin < 60) return t('time.minutesAgo', { count: formatNumber(diffMin) });
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return t('time.hoursAgo', { count: formatNumber(diffHours) });
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return t('time.yesterday');
  if (diffDays < 30) return t('time.daysAgo', { count: formatNumber(diffDays) });
  return formatShortDate(d);
}

/** إخفاء جزئي للبريد أو الجوال في شاشة OTP */
export function maskIdentifier(identifier) {
  if (!identifier || typeof identifier !== 'string') return '';
  const value = identifier.trim();
  if (value.includes('@')) {
    const [name, domain] = value.split('@');
    const visible = name.slice(0, 1);
    return `${visible}${'*'.repeat(Math.max(3, name.length - 1))}@${domain}`;
  }
  const digits = value.replace(/\D/g, '');
  if (digits.length < 4) return value;
  return `${digits.slice(0, 2)}${'*'.repeat(Math.max(3, digits.length - 4))}${digits.slice(-2)}`;
}

/** أول حرفين للاسم في الصورة الرمزية */
export function initials(name) {
  if (!name || typeof name !== 'string') return '؟';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '؟';
  if (parts.length === 1) return parts[0].slice(0, 1);
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`;
}

export function toISODate(input) {
  const d = toDate(input) ?? new Date();
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 10);
}

export function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}
