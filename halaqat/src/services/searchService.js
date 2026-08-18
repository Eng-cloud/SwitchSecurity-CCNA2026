/** بحث عام (طلاب، حلقات، سور) — يخدم صفحة البحث ولوحة الأوامر. */

import { request, matchesQuery } from '../mock/api.js';
import { getDb, getCircle } from '../mock/db.js';
import { SURAHS } from '../mock/quran.js';

export async function search(query, { role = 'student', limit = 6 } = {}) {
  return request(() => {
    const trimmed = (query ?? '').trim();
    if (trimmed.length < 2) return { students: [], circles: [], surahs: [], total: 0 };

    const db = getDb();
    const canSeeStudents = role !== 'student' && role !== 'parent';

    const students = canSeeStudents
      ? db.students
          .filter((student) => matchesQuery(student.name, trimmed))
          .slice(0, limit)
          .map((student) => ({
            id: student.id,
            name: student.name,
            circleName: getCircle(student.circleId)?.name ?? '',
            circleId: student.circleId,
          }))
      : [];

    const circles = canSeeStudents
      ? db.circles
          .filter((circle) => matchesQuery(circle.name, trimmed))
          .slice(0, limit)
          .map((circle) => ({ id: circle.id, name: circle.name }))
      : [];

    const surahs = SURAHS.filter((surah) => matchesQuery(surah.name, trimmed))
      .slice(0, limit)
      .map((surah) => ({ number: surah.number, name: surah.name, ayahCount: surah.ayahCount }));

    return {
      students,
      circles,
      surahs,
      total: students.length + circles.length + surahs.length,
    };
  });
}
