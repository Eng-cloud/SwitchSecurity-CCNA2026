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

export async function getUsers({
  query = '',
  role = 'all',
  status = 'all',
  page = 1,
  perPage = 10,
  roles = null,
} = {}) {
  return request(() => {
    const db = getDb();
    // سجل المستخدمين الإداريين فقط — الطلاب لهم أقسامهم الخاصة.
    const allowed = roles ?? ['admin', 'supervisor', 'teacher', 'parent'];
    let users = db.users.filter((user) => allowed.includes(user.role));

    if (role !== 'all') users = users.filter((user) => user.role === role);
    if (status !== 'all') users = users.filter((user) => (user.status ?? 'active') === status);
    if (query) users = users.filter((user) => matchesQuery(user.name, query) || matchesQuery(user.email, query));

    // الأحدث أولًا حتى يظهر الحساب المضاف حديثًا في أعلى القائمة.
    users = [...users].sort((a, b) => new Date(b.joinedAt ?? 0) - new Date(a.joinedAt ?? 0));

    const rows = users.map((user) => {
      const circle =
        user.role === 'teacher'
          ? (db.circles.find((item) => item.teacherId === user.id) ?? null)
          : user.circleId
            ? getCircle(user.circleId)
            : null;
      return {
        id: user.id,
        name: user.name,
        role: user.role,
        adminLevel: user.adminLevel ?? null,
        email: user.email,
        city: user.city ?? '',
        district: user.district ?? '',
        circleName: circle?.name ?? '',
        status: user.status ?? 'active',
        joinedAt: user.joinedAt,
      };
    });

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
        // المعرِّفان لازمان للتعيين: الاسم يُعرض، والمعرِّف يُسنَد.
        teacherId: circle.teacherId ?? null,
        supervisorId: circle.supervisorId ?? null,
        teacherName: getUser(circle.teacherId)?.name ?? '',
        supervisorName: getUser(circle.supervisorId)?.name ?? '',
        city: circle.city ?? '',
        district: circle.district ?? '',
        mosque: circle.mosque ?? '',
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

/**
 * تقرير الإدارة بنطاقين.
 *
 *  circles: صفٌّ لكل حلقة — التقرير الخاص، يُقرأ لمتابعة حلقةٍ بعينها.
 *  cities : صفٌّ لكل مدينة — التقرير العام، يُقرأ لمقارنة المدن ببعضها.
 *
 * والفلترة بالمدينة تعمل في النطاقين: عامٌّ في مدينة، وخاصٌّ داخلها.
 */
export async function getAdminReport({ period = 'monthly', scope = 'circles', city = 'all' } = {}) {
  return request(() => {
    const db = getDb();
    const scoped =
      city === 'all' ? db.circles : db.circles.filter((circle) => circle.city === city);

    const perCircle = scoped.map((circle) => {
      const students = db.students.filter((student) => student.circleId === circle.id);
      const avg = (key) =>
        Math.round(students.reduce((sum, s) => sum + s[key], 0) / (students.length || 1));
      return {
        id: circle.id,
        name: circle.name,
        city: circle.city ?? '',
        district: circle.district ?? '',
        mosque: circle.mosque ?? '',
        teacherName: getUser(circle.teacherId)?.name ?? '',
        supervisorName: getUser(circle.supervisorId)?.name ?? '',
        studentsCount: students.length,
        attendanceRate: avg('attendanceRate'),
        performance: avg('masteryAvg'),
        testsAverage: avg('testsAvg'),
      };
    });

    const rows = scope === 'cities' ? groupByCity(perCircle) : perCircle;

    return {
      period,
      scope,
      city,
      rows,
      cities: [...new Set(db.circles.map((circle) => circle.city).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ar'),
      ),
      series: db.weeklySeries,
      totals: {
        circles: scoped.length,
        students: db.students.filter((student) =>
          scoped.some((circle) => circle.id === student.circleId),
        ).length,
        teachers: db.users.filter((user) => user.role === 'teacher').length,
        performance: weightedAverage(perCircle, 'performance'),
      },
    };
  });
}

/**
 * تجميع الحلقات في صفٍّ لكل مدينة.
 * المتوسطات موزونة بعدد الطلاب لا حسابية: حلقةٌ فيها ثلاثون طالبًا لا
 * تساوي حلقةً فيها ثلاثة عند قياس مدينة.
 */
function groupByCity(rows) {
  const byCity = new Map();

  rows.forEach((row) => {
    const key = row.city || '—';
    const bucket = byCity.get(key) ?? { name: key, circles: [] };
    bucket.circles.push(row);
    byCity.set(key, bucket);
  });

  return [...byCity.values()]
    .map((bucket) => ({
      id: `city-${bucket.name}`,
      name: bucket.name,
      circlesCount: bucket.circles.length,
      studentsCount: bucket.circles.reduce((sum, row) => sum + row.studentsCount, 0),
      attendanceRate: weightedAverage(bucket.circles, 'attendanceRate'),
      performance: weightedAverage(bucket.circles, 'performance'),
      testsAverage: weightedAverage(bucket.circles, 'testsAverage'),
    }))
    .sort((a, b) => b.studentsCount - a.studentsCount);
}

function weightedAverage(rows, key) {
  const weight = rows.reduce((sum, row) => sum + row.studentsCount, 0);
  if (weight === 0) return 0;
  return Math.round(
    rows.reduce((sum, row) => sum + row[key] * row.studentsCount, 0) / weight,
  );
}
