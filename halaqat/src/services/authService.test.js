import { beforeEach, describe, expect, it } from 'vitest';
import * as authService from './authService.js';
import { clearAppStorage } from '../lib/storage.js';

describe('خدمة المصادقة (Mock)', () => {
  beforeEach(() => {
    clearAppStorage();
    authService.clearSession();
  });

  it('يرفض وسيلة دخول غير مسجلة', async () => {
    await expect(authService.requestOtp('unknown@nowhere.local')).rejects.toMatchObject({
      messageKey: 'auth.errors.unknownUser',
    });
  });

  it('ينشئ تحديًا مع رمز تجريبي وبيانات مخفية', async () => {
    const challenge = await authService.requestOtp('student@halaqat.sa');
    expect(challenge.demoCode).toBe('123456');
    expect(challenge.masked).toContain('*');
    expect(challenge.expiresAt).toBeGreaterThan(Date.now());
  });

  it('يرفض الرمز الخاطئ ثم يقبل الصحيح', async () => {
    await authService.requestOtp('student@halaqat.sa');

    await expect(authService.verifyOtp('000000')).rejects.toMatchObject({
      messageKey: 'auth.errors.otpInvalid',
    });

    const session = await authService.verifyOtp('123456');
    expect(session.role).toBe('student');
    expect(session.studentId).toBeTruthy();
    expect(authService.getStoredSession()).not.toBe(null);
  });

  it('يقفل بعد تجاوز عدد المحاولات', async () => {
    await authService.requestOtp('student@halaqat.sa');
    for (let i = 0; i < 5; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await expect(authService.verifyOtp('111111')).rejects.toBeTruthy();
    }
    await expect(authService.verifyOtp('123456')).rejects.toMatchObject({
      messageKey: 'auth.errors.otpLocked',
    });
  });

  it('الدخول التجريبي يعمل لكل الأدوار', async () => {
    for (const role of ['student', 'teacher', 'supervisor', 'admin', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      const session = await authService.loginDemo(role);
      expect(session.role).toBe(role);
      expect(session.isDemo).toBe(true);
    }
  });

  it('جلسة المعلم تحمل معرّف حلقته (اختبار انحدار)', async () => {
    const session = await authService.loginDemo('teacher');
    expect(session.circleId).toMatch(/^circle-/);
  });

  it('جلسة الطالب تحمل معرّف الطالب وحلقته', async () => {
    const session = await authService.loginDemo('student');
    expect(session.studentId).toMatch(/^student-/);
    expect(session.circleId).toMatch(/^circle-/);
  });

  it('جلسة ولي الأمر تحمل معرّفات الأبناء', async () => {
    const session = await authService.loginDemo('parent');
    expect(session.childrenIds.length).toBeGreaterThan(0);
  });

  it('تبديل الدور يغيّر الجلسة المحفوظة', async () => {
    await authService.loginDemo('student');
    const next = await authService.switchRole('teacher');
    expect(next.role).toBe('teacher');
    expect(authService.getStoredSession().role).toBe('teacher');
  });

  it('تسجيل الخروج يمسح الجلسة تمامًا', async () => {
    await authService.loginDemo('admin');
    expect(authService.getStoredSession()).not.toBe(null);
    await authService.logout();
    expect(authService.getStoredSession()).toBe(null);
  });

  it('التسجيل ينشئ تحديًا ثم مستخدمًا جديدًا', async () => {
    await authService.register({
      name: 'مستخدم تجريبي',
      identifier: 'new.user@halaqat.sa',
      city: 'الرياض',
      role: 'teacher',
    });
    const session = await authService.verifyOtp('123456');
    expect(session.name).toBe('مستخدم تجريبي');
    expect(session.role).toBe('teacher');
  });
});
