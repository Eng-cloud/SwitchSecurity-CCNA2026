/** خدمة المصحف — السور، الآيات، العلامات، آخر موضع، والتحميل دون اتصال (محاكاة). */

import { request, ApiError, delay } from '../mock/api.js';
import {
  SURAHS,
  getSurah,
  getSurahAyat,
  getJuzList,
  getMockTafsir,
  searchSurahs,
  RECITERS,
} from '../mock/quran.js';
import { getDb, mutateDb, getStudent } from '../mock/db.js';
import { readStorage, writeStorage, STORAGE_KEYS } from '../lib/storage.js';

export { RECITERS };

export async function listSurahs({ query = '' } = {}) {
  return request(() => searchSurahs(query), { allowOffline: true });
}

export async function listJuz() {
  return request(() => getJuzList(), { allowOffline: true });
}

export async function getSurahContent(surahNumber) {
  const number = Number(surahNumber);
  const offlinePages = readStorage(STORAGE_KEYS.offlinePages, []);
  const isCached = offlinePages.includes(number);

  return request(
    () => {
      const surah = getSurah(number);
      if (!surah) throw new ApiError('notFound', 'state.notFoundHint');
      return {
        surah,
        ayat: getSurahAyat(number),
        isCached,
        textAvailable: surah.hasText,
      };
    },
    // السور المحمّلة مسبقًا تعمل دون اتصال.
    { allowOffline: isCached },
  );
}

export async function getTafsir(surahNumber, ayahNumber) {
  return request(() => {
    const tafsir = getMockTafsir(surahNumber, ayahNumber);
    if (!tafsir) throw new ApiError('notFound', 'state.notFoundHint');
    return tafsir;
  });
}

/* ---------------- العلامات وآخر موضع ---------------- */
export async function getBookmarks(studentId) {
  return request(
    () => getDb().bookmarks.filter((bookmark) => bookmark.studentId === studentId),
    { allowOffline: true },
  );
}

export async function toggleBookmark(studentId, { surahNumber, ayahNumber }) {
  return request(() =>
    mutateDb((db) => {
      const index = db.bookmarks.findIndex(
        (bookmark) =>
          bookmark.studentId === studentId &&
          bookmark.surahNumber === surahNumber &&
          bookmark.ayahNumber === ayahNumber,
      );
      if (index >= 0) {
        db.bookmarks.splice(index, 1);
        return { added: false };
      }
      db.bookmarks.unshift({
        id: `bm-${Date.now()}`,
        studentId,
        surahNumber,
        ayahNumber,
        surahName: getSurah(surahNumber)?.name ?? '',
        createdAt: new Date().toISOString(),
      });
      return { added: true };
    }),
  );
}

export async function saveLastRead(studentId, { surahNumber, ayahNumber, page }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');
      student.currentSurah = surahNumber;
      student.lastReadAyah = ayahNumber;
      if (page) student.lastReadPage = page;
      return { surahNumber, ayahNumber, page: student.lastReadPage };
    }),
  );
}

export function getLastRead(studentId) {
  const student = getStudent(studentId);
  if (!student) return null;
  return {
    surahNumber: student.currentSurah,
    surahName: getSurah(student.currentSurah)?.name ?? '',
    ayahNumber: student.lastReadAyah ?? 1,
    page: student.lastReadPage,
  };
}

/* ---------------- تفضيلات القارئ ---------------- */
const DEFAULT_PREFS = { fontSize: 'md', reciter: RECITERS[0].id, showTafsir: false };

export function getReaderPrefs() {
  const stored = readStorage(STORAGE_KEYS.quranPrefs, {});
  return { ...DEFAULT_PREFS, ...(stored ?? {}) };
}

export function saveReaderPrefs(prefs) {
  const next = { ...getReaderPrefs(), ...prefs };
  writeStorage(STORAGE_KEYS.quranPrefs, next);
  return next;
}

/* ---------------- التحميل دون اتصال (محاكاة) ---------------- */
export function getOfflineSurahs() {
  return readStorage(STORAGE_KEYS.offlinePages, []);
}

/**
 * محاكاة تحميل سورة للقراءة دون اتصال مع تقدم تدريجي.
 * لا يتم تنزيل أي ملف فعلي.
 */
export async function downloadForOffline(surahNumber, onProgress) {
  const number = Number(surahNumber);
  const steps = [12, 34, 58, 77, 91, 100];
  for (const percent of steps) {
    // eslint-disable-next-line no-await-in-loop
    await delay(180);
    onProgress?.(percent);
  }
  const current = new Set(getOfflineSurahs());
  current.add(number);
  writeStorage(STORAGE_KEYS.offlinePages, [...current]);
  return [...current];
}

export function removeOffline(surahNumber) {
  const current = getOfflineSurahs().filter((item) => item !== Number(surahNumber));
  writeStorage(STORAGE_KEYS.offlinePages, current);
  return current;
}

export { SURAHS };
