/**
 * خدمة الإدارة والإشراف — إضافة وحذف وتعديل المستخدمين والحلقات والطلاب،
 * ومراجعة طلبات تسجيل الأبناء.
 *
 * كل دالة تتحقق من الصلاحية أولًا عبر مصفوفة الصلاحيات، فلا تعتمد الحماية
 * على إخفاء الأزرار في الواجهة وحدها.
 */

import { request, ApiError, paginate, matchesQuery } from '../mock/api.js';
import { getDb, mutateDb, getCircle, getUser } from '../mock/db.js';
import { can, ACTIONS } from '../config/permissions.js';

function assertCan(role, action) {
  if (!can(role, action)) throw new ApiError('forbidden', 'state.forbiddenHint');
}

/** مستويا الإداري: العليا تملك كل شيء، والمحدود يُسنَد إليه بعضه. */
export const ADMIN_LEVELS = ['super', 'limited'];

export function isSuperAdmin(db, userId) {
  const user = db.users.find((item) => item.id === userId);
  return user?.role === 'admin' && user.adminLevel === 'super';
}

/**
 * حساب الإداري لا يُنشئه ولا يحذفه إلا إداريٌّ أعلى.
 * لو ملك المحدودُ إنشاءَ إداريٍّ لَملك تجاوزَ حدّه بخطوة واحدة.
 */
function assertSuperAdmin(db, actorId) {
  if (!isSuperAdmin(db, actorId)) throw new ApiError('forbidden', 'admin.errors.superOnly');
}

function circleStats(circleId) {
  const db = getDb();
  const students = db.students.filter((student) => student.circleId === circleId);
  const avg = (key) =>
    Math.round(students.reduce((sum, student) => sum + (student[key] ?? 0), 0) / (students.length || 1));
  return {
    studentsCount: students.length,
    attendanceRate: avg('attendanceRate'),
    performance: avg('masteryAvg'),
    atRisk: students.filter((student) => student.status === 'atRisk').length,
  };
}

/** الحلقات التي يشرف عليها المستخدم — الإدارة ترى الكل. */
function scopedCircles(role, userId) {
  const db = getDb();
  if (role === 'admin') return db.circles;
  return db.circles.filter((circle) => circle.supervisorId === userId);
}

/* ===============================================================
   المشرفون
   =============================================================== */
export async function listSupervisors({ role, query = '', city = 'all', page = 1, perPage = 8 } = {}) {
  return request(() => {
    assertCan(role, ACTIONS.SUPERVISORS_MANAGE);
    const db = getDb();

    let supervisors = db.users.filter((user) => user.role === 'supervisor');
    if (query) supervisors = supervisors.filter((user) => matchesQuery(user.name, query));
    if (city !== 'all') supervisors = supervisors.filter((user) => user.city === city);

    // الأحدث أولًا: من يضيف مشرفًا يجب أن يراه فورًا لا في آخر صفحة.
    supervisors = [...supervisors].sort(
      (a, b) => new Date(b.joinedAt ?? 0) - new Date(a.joinedAt ?? 0),
    );

    const rows = supervisors.map((supervisor) => {
      const circles = db.circles.filter((circle) => circle.supervisorId === supervisor.id);
      const studentsCount = circles.reduce(
        (sum, circle) => sum + db.students.filter((s) => s.circleId === circle.id).length,
        0,
      );
      return {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email,
        phone: supervisor.phone,
        city: supervisor.city,
        district: supervisor.district ?? '',
        status: supervisor.status ?? 'active',
        circlesCount: circles.length,
        teachersCount: new Set(circles.map((circle) => circle.teacherId)).size,
        studentsCount,
        circles: circles.map((circle) => ({
          id: circle.id,
          name: circle.name,
          teacherName: getUser(circle.teacherId)?.name ?? '',
          ...circleStats(circle.id),
        })),
      };
    });

    return paginate(rows, { page, perPage });
  });
}

/* ===============================================================
   المعلمون
   =============================================================== */
export async function listTeachers({
  role,
  userId,
  query = '',
  city = 'all',
  page = 1,
  perPage = 8,
} = {}) {
  return request(() => {
    assertCan(role, ACTIONS.TEACHERS_MANAGE);
    const db = getDb();
    const circles = scopedCircles(role, userId);
    const allowedTeacherIds = new Set(circles.map((circle) => circle.teacherId));

    let teachers = db.users.filter(
      (user) => user.role === 'teacher' && (role === 'admin' || allowedTeacherIds.has(user.id)),
    );
    if (query) teachers = teachers.filter((user) => matchesQuery(user.name, query));
    if (city !== 'all') teachers = teachers.filter((user) => user.city === city);

    teachers = [...teachers].sort((a, b) => new Date(b.joinedAt ?? 0) - new Date(a.joinedAt ?? 0));

    const rows = teachers.map((teacher) => {
      const circle = db.circles.find((item) => item.teacherId === teacher.id) ?? null;
      const students = circle
        ? db.students.filter((student) => student.circleId === circle.id)
        : [];
      return {
        id: teacher.id,
        name: teacher.name,
        email: teacher.email,
        phone: teacher.phone,
        city: teacher.city,
        district: teacher.district ?? '',
        status: teacher.status ?? 'active',
        circleId: circle?.id ?? null,
        circleName: circle?.name ?? '',
        mosque: circle?.mosque ?? '',
        studentsCount: students.length,
        assistantsCount: students.filter((student) => student.isAssistant).length,
        performance: circle ? circleStats(circle.id).performance : 0,
        students: students.map((student) => ({
          id: student.id,
          name: student.name,
          masteryAvg: student.masteryAvg,
          attendanceRate: student.attendanceRate,
          isAssistant: Boolean(student.isAssistant),
          status: student.status,
        })),
      };
    });

    return paginate(rows, { page, perPage });
  });
}

/** إضافة مستخدم (معلم أو مشرف) — تُنشئ حلقة تلقائيًا للمعلم عند الطلب. */
export async function createUser({ role, actorId, payload }) {
  return request(() =>
    mutateDb((db) => {
      const targetRole = payload.role;
      if (targetRole === 'supervisor') assertCan(role, ACTIONS.SUPERVISORS_MANAGE);
      else if (targetRole === 'teacher') assertCan(role, ACTIONS.TEACHERS_MANAGE);
      else assertCan(role, ACTIONS.USERS_MANAGE);

      // إداريٌّ جديد: من الإدارة العليا وحدها، وبمستوى صريح.
      let adminLevel = null;
      if (targetRole === 'admin') {
        assertSuperAdmin(db, actorId);
        adminLevel = payload.adminLevel ?? 'limited';
        if (!ADMIN_LEVELS.includes(adminLevel)) {
          throw new ApiError('invalidLevel', 'admin.errors.invalidAdminLevel');
        }
      }

      const name = String(payload.name ?? '').trim();
      if (name.length < 3) throw new ApiError('invalidName', 'auth.errors.nameShort');

      const user = {
        id: `user-${targetRole}-${Date.now()}`,
        name,
        role: targetRole,
        email: payload.email || `${targetRole}.${Date.now()}@halaqat.sa`,
        phone: payload.phone || '',
        city: payload.city || '',
        district: payload.district || '',
        status: 'active',
        joinedAt: new Date().toISOString(),
        title:
          targetRole === 'teacher'
            ? 'معلم حلقة'
            : targetRole === 'admin'
              ? adminLevel === 'super'
                ? 'إدارة عليا'
                : 'إداري'
              : 'مشرف حلقات',
        ...(adminLevel ? { adminLevel } : {}),
        createdBy: actorId,
      };
      db.users.push(user);

      // معلم جديد يحتاج حلقة ليظهر له طلاب وجدول.
      if (targetRole === 'teacher' && payload.circleName) {
        db.circles.push({
          id: `circle-${Date.now()}`,
          name: String(payload.circleName).trim(),
          teacherId: user.id,
          supervisorId: payload.supervisorId ?? actorId,
          level: payload.level ?? 'beginner',
          schedule: payload.schedule ?? 'الأحد – الخميس · بعد المغرب',
          location: payload.mosque ?? '',
          city: payload.city ?? '',
          district: payload.district ?? '',
          mosque: payload.mosque ?? '',
          studentIds: [],
        });
      }

      return { ...user };
    }),
  );
}

/** حذف مستخدم — يمنع حذف حلقة عامرة بالطلاب دون نقلهم. */
export async function deleteUser({ role, userId, actorId }) {
  return request(() =>
    mutateDb((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError('notFound', 'state.notFoundHint');

      if (user.role === 'admin') {
        assertCan(role, ACTIONS.USERS_MANAGE);
        assertSuperAdmin(db, actorId);
        if (user.id === actorId) throw new ApiError('self', 'admin.errors.deleteSelf');
        // آخر إدارةٍ عليا لا تُحذف: منصةٌ بلا من يملك مفاتيحها مقفلة.
        if (user.adminLevel === 'super') {
          const supers = db.users.filter(
            (item) => item.role === 'admin' && item.adminLevel === 'super',
          );
          if (supers.length <= 1) throw new ApiError('lastSuper', 'admin.errors.lastSuperAdmin');
        }
      } else if (user.role === 'supervisor') assertCan(role, ACTIONS.SUPERVISORS_MANAGE);
      else if (user.role === 'teacher') assertCan(role, ACTIONS.TEACHERS_MANAGE);
      else assertCan(role, ACTIONS.USERS_MANAGE);

      if (user.role === 'teacher') {
        const circle = db.circles.find((item) => item.teacherId === userId);
        const students = circle
          ? db.students.filter((student) => student.circleId === circle.id)
          : [];
        if (students.length > 0) {
          throw new ApiError('circleNotEmpty', 'admin.errors.circleNotEmpty');
        }
        if (circle) db.circles = db.circles.filter((item) => item.id !== circle.id);
      }

      if (user.role === 'supervisor') {
        const circles = db.circles.filter((circle) => circle.supervisorId === userId);
        if (circles.length > 0) throw new ApiError('hasCircles', 'admin.errors.supervisorHasCircles');
      }

      db.users = db.users.filter((item) => item.id !== userId);
      return { id: userId };
    }),
  );
}

/** تغيير دور مستخدم (إداري ← مشرف ← معلم). */
export async function changeUserRole({ role, userId, nextRole }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.USERS_MANAGE);
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError('notFound', 'state.notFoundHint');
      if (user.role === 'student' || user.role === 'parent') {
        throw new ApiError('unsupportedRole', 'admin.errors.roleChangeUnsupported');
      }
      if (!['admin', 'supervisor', 'teacher'].includes(nextRole)) {
        throw new ApiError('unsupportedRole', 'admin.errors.roleChangeUnsupported');
      }
      if (user.role === 'teacher' && nextRole !== 'teacher') {
        const circle = db.circles.find((item) => item.teacherId === userId);
        const students = circle ? db.students.filter((s) => s.circleId === circle.id) : [];
        if (students.length > 0) throw new ApiError('circleNotEmpty', 'admin.errors.circleNotEmpty');
        if (circle) db.circles = db.circles.filter((item) => item.id !== circle.id);
      }

      user.role = nextRole;
      user.title = nextRole === 'teacher' ? 'معلم حلقة' : nextRole === 'supervisor' ? 'مشرف حلقات' : 'إداري';
      return { ...user };
    }),
  );
}

/**
 * إيقاف مستخدم أو إعادة تفعيله.
 * الصلاحية بحسب المستهدَف لا بحسب إجراء واحد عام: إيقاف معلمٍ من اختصاص
 * مشرفه والإدارة، وإيقاف مشرف للإدارة وحدها — كما في الحذف تمامًا.
 */
export async function setUserStatus({ role, userId, status }) {
  return request(() =>
    mutateDb((db) => {
      const user = db.users.find((item) => item.id === userId);
      if (!user) throw new ApiError('notFound', 'state.notFoundHint');

      if (user.role === 'teacher') assertCan(role, ACTIONS.TEACHERS_MANAGE);
      else if (user.role === 'supervisor') assertCan(role, ACTIONS.SUPERVISORS_MANAGE);
      else assertCan(role, ACTIONS.USERS_MANAGE);

      if (!['active', 'suspended'].includes(status)) {
        throw new ApiError('invalidStatus', 'state.errorHint');
      }

      user.status = status;
      return { ...user };
    }),
  );
}

/* ===============================================================
   الحلقات
   =============================================================== */
export async function createCircle({ role, actorId, payload }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.CIRCLES_MANAGE);
      const name = String(payload.name ?? '').trim();
      if (name.length < 3) throw new ApiError('invalidName', 'admin.errors.circleNameShort');

      const circle = {
        id: `circle-${Date.now()}`,
        name,
        teacherId: payload.teacherId ?? null,
        supervisorId: role === 'supervisor' ? actorId : (payload.supervisorId ?? null),
        level: payload.level ?? 'beginner',
        schedule: payload.schedule ?? 'الأحد – الخميس · بعد المغرب',
        location: payload.mosque ?? '',
        city: payload.city ?? '',
        district: payload.district ?? '',
        mosque: payload.mosque ?? '',
        studentIds: [],
      };
      db.circles.push(circle);
      return { ...circle };
    }),
  );
}

export async function deleteCircle({ role, circleId }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.CIRCLES_MANAGE);
      const students = db.students.filter((student) => student.circleId === circleId);
      if (students.length > 0) throw new ApiError('circleNotEmpty', 'admin.errors.circleNotEmpty');
      db.circles = db.circles.filter((circle) => circle.id !== circleId);
      return { id: circleId };
    }),
  );
}

/**
 * تعيين معلّم الحلقة أو مشرفها — أو إلغاء التعيين.
 *
 * التعيين وإلغاؤه فعلٌ واحد بقيمتين: تمرير معرِّف يُسنِد، وتمرير null
 * يُفرِغ الخانة. وحلقةٌ بلا معلّم حالةٌ مشروعة لا خطأ: تظهر عند المشرف
 * في «تغطية اليوم» بلا تغطية، وهذا هو المقصود.
 */
export async function assignCircleRole({ role, actorId, circleId, slot, userId }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.CIRCLES_MANAGE);

      if (!['teacher', 'supervisor'].includes(slot)) {
        throw new ApiError('invalidSlot', 'admin.errors.invalidSlot');
      }

      const circle = db.circles.find((item) => item.id === circleId);
      if (!circle) throw new ApiError('notFound', 'state.notFoundHint');

      // المشرف يعيّن داخل حلقاته وحدها؛ الإدارة في كلّها.
      if (role === 'supervisor' && circle.supervisorId !== actorId) {
        throw new ApiError('forbidden', 'state.forbiddenHint');
      }

      if (userId === null || userId === '') {
        // المشرف لا يُخرج نفسه من حلقته فتصير بلا مشرف يتابعها.
        if (slot === 'supervisor' && role === 'supervisor') {
          throw new ApiError('forbidden', 'state.forbiddenHint');
        }
        circle[slot === 'teacher' ? 'teacherId' : 'supervisorId'] = null;
        return shapeCircle(db, circle);
      }

      const user = db.users.find((item) => item.id === userId);
      if (!user || user.role !== slot) {
        throw new ApiError('invalidUser', 'admin.errors.invalidAssignee');
      }
      if (user.status !== 'active') {
        throw new ApiError('suspended', 'admin.errors.assigneeSuspended');
      }

      // معلمٌ واحد لحلقة واحدة: من يُعطى حلقتين لا يقود أيًّا منهما.
      if (slot === 'teacher') {
        const busy = db.circles.find(
          (item) => item.id !== circleId && item.teacherId === userId,
        );
        if (busy) throw new ApiError('teacherBusy', 'admin.errors.teacherHasCircle');
      }

      circle[slot === 'teacher' ? 'teacherId' : 'supervisorId'] = userId;
      return shapeCircle(db, circle);
    }),
  );
}

/** مرشّحو التعيين: النشِطون من الدور المطلوب، والمعلم الموكّل يُوسم بحلقته. */
export async function listAssignable({ role, slot }) {
  return request(() => {
    assertCan(role, ACTIONS.CIRCLES_MANAGE);
    const db = getDb();

    return db.users
      .filter((user) => user.role === slot && (user.status ?? 'active') === 'active')
      .map((user) => {
        const own = db.circles.find((circle) =>
          slot === 'teacher' ? circle.teacherId === user.id : circle.supervisorId === user.id,
        );
        return {
          id: user.id,
          name: user.name,
          city: user.city ?? '',
          circleName: own?.name ?? '',
          // المعلم المرتبط بحلقة لا يُعيَّن لثانية؛ المشرف يشرف على عدّة.
          busy: slot === 'teacher' && Boolean(own),
        };
      })
      .sort((a, b) => Number(a.busy) - Number(b.busy) || a.name.localeCompare(b.name, 'ar'));
  });
}

function shapeCircle(db, circle) {
  return {
    ...circle,
    teacherName: db.users.find((user) => user.id === circle.teacherId)?.name ?? '',
    supervisorName: db.users.find((user) => user.id === circle.supervisorId)?.name ?? '',
  };
}

/* ===============================================================
   الطلاب
   =============================================================== */
export async function addStudent({ role, payload }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.STUDENTS_MANAGE);
      const circle = db.circles.find((item) => item.id === payload.circleId);
      if (!circle) throw new ApiError('notFound', 'state.notFoundHint');

      const name = String(payload.name ?? '').trim();
      if (name.length < 3) throw new ApiError('invalidName', 'auth.errors.nameShort');

      const id = `student-new-${Date.now()}`;
      const student = {
        id,
        userId: `user-${id}`,
        name,
        role: 'student',
        email: `${id}@halaqat.sa`,
        phone: payload.phone ?? '',
        city: circle.city ?? '',
        district: circle.district ?? '',
        circleId: circle.id,
        teacherId: circle.teacherId,
        supervisorId: circle.supervisorId,
        level: circle.level,
        age: Number(payload.age) || 12,
        guardianName: payload.guardianName ?? '',
        guardianPhone: payload.guardianPhone ?? '',
        joinedAt: new Date().toISOString(),
        memorizedPages: 0,
        memorizedJuz: 0,
        targetDaily: 2,
        targetWeekly: 10,
        todayDone: 0,
        streak: 0,
        attendanceRate: 100,
        masteryAvg: 0,
        reviewRate: 0,
        testsAvg: 0,
        lastRecitationAt: new Date().toISOString(),
        status: 'onTrack',
        currentSurah: 1,
        lastReadPage: 1,
        isAssistant: false,
        juzGoal: { targetJuz: 1, durationDays: 90, startedAt: new Date().toISOString(), startJuz: 0 },
      };

      db.students.push(student);
      circle.studentIds.push(student.id);
      db.users.push({
        id: student.userId,
        name: student.name,
        role: 'student',
        email: student.email,
        phone: student.phone,
        city: student.city,
        joinedAt: student.joinedAt,
        status: 'active',
        studentId: student.id,
        circleId: circle.id,
      });

      return { ...student };
    }),
  );
}

export async function removeStudent({ role, studentId }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.STUDENTS_MANAGE);
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      db.students = db.students.filter((item) => item.id !== studentId);
      db.users = db.users.filter((item) => item.studentId !== studentId);
      const circle = db.circles.find((item) => item.id === student.circleId);
      if (circle) circle.studentIds = circle.studentIds.filter((id) => id !== studentId);
      return { id: studentId };
    }),
  );
}

/**
 * تعيين المساعد يعيش في خدمة المساعد (assistantService) لأنه يمسّ التوكيلات أيضًا.
 * يُعاد تصديره هنا فقط حفاظًا على نقطة استدعاء واحدة لواجهات الإدارة.
 */
export { setAssistant } from './assistantService.js';

/* ===============================================================
   طلبات تسجيل الأبناء
   =============================================================== */
export async function createEnrollmentRequest({ role, parentId, parentName, payload }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.ENROLLMENT_CREATE);

      const childName = String(payload.childName ?? '').trim();
      if (childName.length < 3) throw new ApiError('invalidName', 'auth.errors.nameShort');
      if (!payload.city) throw new ApiError('missingCity', 'parent.requests.errors.city');
      if (!payload.district) throw new ApiError('missingDistrict', 'parent.requests.errors.district');
      if (!payload.mosque) throw new ApiError('missingMosque', 'parent.requests.errors.mosque');
      if (!payload.circleId) throw new ApiError('missingCircle', 'parent.requests.errors.circle');

      const circle = db.circles.find((item) => item.id === payload.circleId);

      const enrollmentRequest = {
        id: `req-${Date.now()}`,
        parentId,
        parentName,
        childName,
        age: Number(payload.age) || null,
        city: payload.city,
        district: payload.district,
        mosque: payload.mosque,
        circleId: payload.circleId,
        circleName: circle?.name ?? '',
        note: String(payload.note ?? '').trim(),
        status: 'pending',
        createdAt: new Date().toISOString(),
        decidedBy: null,
        decidedByName: null,
        decidedAt: null,
        rejectionReason: null,
      };

      db.enrollmentRequests.unshift(enrollmentRequest);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'enrollment',
        createdAt: enrollmentRequest.createdAt,
        read: false,
        // لكل دور مساره: توجيه الإدارة إلى مسار المشرف يُعيدها من حيث أتت.
        linkByRole: { supervisor: '/app/supervisor/requests', admin: '/app/admin/requests' },
        roles: ['supervisor', 'admin'],
      });

      return { ...enrollmentRequest };
    }),
  );
}

export async function listEnrollmentRequests({ role, userId, status = 'all' } = {}) {
  return request(() => {
    const db = getDb();
    let requests = db.enrollmentRequests ?? [];

    if (role === 'parent') {
      requests = requests.filter((item) => item.parentId === userId);
    } else {
      assertCan(role, ACTIONS.ENROLLMENT_REVIEW);
      if (role === 'supervisor') {
        const circleIds = new Set(scopedCircles(role, userId).map((circle) => circle.id));
        requests = requests.filter((item) => circleIds.has(item.circleId));
      }
    }

    if (status !== 'all') requests = requests.filter((item) => item.status === status);
    return [...requests].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  });
}

/** قبول الطلب يُنشئ الطالب فعليًا داخل الحلقة ويربطه بولي الأمر. */
export async function decideEnrollmentRequest({ role, actorId, requestId, decision, reason }) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.ENROLLMENT_REVIEW);
      const enrollmentRequest = db.enrollmentRequests.find((item) => item.id === requestId);
      if (!enrollmentRequest) throw new ApiError('notFound', 'state.notFoundHint');
      if (enrollmentRequest.status !== 'pending') {
        throw new ApiError('alreadyDecided', 'parent.requests.errors.alreadyDecided');
      }

      const actor = getUser(actorId);
      enrollmentRequest.status = decision === 'approve' ? 'approved' : 'rejected';
      enrollmentRequest.decidedBy = actorId;
      enrollmentRequest.decidedByName = actor?.name ?? '';
      enrollmentRequest.decidedAt = new Date().toISOString();
      enrollmentRequest.rejectionReason = decision === 'approve' ? null : (reason ?? '');

      if (decision === 'approve') {
        const circle = db.circles.find((item) => item.id === enrollmentRequest.circleId);
        if (!circle) throw new ApiError('notFound', 'state.notFoundHint');

        const id = `student-req-${Date.now()}`;
        const student = {
          id,
          userId: `user-${id}`,
          name: enrollmentRequest.childName,
          role: 'student',
          email: `${id}@halaqat.sa`,
          phone: '',
          city: enrollmentRequest.city,
          district: enrollmentRequest.district,
          circleId: circle.id,
          teacherId: circle.teacherId,
          supervisorId: circle.supervisorId,
          level: circle.level,
          age: enrollmentRequest.age ?? 12,
          guardianName: enrollmentRequest.parentName,
          guardianPhone: getUser(enrollmentRequest.parentId)?.phone ?? '',
          joinedAt: new Date().toISOString(),
          memorizedPages: 0,
          memorizedJuz: 0,
          targetDaily: 2,
          targetWeekly: 10,
          todayDone: 0,
          streak: 0,
          attendanceRate: 100,
          masteryAvg: 0,
          reviewRate: 0,
          testsAvg: 0,
          lastRecitationAt: new Date().toISOString(),
          status: 'onTrack',
          currentSurah: 1,
          lastReadPage: 1,
          isAssistant: false,
          juzGoal: {
            targetJuz: 1,
            durationDays: 90,
            startedAt: new Date().toISOString(),
            startJuz: 0,
          },
        };

        db.students.push(student);
        circle.studentIds.push(student.id);
        db.users.push({
          id: student.userId,
          name: student.name,
          role: 'student',
          email: student.email,
          phone: '',
          city: student.city,
          joinedAt: student.joinedAt,
          status: 'active',
          studentId: student.id,
          circleId: circle.id,
        });

        const parent = db.users.find((item) => item.id === enrollmentRequest.parentId);
        if (parent) {
          parent.childrenIds = [...(parent.childrenIds ?? []), student.id];
        }
        enrollmentRequest.studentId = student.id;
      }

      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'enrollmentDecision',
        createdAt: enrollmentRequest.decidedAt,
        read: false,
        link: '/app/parent/requests',
        roles: ['parent'],
      });

      return { ...enrollmentRequest };
    }),
  );
}

/** الحلقات المتاحة لاختيارها في نموذج الطلب (مع الحي والمسجد). */
export async function listCircleOptions({ city, district } = {}) {
  return request(() => {
    const db = getDb();
    return db.circles
      .filter((circle) => (city ? circle.city === city : true))
      .filter((circle) => (district ? circle.district === district : true))
      .map((circle) => ({
        id: circle.id,
        name: circle.name,
        city: circle.city ?? '',
        district: circle.district ?? '',
        mosque: circle.mosque ?? '',
        teacherName: getUser(circle.teacherId)?.name ?? '',
        studentsCount: db.students.filter((student) => student.circleId === circle.id).length,
      }));
  });
}

export { circleStats, getCircle };
