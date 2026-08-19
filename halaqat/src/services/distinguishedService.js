/**
 * خدمة «متميزو الشهر».
 *
 * التميّز هنا محسوب من نشاط الشهر نفسه لا من متوسط عمر الطالب كله، حتى لا
 * يبقى متصدّر الترتيب متصدّرًا بفضل شهور مضت. ثلاثة معايير معلنة:
 *   إتقان جلسات الشهر · حضور الشهر · عدد الجلسات (انتظام)
 * وتُعرض الثلاثة كما هي بجانب كل اسم فيفهم المعلم سبب الترتيب.
 *
 * النطاق: المعلم يرى حلقته، المشرف يرى حلقاته، الإدارة ترى الكل.
 * تنبيه: نسخة تجريبية بلا خادم — أرقامها من بيانات وهمية.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb } from '../mock/db.js';
import { can, ACTIONS } from '../config/permissions.js';

/** حدود التميّز — معلنة في الواجهة كي لا تكون قاعدة خفية. */
export const DISTINCTION = {
  minMastery: 85,
  minAttendance: 85,
  minSessions: 3,
};

function assertCan(role, action) {
  if (!can(role, action)) throw new ApiError('forbidden', 'state.forbiddenHint');
}

/** حدود الشهر: 'current' الشهر الجاري، 'previous' الشهر الماضي. */
export function monthRange(which = 'current', now = new Date()) {
  const offset = which === 'previous' ? -1 : 0;
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1, 0, 0, 0, 0);
  return { start, end, key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}` };
}

function within(dateish, range) {
  if (!dateish) return false;
  const time = new Date(dateish).getTime();
  return time >= range.start.getTime() && time < range.end.getTime();
}

/** مؤشرات طالب واحد خلال المدة. */
function statsFor(db, student, range) {
  const sessions = db.sessions.filter(
    (session) => session.studentId === student.id && within(session.createdAt, range),
  );
  const attendance = db.attendance.filter(
    (row) => row.studentId === student.id && within(row.date, range),
  );

  const mastery = sessions.length
    ? Math.round(sessions.reduce((sum, s) => sum + (s.mastery ?? 0), 0) / sessions.length)
    : null;

  const attended = attendance.filter((row) => row.status === 'present');
  const attendanceRate = attendance.length
    ? Math.round((attended.length / attendance.length) * 100)
    : null;

  // جلسات المراجعة التي سمعها مساعدٌ بتوكيل — تُحسب ضمن النشاط وتُعرض منفصلة.
  const byAssistant = sessions.filter((session) => session.recordedByAssistantId).length;

  return {
    sessionsCount: sessions.length,
    mastery,
    attendanceRate,
    reviewedByAssistant: byAssistant,
  };
}

/**
 * درجة الترتيب: الإتقان أولًا، ثم الحضور، ثم الانتظام.
 * الانتظام يُسقَّف عند ثماني جلسات فلا يتفوق كثير الجلسات على متقنها.
 */
function scoreOf(stats) {
  const mastery = stats.mastery ?? 0;
  const attendance = stats.attendanceRate ?? 0;
  const consistency = Math.min(stats.sessionsCount, 8) / 8 * 100;
  return Math.round(mastery * 0.6 + attendance * 0.25 + consistency * 0.15);
}

function isDistinguished(stats) {
  return (
    stats.sessionsCount >= DISTINCTION.minSessions &&
    (stats.mastery ?? 0) >= DISTINCTION.minMastery &&
    (stats.attendanceRate ?? 0) >= DISTINCTION.minAttendance
  );
}

/**
 * تقييم طالب واحد لمدة — تستعمله خدمة المساعد لتوحيد تعريف «المتميز»
 * فلا يُعرض اسم في قائمة المتميزين ثم يُرفض تعيينه بقاعدة أخرى.
 */
export function evaluateStudent(db, student, month = 'current') {
  const stats = statsFor(db, student, monthRange(month));
  return { ...stats, score: scoreOf(stats), distinguished: isDistinguished(stats) };
}

/** الحلقات التي يراها هذا الدور. */
function scopedCircles(db, { role, userId, circleId }) {
  if (circleId) return db.circles.filter((circle) => circle.id === circleId);
  if (role === 'admin') return db.circles;
  if (role === 'supervisor') return db.circles.filter((circle) => circle.supervisorId === userId);
  if (role === 'teacher') return db.circles.filter((circle) => circle.teacherId === userId);
  return [];
}

/**
 * متميزو الشهر ضمن نطاق الدور.
 * @returns {{ month, circles: [{ circleId, circleName, teacherName, students: [...] }], top: [...] }}
 */
export async function listMonthlyDistinguished({
  role,
  userId,
  circleId = null,
  month = 'current',
  limitPerCircle = 5,
} = {}) {
  return request(() => {
    assertCan(role, ACTIONS.DISTINGUISHED_VIEW);
    const db = getDb();
    const range = monthRange(month);
    const circles = scopedCircles(db, { role, userId, circleId });

    const perCircle = circles.map((circle) => {
      const rows = db.students
        .filter((student) => student.circleId === circle.id)
        .map((student) => {
          const stats = statsFor(db, student, range);
          return {
            id: student.id,
            name: student.name,
            circleId: circle.id,
            circleName: circle.name,
            isAssistant: Boolean(student.isAssistant),
            // متوسط الإتقان العام — يُعرض للمقارنة مع أداء الشهر.
            overallMastery: student.masteryAvg,
            ...stats,
            score: scoreOf(stats),
            distinguished: isDistinguished(stats),
          };
        })
        .filter((row) => row.distinguished)
        .sort((a, b) => b.score - a.score)
        .slice(0, limitPerCircle);

      return {
        circleId: circle.id,
        circleName: circle.name,
        teacherName: db.users.find((user) => user.id === circle.teacherId)?.name ?? '',
        studentsCount: db.students.filter((student) => student.circleId === circle.id).length,
        students: rows,
      };
    });

    return {
      month: { key: range.key, which: month, startsAt: range.start.toISOString() },
      criteria: { ...DISTINCTION },
      circles: perCircle,
      // ترتيب موحّد عبر كل الحلقات — يهم المشرف والإدارة.
      top: perCircle
        .flatMap((entry) => entry.students)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10),
      totalDistinguished: perCircle.reduce((sum, entry) => sum + entry.students.length, 0),
    };
  });
}
