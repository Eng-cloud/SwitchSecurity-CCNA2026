/** بحث عام محصور بنطاق كل دور — لا يبحث أحد فيما لا يخصه. */

import { request, matchesQuery } from '../mock/api.js';
import { getDb, getCircle, getUser } from '../mock/db.js';
import { SURAHS } from '../mock/quran.js';
import { searchScope } from '../config/permissions.js';

/**
 * @param {string} query
 * @param {object} context { role, userId, circleId, childrenIds }
 */
export async function search(query, context = {}) {
  const { role = 'student', userId = null, circleId = null, childrenIds = [] } = context;

  return request(() => {
    const trimmed = (query ?? '').trim();
    if (trimmed.length < 2) return { students: [], circles: [], surahs: [], total: 0 };

    const db = getDb();
    const scope = searchScope(role);
    const limit = context.limit ?? 6;

    /* ---------- الطلاب حسب النطاق ---------- */
    let studentPool = [];
    if (scope.students === 'all') {
      studentPool = db.students;
    } else if (scope.students === 'circle' && circleId) {
      studentPool = db.students.filter((student) => student.circleId === circleId);
    } else if (scope.students === 'supervised' && userId) {
      const circleIds = new Set(
        db.circles.filter((circle) => circle.supervisorId === userId).map((circle) => circle.id),
      );
      studentPool = db.students.filter((student) => circleIds.has(student.circleId));
    } else if (scope.students === 'children') {
      studentPool = db.students.filter((student) => childrenIds.includes(student.id));
    }

    const students = studentPool
      .filter((student) => matchesQuery(student.name, trimmed))
      .slice(0, limit)
      .map((student) => ({
        id: student.id,
        name: student.name,
        circleName: getCircle(student.circleId)?.name ?? '',
        circleId: student.circleId,
      }));

    /* ---------- الحلقات حسب النطاق ---------- */
    let circlePool = [];
    if (scope.circles === 'all') {
      circlePool = db.circles;
    } else if (scope.circles === 'supervised' && userId) {
      circlePool = db.circles.filter((circle) => circle.supervisorId === userId);
    }

    const circles = circlePool
      .filter(
        (circle) =>
          matchesQuery(circle.name, trimmed) ||
          matchesQuery(circle.district ?? '', trimmed) ||
          matchesQuery(getUser(circle.teacherId)?.name ?? '', trimmed),
      )
      .slice(0, limit)
      .map((circle) => ({
        id: circle.id,
        name: circle.name,
        district: circle.district ?? '',
        teacherName: getUser(circle.teacherId)?.name ?? '',
      }));

    /* ---------- السور: لمن يملك المصحف فقط ---------- */
    const surahs = scope.surahs
      ? SURAHS.filter((surah) => matchesQuery(surah.name, trimmed))
          .slice(0, limit)
          .map((surah) => ({
            number: surah.number,
            name: surah.name,
            ayahCount: surah.ayahCount,
          }))
      : [];

    return {
      students,
      circles,
      surahs,
      total: students.length + circles.length + surahs.length,
    };
  });
}
