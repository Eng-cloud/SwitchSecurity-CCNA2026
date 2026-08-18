import { describe, expect, it } from 'vitest';
import {
  identifierType,
  isEmail,
  isPhone,
  normalizeIdentifier,
  validateDateRange,
  validateIdentifier,
  validateName,
  validateNote,
  validateOtp,
} from './validators.js';

describe('التحقق من وسيلة الدخول', () => {
  it('يقبل البريد الإلكتروني الصحيح', () => {
    expect(isEmail('student@demo.local')).toBe(true);
    expect(isEmail('a.b+c@example.co')).toBe(true);
  });

  it('يرفض البريد غير الصحيح', () => {
    expect(isEmail('student@')).toBe(false);
    expect(isEmail('student.demo.local')).toBe(false);
    expect(isEmail('')).toBe(false);
  });

  it('يقبل صيغ الجوال السعودي المختلفة', () => {
    expect(isPhone('0512345678')).toBe(true);
    expect(isPhone('+966512345678')).toBe(true);
    expect(isPhone('966512345678')).toBe(true);
    expect(isPhone('05 1234 5678'.replace(/\s/g, ''))).toBe(true);
  });

  it('يرفض الأرقام غير الصالحة', () => {
    expect(isPhone('0412345678')).toBe(false);
    expect(isPhone('05123')).toBe(false);
  });

  it('يحدد نوع الوسيلة', () => {
    expect(identifierType('a@b.com')).toBe('email');
    expect(identifierType('0512345678')).toBe('phone');
    expect(identifierType('نص')).toBe(null);
  });

  it('يوحّد صيغة الجوال', () => {
    expect(normalizeIdentifier('+966512345678')).toBe('0512345678');
    expect(normalizeIdentifier('  STUDENT@Demo.Local ')).toBe('student@demo.local');
  });

  it('يعيد مفاتيح الأخطاء الصحيحة', () => {
    expect(validateIdentifier('')).toBe('auth.errors.identifierEmpty');
    expect(validateIdentifier('abc')).toBe('auth.errors.identifierInvalid');
    expect(validateIdentifier('student@demo.local')).toBe(null);
  });
});

describe('تحقق الحقول الأخرى', () => {
  it('الاسم', () => {
    expect(validateName('')).toBe('auth.errors.nameEmpty');
    expect(validateName('عب')).toBe('auth.errors.nameShort');
    expect(validateName('عبدالله العتيبي')).toBe(null);
  });

  it('رمز التحقق', () => {
    expect(validateOtp('')).toBe('auth.errors.otpEmpty');
    expect(validateOtp('123')).toBe('auth.errors.otpIncomplete');
    expect(validateOtp('123456')).toBe(null);
  });

  it('الملاحظة', () => {
    expect(validateNote('   ')).toBe('teacher.note.empty');
    expect(validateNote('جيد')).toBe('teacher.note.short');
    expect(validateNote('أداء ممتاز اليوم')).toBe(null);
  });

  it('المدى الزمني', () => {
    expect(validateDateRange('2026-01-10', '2026-01-01')).toBe('reports.invalidRange');
    expect(validateDateRange('2026-01-01', '2026-01-10')).toBe(null);
    expect(validateDateRange(null, null)).toBe(null);
  });
});
