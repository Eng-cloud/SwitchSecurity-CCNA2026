/** خدمة المعلم — الحلقة، الطلاب، الحضور، الملاحظات، الجلسات. */

import { request, ApiError, paginate, matchesQuery } from '../mock/api.js';
import { getDb, mutateDb, getCircle, getStudent, getUser, getSurahName } from '../mock/db.js';
import { toISODate } from '../lib/format.js';
import { authorityOver } from './coverageService.js';

function circleOfTeacher(teacherId) {
  return getDb().circles.find((circle) => circle.teacherId === teacherId) ?? null;
}

export async function getDashboard(teacherId) {
  return request(() => {
    const circle = circleOfTeacher(teacherId);
    if (!circle) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const students = db.students.filter((student) => student.circleId === circle.id);
    const today = toISODate(new Date());
    const todayAttendance = db.attendance.filter(
      (row) => row.circleId === circle.id && row.date === today,
    );
    const presentCount = todayAttendance.filter((row) => row.status === 'present').length;
    const needsFollowUp = students.filter((student) => student.status === 'atRisk');
    const todaySessions = db.sessions.filter(
      (session) => session.circleId === circle.id && session.createdAt.slice(0, 10) === today,
    );

    return {
      circle: { id: circle.id, name: circle.name, schedule: circle.schedule, level: circle.level },
      studentsCount: students.length,
      presentCount,
      absentCount: Math.max(0, students.length - presentCount),
      todaySessionsCount: todaySessions.length,
      needsFollowUpCount: needsFollowUp.length,
      needsFollowUp: needsFollowUp.slice(0, 4).map((student) => ({
        id: student.id,
        name: student.name,
        attendanceRate: student.attendanceRate,
        masteryAvg: student.masteryAvg,
        status: student.status,
      })),
      weeklySeries: db.weeklySeries,
    };
  });
}

export async function getCircleStudents(
  circleId,
  { query = '', status = 'all', page = 1, perPage = 8, sort = null } = {},
) {
  return request(() => {
    const db = getDb();
    let students = db.students.filter((student) => student.circleId === circleId);

    if (query) students = students.filter((student) => matchesQuery(student.name, query));
    if (status !== 'all') students = students.filter((student) => student.status === status);

    if (sort?.key) {
      const direction = sort.direction === 'desc' ? -1 : 1;
      students = [...students].sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * direction;
        return String(av).localeCompare(String(bv), 'ar') * direction;
      });
    }

    const today = toISODate(new Date());
    const rows = students.map((student) => {
      const attendance = db.attendance.find(
        (row) => row.studentId === student.id && row.date === today,
      );
      return {
        id: student.id,
        name: student.name,
        // لا سجل ≠ غياب: التمييز بينهما هو ما يجعل التصحيح ممكنًا.
        attendanceToday: attendance?.status ?? 'notRecorded',
        attendanceRate: student.attendanceRate,
        memorizedPages: student.memorizedPages,
        reviewRate: student.reviewRate,
        masteryAvg: student.masteryAvg,
        lastRecitationAt: student.lastRecitationAt,
        status: student.status,
        isAssistant: Boolean(student.isAssistant),
      };
    });

    return paginate(rows, { page, perPage });
  });
}

/** حالات الحضور المخزَّنة. «لم يُسجَّل» ليست منها: هي غياب السجل نفسه. */
export const ATTENDANCE_STATUSES = ['present', 'late', 'absent', 'excused'];

export const ATTENDANCE_NOT_RECORDED = 'notRecorded';

/**
 * يضبط حضور اليوم لطالب — أو يمحوه.
 *
 * الحضور إقرار من المعلم، والإقرار يُخطئ: يُنقر السطر الخطأ، أو يصل الطالب
 * متأخرًا بعد أن سُجِّل غيابه. لذلك ليست هذه دالة «تسجيل» باتجاه واحد، بل
 * ضبطٌ لحالة تقبل كل القيم وتقبل المسح. تمرير `notRecorded` (أو `null`)
 * يحذف السجل فيعود اليوم كما لو لم يُلمس — وهذا هو التراجع الحقيقي، لا
 * استبدال خطأٍ بخطأٍ آخر اسمه «غائب».
 */
export async function setAttendance({ studentId, status, role, userId }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      // من يقود الحلقة اليوم يسجّل حضورها: معلّمها، أو نائبه، أو مشرفها.
      // السلطة تُسأل من مصدر واحد فلا تتفرق قواعدها بين شاشة وأخرى.
      const { allowed } = authorityOver(db, { role, userId, circleId: student.circleId });
      if (!allowed) throw new ApiError('forbidden', 'state.forbiddenHint');

      const today = toISODate(new Date());
      const index = db.attendance.findIndex(
        (row) => row.studentId === studentId && row.date === today,
      );

      if (status === null || status === ATTENDANCE_NOT_RECORDED) {
        if (index >= 0) db.attendance.splice(index, 1);
        return { studentId, status: ATTENDANCE_NOT_RECORDED, date: today, cleared: true };
      }

      if (!ATTENDANCE_STATUSES.includes(status)) {
        throw new ApiError('validation', 'teacher.attendanceInvalid');
      }

      if (index >= 0) db.attendance[index].status = status;
      else
        db.attendance.unshift({
          // مفتاح مشتق من الطالب واليوم: لا يتكرر ولو ضُبط الحضور مرارًا.
          id: `att-${studentId}-${today}`,
          studentId,
          circleId: student.circleId,
          date: today,
          status,
        });

      return { studentId, status, date: today, cleared: false };
    }),
  );
}

export async function getStudentProfile(studentId) {
  return request(() => {
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const circle = getCircle(student.circleId);
    const teacher = getUser(student.teacherId);

    return {
      id: student.id,
      name: student.name,
      age: student.age,
      level: student.level,
      city: student.city,
      guardianName: student.guardianName,
      guardianPhone: student.guardianPhone,
      joinedAt: student.joinedAt,
      circleName: circle?.name ?? '',
      circleId: circle?.id ?? '',
      teacherName: teacher?.name ?? '',
      status: student.status,
      isAssistant: Boolean(student.isAssistant),
      memorizedPages: student.memorizedPages,
      memorizedJuz: student.memorizedJuz,
      masteryAvg: student.masteryAvg,
      reviewRate: student.reviewRate,
      attendanceRate: student.attendanceRate,
      testsAvg: student.testsAvg,
      lastRecitationAt: student.lastRecitationAt,
      sessions: db.sessions
        .filter((session) => session.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10)
        .map((session) => ({ ...session, surahName: getSurahName(session.surahNumber) })),
      notes: db.notes
        .filter((note) => note.studentId === studentId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      attendance: db.attendance
        .filter((row) => row.studentId === studentId)
        .slice(0, 14),
      weeklySeries: db.weeklySeries,
    };
  });
}

export async function addNote(studentId, { type, text, authorId }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');
      const note = {
        id: `note-${Date.now()}`,
        studentId,
        authorId,
        authorName: getUser(authorId)?.name ?? '',
        type,
        text: String(text).trim(),
        createdAt: new Date().toISOString(),
      };
      db.notes.unshift(note);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'note',
        createdAt: note.createdAt,
        read: false,
        link: `/app/teacher/students/${studentId}`,
        roles: ['student', 'parent'],
      });
      return note;
    }),
  );
}

export async function recordSession(studentId, { type, surahNumber, fromAyah, toAyah, grade, notes, teacherId }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      const masteryByGrade = { excellent: 95, good: 82, needsWork: 66 };
      const session = {
        id: `session-t-${Date.now()}`,
        studentId,
        teacherId: teacherId ?? student.teacherId,
        circleId: student.circleId,
        type,
        surahNumber: Number(surahNumber),
        fromAyah: Number(fromAyah),
        toAyah: Number(toAyah),
        mastery: masteryByGrade[grade] ?? 80,
        grade,
        durationSeconds: 0,
        notes: notes ?? '',
        createdAt: new Date().toISOString(),
      };
      db.sessions.unshift(session);
      student.lastRecitationAt = session.createdAt;
      return { ...session, surahName: getSurahName(session.surahNumber) };
    }),
  );
}

export async function getCircleReport(circleId, { period = 'weekly' } = {}) {
  return request(() => {
    const db = getDb();
    const circle = getCircle(circleId);
    if (!circle) throw new ApiError('notFound', 'state.notFoundHint');
    const students = db.students.filter((student) => student.circleId === circleId);
    const average = (key) =>
      Math.round(students.reduce((sum, student) => sum + student[key], 0) / (students.length || 1));

    return {
      period,
      circle: { id: circle.id, name: circle.name },
      studentsCount: students.length,
      attendanceRate: average('attendanceRate'),
      averageMastery: average('masteryAvg'),
      reviewRate: average('reviewRate'),
      testsAverage: average('testsAvg'),
      series: db.weeklySeries,
      rows: students.slice(0, 24).map((student) => ({
        id: student.id,
        name: student.name,
        attendanceRate: student.attendanceRate,
        memorizedPages: student.memorizedPages,
        masteryAvg: student.masteryAvg,
        testsAvg: student.testsAvg,
        status: student.status,
      })),
    };
  });
}
