/**
 * خدمة المصادقة (Mock).
 * لا يوجد أي تحقق أمني حقيقي هنا — الهدف محاكاة رحلة الدخول كاملة.
 */

import { request, ApiError } from '../mock/api.js';
import {
  DEMO_ACCOUNTS,
  DEMO_OTP,
  findUserByEmail,
  findUserByPhone,
  getDb,
  mutateDb,
} from '../mock/db.js';
import { identifierType, normalizeIdentifier } from '../lib/validators.js';
import { readStorage, writeStorage, removeStorage, STORAGE_KEYS } from '../lib/storage.js';
import { maskIdentifier } from '../lib/format.js';

const CHALLENGE_KEY = 'otpChallenge';
const OTP_TTL_SECONDS = 120;
const RESEND_COOLDOWN_SECONDS = 30;
const MAX_ATTEMPTS = 5;

export const ROLES = ['student', 'teacher', 'supervisor', 'admin', 'parent'];

export const DEMO_LOGIN_ACCOUNTS = DEMO_ACCOUNTS;
export const DEMO_CODE = DEMO_OTP;

function buildSession(user) {
  if (!user) throw new ApiError('unknownUser', 'auth.errors.unknownUser');
  const db = getDb();
  const student =
    user.role === 'student'
      ? (db.students.find((s) => s.id === user.studentId || s.email === user.email) ?? null)
      : null;

  // المعلم لا يحمل circleId في سجله — الحلقة هي التي تشير إليه، فنحلّها هنا
  // حتى تجد صفحات الحلقة والجلسات حلقته مباشرة.
  const teacherCircle =
    user.role === 'teacher' ? (db.circles.find((c) => c.teacherId === user.id) ?? null) : null;

  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    city: user.city,
    role: user.role,
    title: user.title ?? null,
    studentId: student?.id ?? null,
    circleId: user.circleId ?? student?.circleId ?? teacherCircle?.id ?? null,
    childrenIds: user.childrenIds ?? [],
    isDemo: true,
    startedAt: new Date().toISOString(),
    device: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 60) : 'unknown',
  };
}

function findUserByIdentifier(identifier) {
  const normalized = normalizeIdentifier(identifier);
  const type = identifierType(normalized);
  if (type === 'email') return findUserByEmail(normalized);
  if (type === 'phone') return findUserByPhone(normalized);
  return null;
}

/* ---------------------------------------------------------------
   الجلسة
   --------------------------------------------------------------- */
export function getStoredSession() {
  const session = readStorage(STORAGE_KEYS.session);
  if (!session || !session.userId || !ROLES.includes(session.role)) return null;
  return session;
}

export function persistSession(session) {
  writeStorage(STORAGE_KEYS.session, session);
  return session;
}

export function clearSession() {
  removeStorage(STORAGE_KEYS.session);
  removeStorage(CHALLENGE_KEY);
}

/* ---------------------------------------------------------------
   OTP
   --------------------------------------------------------------- */
function createChallenge(identifier, { user, pendingRegistration = null } = {}) {
  const now = Date.now();
  const challenge = {
    id: `otp-${now}`,
    identifier: normalizeIdentifier(identifier),
    masked: maskIdentifier(normalizeIdentifier(identifier)),
    userId: user?.id ?? null,
    pendingRegistration,
    code: DEMO_OTP,
    expiresAt: now + OTP_TTL_SECONDS * 1000,
    resendAvailableAt: now + RESEND_COOLDOWN_SECONDS * 1000,
    attempts: 0,
  };
  writeStorage(CHALLENGE_KEY, challenge);
  return challenge;
}

export function getChallenge() {
  return readStorage(CHALLENGE_KEY);
}

function publicChallenge(challenge) {
  return {
    id: challenge.id,
    masked: challenge.masked,
    identifier: challenge.identifier,
    expiresAt: challenge.expiresAt,
    resendAvailableAt: challenge.resendAvailableAt,
    demoCode: DEMO_OTP,
    isRegistration: Boolean(challenge.pendingRegistration),
  };
}

/** الخطوة الأولى: التحقق من وجود وسيلة الدخول وإرسال رمز تجريبي. */
export async function requestOtp(identifier) {
  return request(() => {
    const user = findUserByIdentifier(identifier);
    if (!user) throw new ApiError('unknownUser', 'auth.errors.unknownUser');
    return publicChallenge(createChallenge(identifier, { user }));
  });
}

export async function resendOtp() {
  return request(() => {
    const existing = getChallenge();
    if (!existing) throw new ApiError('noChallenge', 'auth.errors.generic');
    const refreshed = createChallenge(existing.identifier, {
      user: existing.userId ? { id: existing.userId } : null,
      pendingRegistration: existing.pendingRegistration,
    });
    return publicChallenge(refreshed);
  });
}

export async function verifyOtp(code) {
  return request(() => {
    const challenge = getChallenge();
    if (!challenge) throw new ApiError('noChallenge', 'auth.errors.generic');

    if (Date.now() > challenge.expiresAt) {
      throw new ApiError('expired', 'auth.errors.otpExpired');
    }
    if (challenge.attempts >= MAX_ATTEMPTS) {
      throw new ApiError('locked', 'auth.errors.otpLocked');
    }

    const entered = String(code ?? '').replace(/\D/g, '');
    if (entered !== challenge.code) {
      challenge.attempts += 1;
      writeStorage(CHALLENGE_KEY, challenge);
      throw new ApiError('invalidOtp', 'auth.errors.otpInvalid');
    }

    let user;
    if (challenge.pendingRegistration) {
      user = mutateDb((db) => {
        const created = {
          id: `user-registered-${Date.now()}`,
          ...challenge.pendingRegistration,
          status: 'active',
          joinedAt: new Date().toISOString(),
        };
        db.users.push(created);
        return created;
      });
    } else {
      user = getDb().users.find((u) => u.id === challenge.userId) ?? null;
    }

    removeStorage(CHALLENGE_KEY);
    return persistSession(buildSession(user));
  });
}

/* ---------------------------------------------------------------
   التسجيل
   --------------------------------------------------------------- */
export async function register({ name, identifier, city, role }) {
  return request(() => {
    const normalized = normalizeIdentifier(identifier);
    const type = identifierType(normalized);
    if (!type) throw new ApiError('invalidIdentifier', 'auth.errors.identifierInvalid');
    if (!ROLES.includes(role)) throw new ApiError('invalidRole', 'auth.errors.roleEmpty');

    const pendingRegistration = {
      name: String(name).trim(),
      role,
      city: city || '',
      email: type === 'email' ? normalized : `${normalized}@demo.local`,
      phone: type === 'phone' ? normalized : '',
    };

    return publicChallenge(createChallenge(normalized, { pendingRegistration }));
  });
}

/* ---------------------------------------------------------------
   وضع التجربة
   --------------------------------------------------------------- */
export async function loginDemo(role) {
  return request(() => {
    const account = DEMO_ACCOUNTS.find((item) => item.role === role);
    if (!account) throw new ApiError('unknownRole', 'auth.errors.generic');
    const user = findUserByEmail(account.email);
    return persistSession(buildSession(user));
  });
}

/** تبديل الدور داخل وضع التجربة (واجهة فقط، ليس تفويضًا حقيقيًا). */
export async function switchRole(role) {
  return loginDemo(role);
}

export async function logout() {
  return request(
    () => {
      clearSession();
      return true;
    },
    { allowOffline: true, latency: 120 },
  );
}

export async function updateProfile(userId, changes) {
  return request(() =>
    mutateDb((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError('notFound', 'state.errorHint');
      Object.assign(user, changes);
      const student = db.students.find((s) => s.userId === userId || s.email === user.email);
      if (student && changes.name) student.name = changes.name;
      const session = getStoredSession();
      if (session && session.userId === userId) {
        persistSession({ ...session, ...changes });
      }
      return { ...user };
    }),
  );
}
