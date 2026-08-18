/** خدمة الإدارة — المؤشرات العامة، المستخدمون، الإحصائيات، إعدادات المنصة. */

import { request, ApiError, paginate, matchesQuery } from '../mock/api.js';
import { getDb, mutateDb, getCircle, getUser } from '../mock/db.js';

export async function getDashboard() {
  return request(() => {
    const db = getDb();
    const students = db.students;
    const teachers = db.users.filter((user) => user.role === 'teacher');
    const supervisors = db.users.filter((user) => user.role === 'supervisor');

    return {
      totals: {
        students: students.length,
        teachers: teachers.length,
        supervisors: supervisors.length,
        circles: db.circles.length,
      },
      series: db.weeklySeries,
      roleDistribution: [
        { label: 'الطلاب', value: students.length },
        { label: 'المعلمون', value: teachers.length },
        { label: 'المشرفون', value: supervisors.length },
      ],
      circleDistribution: db.circles.map((circle) => ({
        label: circle.name,
        value: db.students.filter((student) => student.circleId === circle.id).length,
      })),
      averageMastery: Math.round(
        students.reduce((sum, student) => sum + student.masteryAvg, 0) / (students.length || 1),
      ),
      averageAttendance: Math.round(
        students.reduce((sum, student) => sum + student.attendanceRate, 0) /
          (students.length || 1),
      ),
    };
  });
}

export async function getUsers({ query = '', role = 'all', status = 'all', page = 1, perPage = 10 } = {}) {
  return request(() => {
    const db = getDb();
    let users = db.users.filter((user) => user.role !== 'student' || user.studentId);

    if (role !== 'all') users = users.filter((user) => user.role === role);
    if (status !== 'all') users = users.filter((user) => (user.status ?? 'active') === status);
    if (query) users = users.filter((user) => matchesQuery(user.name, query) || matchesQuery(user.email, query));

    const rows = users.map((user) => ({
      id: user.id,
      name: user.name,
      role: user.role,
      email: user.email,
      circleName: user.circleId ? (getCircle(user.circleId)?.name ?? '') : '',
      status: user.status ?? 'active',
      joinedAt: user.joinedAt,
    }));

    return paginate(rows, { page, perPage });
  });
}

export async function getCircles({ query = '', page = 1, perPage = 10 } = {}) {
  return request(() => {
    const db = getDb();
    let circles = db.circles;
    if (query) circles = circles.filter((circle) => matchesQuery(circle.name, query));

    const rows = circles.map((circle) => {
      const students = db.students.filter((student) => student.circleId === circle.id);
      return {
        id: circle.id,
        name: circle.name,
        teacherName: getUser(circle.teacherId)?.name ?? '',
        supervisorName: getUser(circle.supervisorId)?.name ?? '',
        level: circle.level,
        schedule: circle.schedule,
        studentsCount: students.length,
        performance: Math.round(
          students.reduce((sum, student) => sum + student.masteryAvg, 0) / (students.length || 1),
        ),
      };
    });

    return paginate(rows, { page, perPage });
  });
}

export async function getAnalytics() {
  return request(() => {
    const db = getDb();
    return {
      activeUsers: db.users.filter((user) => (user.status ?? 'active') === 'active').length,
      sessionsPerWeek: db.sessions.length,
      growth: db.weeklySeries.map((week) => ({
        label: week.label,
        activity: week.activity,
        tests: week.tests,
      })),
      byRole: [
        { label: 'الطلاب', value: db.students.length },
        { label: 'المعلمون', value: db.users.filter((u) => u.role === 'teacher').length },
        { label: 'المشرفون', value: db.users.filter((u) => u.role === 'supervisor').length },
        { label: 'أولياء الأمور', value: db.users.filter((u) => u.role === 'parent').length },
      ],
      byCircle: db.circles.map((circle) => ({
        label: circle.name,
        value: db.students.filter((student) => student.circleId === circle.id).length,
      })),
    };
  });
}

export async function getPlatformSettings() {
  return request(() => ({ ...getDb().platformSettings }));
}

export async function updatePlatformSettings(changes) {
  return request(() =>
    mutateDb((db) => {
      if (!db.platformSettings) throw new ApiError('notFound', 'state.errorHint');
      Object.assign(db.platformSettings, changes);
      return { ...db.platformSettings };
    }),
  );
}

export async function getAdminReport({ period = 'monthly' } = {}) {
  return request(() => {
    const db = getDb();
    const rows = db.circles.map((circle) => {
      const students = db.students.filter((student) => student.circleId === circle.id);
      const avg = (key) =>
        Math.round(students.reduce((sum, s) => sum + s[key], 0) / (students.length || 1));
      return {
        id: circle.id,
        name: circle.name,
        teacherName: getUser(circle.teacherId)?.name ?? '',
        supervisorName: getUser(circle.supervisorId)?.name ?? '',
        studentsCount: students.length,
        attendanceRate: avg('attendanceRate'),
        performance: avg('masteryAvg'),
        testsAverage: avg('testsAvg'),
      };
    });

    return {
      period,
      rows,
      series: db.weeklySeries,
      totals: {
        circles: db.circles.length,
        students: db.students.length,
        teachers: db.users.filter((user) => user.role === 'teacher').length,
        performance: Math.round(
          rows.reduce((sum, row) => sum + row.performance, 0) / (rows.length || 1),
        ),
      },
    };
  });
}
