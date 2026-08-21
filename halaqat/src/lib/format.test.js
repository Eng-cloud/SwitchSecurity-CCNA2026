import { describe, expect, it } from 'vitest';
import {
  clamp,
  formatDuration,
  formatFraction,
  formatNumber,
  formatPercent,
  initials,
  maskIdentifier,
} from './format.js';

describe('تنسيق الأرقام', () => {
  it('يتعامل مع القيم غير الصالحة بأمان', () => {
    expect(formatNumber(undefined)).toBe('—');
    expect(formatNumber('نص')).toBe('—');
    expect(formatPercent(null)).toBe('—');
  });

  it('يحصر النسبة بين 0 و100', () => {
    expect(formatPercent(140)).toBe('100%');
    expect(formatPercent(-20)).toBe('0%');
    expect(formatPercent(92)).toBe('92%');
  });

  it('يعرض الكسر بصيغة done / total', () => {
    expect(formatFraction(2, 3)).toBe('2 / 3');
  });
});

describe('تنسيق المدة', () => {
  it('يعرض mm:ss', () => {
    expect(formatDuration(0)).toBe('00:00');
    expect(formatDuration(65)).toBe('01:05');
    expect(formatDuration(600)).toBe('10:00');
  });

  it('يتعامل مع القيم السالبة أو غير الرقمية', () => {
    expect(formatDuration(-5)).toBe('00:00');
    expect(formatDuration('نص')).toBe('00:00');
  });
});

describe('إخفاء وسيلة الدخول', () => {
  it('يخفي جزءًا من البريد', () => {
    const masked = maskIdentifier('student@demo.local');
    expect(masked.startsWith('s')).toBe(true);
    expect(masked.endsWith('@demo.local')).toBe(true);
    expect(masked).toContain('*');
  });

  it('يخفي وسط رقم الجوال', () => {
    const masked = maskIdentifier('0512345678');
    expect(masked.startsWith('05')).toBe(true);
    expect(masked.endsWith('78')).toBe(true);
    expect(masked).toContain('*');
  });

  it('يتعامل مع القيم الفارغة', () => {
    expect(maskIdentifier('')).toBe('');
    expect(maskIdentifier(null)).toBe('');
  });
});

describe('الأحرف الأولى والحصر', () => {
  it('يستخرج أول حرفين من الاسم', () => {
    expect(initials('عبدالله العتيبي')).toBe('عا');
    expect(initials('سارة')).toBe('س');
    expect(initials('')).toBe('؟');
  });

  it('clamp يحصر القيمة', () => {
    expect(clamp(150, 0, 100)).toBe(100);
    expect(clamp(-4, 0, 100)).toBe(0);
    expect(clamp('نص', 0, 100)).toBe(0);
  });
});
