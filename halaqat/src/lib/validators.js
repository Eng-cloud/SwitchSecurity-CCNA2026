/**
 * قواعد تحقق مشتركة — تعيد مفتاح رسالة أو null.
 * الرسائل نفسها في قاموس i18n وليست هنا.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;
// جوال سعودي: 05xxxxxxxx أو +9665xxxxxxxx أو 9665xxxxxxxx
const PHONE_RE = /^(?:\+?966|0)?5\d{8}$/;

export function isEmail(value) {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

export function isPhone(value) {
  if (typeof value !== 'string') return false;
  const cleaned = value.replace(/[\s()-]/g, '');
  return PHONE_RE.test(cleaned);
}

export function identifierType(value) {
  if (isEmail(value)) return 'email';
  if (isPhone(value)) return 'phone';
  return null;
}

export function validateIdentifier(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'auth.errors.identifierEmpty';
  if (!identifierType(trimmed)) return 'auth.errors.identifierInvalid';
  return null;
}

export function validateName(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'auth.errors.nameEmpty';
  if (trimmed.length < 3) return 'auth.errors.nameShort';
  return null;
}

export function validateOtp(value) {
  const digits = (value ?? '').replace(/\D/g, '');
  if (!digits) return 'auth.errors.otpEmpty';
  if (digits.length < 6) return 'auth.errors.otpIncomplete';
  return null;
}

export function validateNote(value) {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return 'teacher.note.empty';
  if (trimmed.length < 4) return 'teacher.note.short';
  return null;
}

export function validateDateRange(start, end) {
  if (!start || !end) return null;
  if (new Date(start).getTime() > new Date(end).getTime()) return 'reports.invalidRange';
  return null;
}

/** ينظف رقم الجوال إلى صيغة موحّدة 05xxxxxxxx */
export function normalizeIdentifier(value) {
  const trimmed = (value ?? '').trim();
  if (isEmail(trimmed)) return trimmed.toLowerCase();
  if (isPhone(trimmed)) {
    const digits = trimmed.replace(/\D/g, '');
    const tail = digits.slice(-9);
    return `0${tail}`;
  }
  return trimmed;
}
