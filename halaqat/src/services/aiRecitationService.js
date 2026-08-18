/**
 * Mock AI للتسميع.
 *
 * تنبيه مهم: لا يوجد ذكاء اصطناعي حقيقي ولا تسجيل صوت فعلي.
 * الهدف محاكاة رحلة: تسجيل → إيقاف → تحليل → نتيجة، مع نتيجة حتمية
 * مبنية على المقطع المختار حتى تبقى قابلة للاختبار.
 */

import { delay, ApiError } from '../mock/api.js';
import { getSurah, getSurahAyat } from '../mock/quran.js';

const MISTAKE_TYPES = ['tajweed', 'pronunciation', 'hesitation', 'missing'];

let state = {
  status: 'idle', // idle | recording | paused | analyzing | done
  startedAt: null,
  elapsedSeconds: 0,
  range: null,
  levels: [],
  result: null,
};

const listeners = new Set();
let ticker = null;

function emit() {
  const snapshot = getState();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      /* تجاهل خطأ مستمع واحد */
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

export function getState() {
  return { ...state, levels: [...state.levels] };
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

function startTicker() {
  stopTicker();
  ticker = setInterval(() => {
    state.elapsedSeconds += 1;
    // مستوى صوت وهمي لرسم الموجة.
    const level = 0.25 + Math.abs(Math.sin(state.elapsedSeconds * 1.7)) * 0.7;
    state.levels = [...state.levels.slice(-59), Number(level.toFixed(3))];
    emit();
  }, 1000);
}

/** بدء التسجيل (محاكاة). */
export function startRecording({ surahNumber, fromAyah, toAyah } = {}) {
  const surah = getSurah(surahNumber);
  if (!surah) throw new ApiError('invalidRange', 'state.errorHint');

  state = {
    status: 'recording',
    startedAt: Date.now(),
    elapsedSeconds: 0,
    range: { surahNumber: surah.number, surahName: surah.name, fromAyah, toAyah },
    levels: [],
    result: null,
  };
  startTicker();
  emit();
  return getState();
}

export function pauseRecording() {
  if (state.status !== 'recording') return getState();
  state.status = 'paused';
  stopTicker();
  emit();
  return getState();
}

export function resumeRecording() {
  if (state.status !== 'paused') return getState();
  state.status = 'recording';
  startTicker();
  emit();
  return getState();
}

/** إنهاء التسجيل — يعيد بيانات التسجيل الخام (الوهمية). */
export function stopRecording() {
  if (state.status !== 'recording' && state.status !== 'paused') return getState();
  stopTicker();
  state.status = 'analyzing';
  emit();
  return getState();
}

export function reset() {
  stopTicker();
  state = {
    status: 'idle',
    startedAt: null,
    elapsedSeconds: 0,
    range: null,
    levels: [],
    result: null,
  };
  emit();
  return getState();
}

/** بذرة حتمية من المقطع حتى تتكرر النتيجة لنفس المدخلات. */
function seedFromRange(range, durationSeconds) {
  return (
    (range.surahNumber * 131 + range.fromAyah * 17 + range.toAyah * 7 + durationSeconds) % 997
  );
}

/**
 * تحليل التلاوة (Mock).
 * @returns {Promise<object>} نتيجة تحتوي نسبة الإتقان والملاحظات.
 */
export async function analyzeRecitation({ range, durationSeconds } = {}) {
  const activeRange = range ?? state.range;
  if (!activeRange) throw new ApiError('noRecording', 'state.errorHint');

  state.status = 'analyzing';
  emit();

  await delay(1400);

  const duration = durationSeconds ?? state.elapsedSeconds;
  const seed = seedFromRange(activeRange, duration);
  const totalAyat = Math.max(1, activeRange.toAyah - activeRange.fromAyah + 1);
  const mistakeCount = Math.min(totalAyat, seed % 4);
  const mastery = Math.max(58, Math.min(99, 99 - mistakeCount * 7 - (seed % 5)));
  const ayat = getSurahAyat(activeRange.surahNumber);

  const mistakes = Array.from({ length: mistakeCount }, (_, index) => {
    const ayahNumber = Math.min(
      activeRange.toAyah,
      activeRange.fromAyah + ((seed + index * 3) % totalAyat),
    );
    const ayah = ayat.find((item) => item.number === ayahNumber);
    return {
      id: `mistake-${index}`,
      ayahNumber,
      type: MISTAKE_TYPES[(seed + index) % MISTAKE_TYPES.length],
      excerpt: ayah?.unavailable ? null : (ayah?.text ?? '').split(' ').slice(0, 4).join(' '),
    };
  });

  const result = {
    id: `recitation-${Date.now()}`,
    range: activeRange,
    durationSeconds: duration,
    mastery,
    totalAyat,
    correctAyat: totalAyat - mistakeCount,
    needsReview: mistakeCount,
    mistakes,
    grade: mastery >= 90 ? 'excellent' : mastery >= 75 ? 'good' : 'needsWork',
    isMock: true,
    analyzedAt: new Date().toISOString(),
  };

  state.status = 'done';
  state.result = result;
  emit();
  return result;
}

/** آخر نتيجة محفوظة في الذاكرة. */
export function getRecitationResult() {
  return state.result ? { ...state.result } : null;
}
