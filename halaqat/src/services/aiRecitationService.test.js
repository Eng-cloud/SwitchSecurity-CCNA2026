import { afterEach, describe, expect, it, vi } from 'vitest';
import * as ai from './aiRecitationService.js';

describe('Mock AI للتسميع', () => {
  afterEach(() => {
    ai.reset();
    vi.useRealTimers();
  });

  it('يبدأ التسجيل ويحدّث الحالة', () => {
    const state = ai.startRecording({ surahNumber: 112, fromAyah: 1, toAyah: 4 });
    expect(state.status).toBe('recording');
    expect(state.range.surahName).toBe('الإخلاص');
    expect(state.elapsedSeconds).toBe(0);
  });

  it('يدعم الإيقاف المؤقت والاستئناف', () => {
    ai.startRecording({ surahNumber: 112, fromAyah: 1, toAyah: 4 });
    expect(ai.pauseRecording().status).toBe('paused');
    expect(ai.resumeRecording().status).toBe('recording');
  });

  it('يعدّ الثواني أثناء التسجيل', () => {
    vi.useFakeTimers();
    ai.startRecording({ surahNumber: 112, fromAyah: 1, toAyah: 4 });
    vi.advanceTimersByTime(3000);
    expect(ai.getState().elapsedSeconds).toBe(3);
    expect(ai.getState().levels.length).toBe(3);
  });

  it('ينتج نتيجة حتمية لنفس المدخلات', async () => {
    const range = { surahNumber: 112, surahName: 'الإخلاص', fromAyah: 1, toAyah: 4 };
    const first = await ai.analyzeRecitation({ range, durationSeconds: 40 });
    ai.reset();
    const second = await ai.analyzeRecitation({ range, durationSeconds: 40 });

    expect(first.mastery).toBe(second.mastery);
    expect(first.needsReview).toBe(second.needsReview);
  });

  it('النتيجة معلّمة كـ Mock ومتّسقة الأرقام', async () => {
    const range = { surahNumber: 1, surahName: 'الفاتحة', fromAyah: 1, toAyah: 7 };
    const result = await ai.analyzeRecitation({ range, durationSeconds: 55 });

    expect(result.isMock).toBe(true);
    expect(result.mastery).toBeGreaterThanOrEqual(58);
    expect(result.mastery).toBeLessThanOrEqual(99);
    expect(result.correctAyat + result.needsReview).toBe(result.totalAyat);
    expect(result.mistakes.length).toBe(result.needsReview);
  });

  it('getRecitationResult يعيد آخر نتيجة', async () => {
    expect(ai.getRecitationResult()).toBe(null);
    const range = { surahNumber: 108, surahName: 'الكوثر', fromAyah: 1, toAyah: 3 };
    const result = await ai.analyzeRecitation({ range, durationSeconds: 20 });
    expect(ai.getRecitationResult().id).toBe(result.id);
  });

  it('يرفض التحليل بلا مقطع', async () => {
    await expect(ai.analyzeRecitation({})).rejects.toThrow();
  });
});
