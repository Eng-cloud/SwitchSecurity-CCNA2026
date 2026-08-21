/** خدمة المشرف — الحلقات التابعة، المعلمون، الحالات التي تحتاج متابعة. */

import { request, ApiError, paginate, matchesQuery } from '../mock/api.js';
import { getDb, getCircle, getUser } from '../mock/db.js';
import { toISODate } from '../lib/format.js';

function circleStats(circleId) {
  const db = getDb();
  const students = db.students.filter((student) => student.circleId === circleId);
  const avg = (key) =>
    Math.round(students.reduce((sum, student) => sum + student[key], 0) / (students.length || 1));
  return {
    studentsCount: students.length,
    attendanceRate: avg('attendanceRate'),
    performance: avg('masteryAvg'),
    atRisk: students.filter((student) => student.status === 'atRisk').length,
  };
}

export async function getDashboard(supervisorId) {
  return request(() => {
    const db = getDb();
    const circles = db.circles.filter((circle) => circle.supervisorId === supervisorId);
    if (!circles.length) throw new ApiError('notFound', 'state.notFoundHint');

    const stats = circles.map((circle) => ({ circle, ...circleStats(circle.id) }));
    const studentsCount = stats.reduce((sum, item) => sum + item.studentsCount, 0);
    const performance = Math.round(
      stats.reduce((sum, item) => sum + item.performance, 0) / (stats.length || 1),
    );

    const attention = db.students
      .filter((student) => circles.some((circle) => circle.id === student.circleId))
      .filter((student) => student.status === 'atRisk')
      .slice(0, 6)
      .map((student) => ({
        id: student.id,
        name: student.name,
        circleName: getCircle(student.circleId)?.name ?? '',
        attendanceRate: student.attendanceRate,
        masteryAvg: student.masteryAvg,
        reason:
          student.attendanceRate < 72
            ? 'lowAttendance'
            : student.masteryAvg < 68
              ? 'lowPerformance'
              : 'noRecitation',
      }));

    return {
      circlesCount: circles.length,
      teachersCount: new Set(circles.map((circle) => circle.teacherId)).size,
      studentsCount,
      performance,
      attention,
      series: db.weeklySeries,
      distribution: stats.map((item) => ({
        label: item.circle.name,
        value: item.studentsCount,
      })),
    };
  });
}

export async function getCircles(supervisorId, { query = '', page = 1, perPage = 6 } = {}) {
  return request(() => {
    const db = getDb();
    let circles = db.circles.filter((circle) => circle.supervisorId === supervisorId);
    if (query) circles = circles.filter((circle) => matchesQuery(circle.name, query));

    const rows = circles.map((circle) => ({
      id: circle.id,
      name: circle.name,
      teacherName: getUser(circle.teacherId)?.name ?? '',
      teacherId: circle.teacherId,
      level: circle.level,
      days: circle.days ?? '',
      startTime: circle.startTime ?? '',
      endTime: circle.endTime ?? '',
      ...circleStats(circle.id),
    }));

    return paginate(rows, { page, perPage });
  });
}

export async function getCircleDetail(circleId) {
  return request(() => {
    const circle = getCircle(circleId);
    if (!circle) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const teacher = getUser(circle.teacherId);
    const students = db.students.filter((student) => student.circleId === circleId);
    const today = toISODate(new Date());

    return {
      id: circle.id,
      name: circle.name,
      level: circle.level,
      days: circle.days ?? '',
      startTime: circle.startTime ?? '',
      endTime: circle.endTime ?? '',
      location: circle.location,
      teacher: teacher
        ? {
            id: teacher.id,
            name: teacher.name,
            email: teacher.email,
            phone: teacher.phone,
            joinedAt: teacher.joinedAt,
            // حالة الحساب تُعرض في الحلقة: معلم موقوف يجب أن يُرى موقوفًا.
            status: teacher.status ?? 'active',
          }
        : null,
      ...circleStats(circleId),
      students: students.map((student) => ({
        id: student.id,
        name: student.name,
        attendanceRate: student.attendanceRate,
        // حضور اليوم: بدونه لا يستطيع المشرف تسجيله ولا تصحيحه من الحلقة.
        attendanceToday:
          db.attendance.find((row) => row.studentId === student.id && row.date === today)?.status ??
          'absent',
        masteryAvg: student.masteryAvg,
        memorizedPages: student.memorizedPages,
        status: student.status,
      })),
      series: db.weeklySeries,
    };
  });
}

export async function getSupervisorReport(supervisorId, { period = 'monthly' } = {}) {
  return request(() => {
    const db = getDb();
    const circles = db.circles.filter((circle) => circle.supervisorId === supervisorId);
    const rows = circles.map((circle) => ({
      id: circle.id,
      name: circle.name,
      teacherName: getUser(circle.teacherId)?.name ?? '',
      ...circleStats(circle.id),
    }));

    return {
      period,
      rows,
      series: db.weeklySeries,
      totals: {
        circles: circles.length,
        students: rows.reduce((sum, row) => sum + row.studentsCount, 0),
        attendanceRate: Math.round(
          rows.reduce((sum, row) => sum + row.attendanceRate, 0) / (rows.length || 1),
        ),
        performance: Math.round(
          rows.reduce((sum, row) => sum + row.performance, 0) / (rows.length || 1),
        ),
      },
    };
  });
}
