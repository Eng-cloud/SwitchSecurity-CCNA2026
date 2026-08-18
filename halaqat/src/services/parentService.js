/** خدمة ولي الأمر — متابعة الأبناء. */

import { request, ApiError } from '../mock/api.js';
import { getDb, getCircle, getStudent, getUser, getSurahName } from '../mock/db.js';

export async function getChildren(parentId) {
  return request(() => {
    const db = getDb();
    const parent = getUser(parentId);
    if (!parent) throw new ApiError('notFound', 'state.notFoundHint');
    const ids = parent.childrenIds ?? [];

    return ids
      .map((id) => getStudent(id))
      .filter(Boolean)
      .map((student) => ({
        id: student.id,
        name: student.name,
        circleName: getCircle(student.circleId)?.name ?? '',
        teacherName: getUser(student.teacherId)?.name ?? '',
        memorizedPages: student.memorizedPages,
        memorizedJuz: student.memorizedJuz,
        masteryAvg: student.masteryAvg,
        attendanceRate: student.attendanceRate,
        testsAvg: student.testsAvg,
        streak: student.streak,
        status: student.status,
        lastRecitationAt: student.lastRecitationAt,
      }));
  });
}

export async function getChildDetail(parentId, studentId) {
  return request(() => {
    const parent = getUser(parentId);
    if (!parent?.childrenIds?.includes(studentId)) {
      throw new ApiError('forbidden', 'state.forbiddenHint');
    }
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();

    return {
      id: student.id,
      name: student.name,
      circleName: getCircle(student.circleId)?.name ?? '',
      teacherName: getUser(student.teacherId)?.name ?? '',
      memorizedPages: student.memorizedPages,
      memorizedJuz: student.memorizedJuz,
      masteryAvg: student.masteryAvg,
      reviewRate: student.reviewRate,
      attendanceRate: student.attendanceRate,
      testsAvg: student.testsAvg,
      streak: student.streak,
      status: student.status,
      series: db.weeklySeries,
      sessions: db.sessions
        .filter((session) => session.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 8)
        .map((session) => ({ ...session, surahName: getSurahName(session.surahNumber) })),
      notes: db.notes
        .filter((note) => note.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 5),
      attendance: db.attendance.filter((row) => row.studentId === studentId).slice(0, 14),
    };
  });
}
