import { beforeEach, describe, expect, it } from 'vitest';
import * as managementService from './managementService.js';
import { getDb, resetDb } from '../mock/db.js';

describe('خدمة الإدارة والإشراف', () => {
  beforeEach(() => {
    resetDb();
  });

  it('ترفض الإجراء لمن لا يملك الصلاحية', async () => {
    await expect(
      managementService.listSupervisors({ role: 'teacher' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await expect(
      managementService.createCircle({ role: 'student', actorId: 'x', payload: { name: 'حلقة' } }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('تمنع حذف معلم بحلقة عامرة بالطلاب', async () => {
    const teacher = getDb().users.find((user) => user.role === 'teacher');
    await expect(
      managementService.deleteUser({ role: 'admin', userId: teacher.id }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.circleNotEmpty' });
  });

  it('تضيف معلمًا وتنشئ حلقته', async () => {
    const created = await managementService.createUser({
      role: 'admin',
      actorId: 'user-admin',
      payload: { role: 'teacher', name: 'معلم جديد', circleName: 'حلقة جديدة', city: 'الرياض' },
    });

    expect(created.role).toBe('teacher');
    const circle = getDb().circles.find((item) => item.teacherId === created.id);
    expect(circle?.name).toBe('حلقة جديدة');
  });

  it('تغيّر الدور بين الإدارة والمشرف والمعلم فقط', async () => {
    const supervisor = getDb().users.find((user) => user.role === 'supervisor');
    const updated = await managementService.changeUserRole({
      role: 'admin',
      userId: supervisor.id,
      nextRole: 'admin',
    });
    expect(updated.role).toBe('admin');

    const student = getDb().users.find((user) => user.role === 'student');
    await expect(
      managementService.changeUserRole({ role: 'admin', userId: student.id, nextRole: 'teacher' }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.roleChangeUnsupported' });
  });

  it('قبول طلب التسجيل يُنشئ الطالب ويربطه بولي أمره', async () => {
    const pending = getDb().enrollmentRequests[0];
    const parentBefore = getDb().users.find((user) => user.id === pending.parentId);
    const childrenBefore = parentBefore.childrenIds.length;

    const decided = await managementService.decideEnrollmentRequest({
      role: 'supervisor',
      actorId: 'user-supervisor-1',
      requestId: pending.id,
      decision: 'approve',
    });

    expect(decided.status).toBe('approved');

    const db = getDb();
    const student = db.students.find((item) => item.name === pending.childName);
    expect(student).toBeTruthy();
    expect(student.circleId).toBe(pending.circleId);

    const parentAfter = db.users.find((user) => user.id === pending.parentId);
    expect(parentAfter.childrenIds.length).toBe(childrenBefore + 1);
  });

  it('لا تُراجع الطلب مرتين', async () => {
    const pending = getDb().enrollmentRequests[0];
    await managementService.decideEnrollmentRequest({
      role: 'admin',
      actorId: 'user-admin',
      requestId: pending.id,
      decision: 'reject',
      reason: 'الحلقة مكتملة',
    });

    await expect(
      managementService.decideEnrollmentRequest({
        role: 'admin',
        actorId: 'user-admin',
        requestId: pending.id,
        decision: 'approve',
      }),
    ).rejects.toMatchObject({ messageKey: 'parent.requests.errors.alreadyDecided' });
  });

  it('تشترط الجدارة لتعيين المساعد', async () => {
    const db = getDb();
    // دون الحدّين: متوسط عام ضعيف ولا نشاط هذا الشهر يؤهله.
    const weak = db.students.find((student) => !student.isAssistant);
    weak.masteryAvg = 60;
    db.sessions = db.sessions.filter((item) => item.studentId !== weak.id);
    db.attendance = db.attendance.filter((item) => item.studentId !== weak.id);

    await expect(
      managementService.setAssistant({ role: 'teacher', studentId: weak.id, isAssistant: true }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.notEligible' });

    const strong = getDb().students.find((student) => student.masteryAvg >= 85);
    const result = await managementService.setAssistant({
      role: 'teacher',
      studentId: strong.id,
      isAssistant: true,
    });
    expect(result.isAssistant).toBe(true);
  });

  /* ---------------------------------------------------------------
     إيقاف المستخدمين — الصلاحية بحسب المستهدَف
     --------------------------------------------------------------- */

  it('المشرف يوقف معلمًا ويعيد تفعيله', async () => {
    const teacher = getDb().users.find((user) => user.role === 'teacher');

    const suspended = await managementService.setUserStatus({
      role: 'supervisor',
      userId: teacher.id,
      status: 'suspended',
    });
    expect(suspended.status).toBe('suspended');

    const active = await managementService.setUserStatus({
      role: 'supervisor',
      userId: teacher.id,
      status: 'active',
    });
    expect(active.status).toBe('active');
  });

  it('المشرف لا يوقف مشرفًا ولا إداريًا', async () => {
    const db = getDb();
    const supervisor = db.users.find((user) => user.role === 'supervisor');
    const admin = db.users.find((user) => user.role === 'admin');

    await expect(
      managementService.setUserStatus({ role: 'supervisor', userId: supervisor.id, status: 'suspended' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await expect(
      managementService.setUserStatus({ role: 'supervisor', userId: admin.id, status: 'suspended' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('المعلم لا يوقف أحدًا', async () => {
    const teacher = getDb().users.find((user) => user.role === 'teacher');
    await expect(
      managementService.setUserStatus({ role: 'teacher', userId: teacher.id, status: 'suspended' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('حالة غير معروفة تُرفض', async () => {
    const teacher = getDb().users.find((user) => user.role === 'teacher');
    await expect(
      managementService.setUserStatus({ role: 'admin', userId: teacher.id, status: 'deleted' }),
    ).rejects.toMatchObject({ code: 'invalidStatus' });
  });

  /* ---------------------------------------------------------------
     طلبات التسجيل تصل للمشرف والإدارة ويقرّرانها
     --------------------------------------------------------------- */

  it('المشرف يرى طلبات حلقاته والإدارة ترى الكل', async () => {
    const forSupervisor = await managementService.listEnrollmentRequests({
      role: 'supervisor',
      userId: getDb().circles[0].supervisorId,
      status: 'pending',
    });
    const forAdmin = await managementService.listEnrollmentRequests({
      role: 'admin',
      userId: 'user-admin',
      status: 'pending',
    });

    expect(forSupervisor.length).toBeGreaterThan(0);
    expect(forAdmin.length).toBeGreaterThanOrEqual(forSupervisor.length);
  });

  it('إشعار الطلب يوجّه كل دور إلى مساره', async () => {
    const db = getDb();
    const notification = db.notifications.find((item) => item.linkByRole);
    // الطلب المبذور لا يحمل إشعارًا؛ ننشئ طلبًا جديدًا ليُولّد إشعاره.
    const parent = db.users.find((user) => user.role === 'parent');
    await managementService.createEnrollmentRequest({
      role: 'parent',
      parentId: parent.id,
      parentName: parent.name,
      payload: {
        childName: 'ابن جديد',
        city: db.circles[0].city,
        district: db.circles[0].district,
        mosque: db.circles[0].mosque,
        circleId: db.circles[0].id,
      },
    });

    const created = getDb().notifications.find((item) => item.typeKey === 'enrollment');
    expect(created.linkByRole.supervisor).toBe('/app/supervisor/requests');
    expect(created.linkByRole.admin).toBe('/app/admin/requests');
    expect(notification ?? created).toBeTruthy();
  });
});

describe('الإداريون: مستويان لا مستوى واحد', () => {
  beforeEach(() => {
    resetDb();
  });

  const SUPER = 'user-admin';

  const NEW_ADMIN = { role: 'admin', name: 'نورة السالم', email: 'n@halaqat.sa' };

  function limitedAdmin() {
    const db = getDb();
    const admin = {
      id: 'user-admin-limited',
      name: 'إداري محدود',
      role: 'admin',
      email: 'limited@halaqat.sa',
      status: 'active',
      adminLevel: 'limited',
      joinedAt: new Date().toISOString(),
    };
    db.users.push(admin);
    return admin;
  }

  it('الإدارة العليا تُنشئ إداريًّا بمستوى صريح', async () => {
    const created = await managementService.createUser({
      role: 'admin',
      actorId: SUPER,
      payload: { ...NEW_ADMIN, adminLevel: 'limited' },
    });
    expect(created.adminLevel).toBe('limited');

    const senior = await managementService.createUser({
      role: 'admin',
      actorId: SUPER,
      payload: { ...NEW_ADMIN, email: 's@halaqat.sa', adminLevel: 'super' },
    });
    expect(senior.adminLevel).toBe('super');

    await expect(
      managementService.createUser({
        role: 'admin',
        actorId: SUPER,
        payload: { ...NEW_ADMIN, adminLevel: 'owner' },
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.invalidAdminLevel' });
  });

  it('الإداري المحدود لا يُنشئ إداريًّا ولا يحذفه', async () => {
    const limited = limitedAdmin();

    // لو ملك المحدودُ إنشاءَ إداريٍّ لَملك تجاوزَ حدّه بخطوة واحدة.
    await expect(
      managementService.createUser({
        role: 'admin',
        actorId: limited.id,
        payload: { ...NEW_ADMIN, adminLevel: 'super' },
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.superOnly' });

    await expect(
      managementService.deleteUser({ role: 'admin', userId: SUPER, actorId: limited.id }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.superOnly' });
  });

  it('لا يُحذف آخر حساب إدارة عليا ولا يحذف الإداري نفسه', async () => {
    await expect(
      managementService.deleteUser({ role: 'admin', userId: SUPER, actorId: SUPER }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.deleteSelf' });

    const limited = limitedAdmin();
    await expect(
      managementService.deleteUser({ role: 'admin', userId: SUPER, actorId: limited.id }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.superOnly' });

    // ومع وجود عليا ثانية يصير الحذف ممكنًا.
    const second = await managementService.createUser({
      role: 'admin',
      actorId: SUPER,
      payload: { ...NEW_ADMIN, adminLevel: 'super' },
    });
    await expect(
      managementService.deleteUser({ role: 'admin', userId: second.id, actorId: SUPER }),
    ).resolves.toMatchObject({ id: second.id });
  });
});

describe('تعيين معلّم الحلقة ومشرفها', () => {
  beforeEach(() => {
    resetDb();
  });

  function freeTeacher() {
    const db = getDb();
    const teacher = {
      id: 'user-teacher-free',
      name: 'معلم بلا حلقة',
      role: 'teacher',
      status: 'active',
      email: 'free@halaqat.sa',
    };
    db.users.push(teacher);
    return teacher;
  }

  it('الإدارة تُسنِد معلمًا شاغرًا وتُلغي الإسناد', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const teacher = freeTeacher();

    const assigned = await managementService.assignCircleRole({
      role: 'admin',
      actorId: 'user-admin',
      circleId: circle.id,
      slot: 'teacher',
      userId: teacher.id,
    });
    expect(assigned.teacherId).toBe(teacher.id);
    expect(assigned.teacherName).toBe('معلم بلا حلقة');

    // خانةٌ فارغة حالةٌ مشروعة لا خطأ.
    const cleared = await managementService.assignCircleRole({
      role: 'admin',
      actorId: 'user-admin',
      circleId: circle.id,
      slot: 'teacher',
      userId: null,
    });
    expect(cleared.teacherId).toBeNull();
  });

  it('معلمٌ واحد لحلقة واحدة', async () => {
    const db = getDb();
    const [first, second] = db.circles;

    await expect(
      managementService.assignCircleRole({
        role: 'admin',
        actorId: 'user-admin',
        circleId: second.id,
        slot: 'teacher',
        userId: first.teacherId,
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.teacherHasCircle' });
  });

  it('لا يُسنَد موقوف، ولا من هو من دورٍ آخر', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const suspended = freeTeacher();
    suspended.status = 'suspended';

    await expect(
      managementService.assignCircleRole({
        role: 'admin',
        actorId: 'user-admin',
        circleId: circle.id,
        slot: 'teacher',
        userId: suspended.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.assigneeSuspended' });

    await expect(
      managementService.assignCircleRole({
        role: 'admin',
        actorId: 'user-admin',
        circleId: circle.id,
        slot: 'teacher',
        userId: circle.supervisorId,
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.invalidAssignee' });
  });

  it('المشرف يعيّن داخل حلقاته وحدها ولا يُخرج نفسه منها', async () => {
    const db = getDb();
    const mine = db.circles.find((circle) => circle.supervisorId === 'user-supervisor-1');
    const notMine = db.circles.find((circle) => circle.supervisorId !== 'user-supervisor-1');
    const teacher = freeTeacher();

    await expect(
      managementService.assignCircleRole({
        role: 'supervisor',
        actorId: 'user-supervisor-1',
        circleId: mine.id,
        slot: 'teacher',
        userId: teacher.id,
      }),
    ).resolves.toMatchObject({ teacherId: teacher.id });

    await expect(
      managementService.assignCircleRole({
        role: 'supervisor',
        actorId: 'user-supervisor-1',
        circleId: notMine.id,
        slot: 'teacher',
        userId: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    // حلقةٌ بلا مشرف لا يُتابعها أحد، فلا يُفرغ المشرف خانته بنفسه.
    await expect(
      managementService.assignCircleRole({
        role: 'supervisor',
        actorId: 'user-supervisor-1',
        circleId: mine.id,
        slot: 'supervisor',
        userId: null,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('المرشّحون: المعلم المرتبط بحلقة يُوسم بها', async () => {
    const teacher = freeTeacher();

    const candidates = await managementService.listAssignable({
      role: 'admin',
      slot: 'teacher',
    });
    const free = candidates.find((item) => item.id === teacher.id);
    expect(free.busy).toBe(false);
    expect(candidates.some((item) => item.busy && item.circleName)).toBe(true);

    // والمشرف يشرف على عدّة حلقات فلا يُوسم مرتبطًا.
    const supervisors = await managementService.listAssignable({
      role: 'admin',
      slot: 'supervisor',
    });
    expect(supervisors.every((item) => item.busy === false)).toBe(true);
  });

  it('من لا يملك إدارة الحلقات لا يعيّن', async () => {
    const circle = getDb().circles[0];
    for (const role of ['teacher', 'student', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        managementService.assignCircleRole({
          role,
          actorId: 'x',
          circleId: circle.id,
          slot: 'teacher',
          userId: null,
        }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
  });
});

describe('موعد الحلقة — أيامٌ ووقتٌ صريح', () => {
  beforeEach(() => {
    resetDb();
  });

  it('الحلقة تُنشأ بموعدها، وتُقرأ أوقاتها من البيانات لا من وصفٍ نصّي', async () => {
    const circle = await managementService.createCircle({
      role: 'admin',
      actorId: 'user-admin',
      payload: {
        name: 'حلقة الفجر',
        days: 'السبت – الأربعاء',
        startTime: '05:15',
        endTime: '06:30',
      },
    });

    expect(circle.days).toBe('السبت – الأربعاء');
    expect(circle.startTime).toBe('05:15');
    expect(circle.endTime).toBe('06:30');
  });

  it('موعدٌ ينتهي قبل أن يبدأ يُرفض، وكذلك الوقت غير الصحيح', async () => {
    const base = { role: 'admin', actorId: 'user-admin' };

    await expect(
      managementService.createCircle({
        ...base,
        payload: { name: 'حلقة مقلوبة', startTime: '20:00', endTime: '18:00' },
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.timeOrder' });

    // ونفس الوقت للطرفين ليس مدّة.
    await expect(
      managementService.createCircle({
        ...base,
        payload: { name: 'حلقة بلا مدة', startTime: '18:00', endTime: '18:00' },
      }),
    ).rejects.toMatchObject({ messageKey: 'admin.errors.timeOrder' });

    for (const bad of ['25:00', '7:5', 'المغرب', '18:60']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        managementService.createCircle({
          ...base,
          payload: { name: 'حلقة بوقت خاطئ', startTime: bad, endTime: '20:00' },
        }),
      ).rejects.toMatchObject({ messageKey: 'admin.errors.invalidTime' });
    }
  });

  it('الموعد يُعدَّل على حلقة قائمة', async () => {
    const circle = getDb().circles[0];

    const updated = await managementService.updateCircleSchedule({
      role: 'admin',
      actorId: 'user-admin',
      circleId: circle.id,
      days: 'السبت – الخميس',
      startTime: '17:00',
      endTime: '18:45',
    });

    expect(updated.days).toBe('السبت – الخميس');
    expect(updated.startTime).toBe('17:00');
    expect(getDb().circles[0].endTime).toBe('18:45');
  });

  it('المشرف يعدّل موعد حلقاته وحدها، ومن لا يملك الحلقات لا يعدّل', async () => {
    const db = getDb();
    const mine = db.circles.find((circle) => circle.supervisorId === 'user-supervisor-1');
    const notMine = db.circles.find((circle) => circle.supervisorId !== 'user-supervisor-1');
    const payload = { days: 'السبت – الأربعاء', startTime: '16:00', endTime: '17:30' };

    await expect(
      managementService.updateCircleSchedule({
        role: 'supervisor',
        actorId: 'user-supervisor-1',
        circleId: mine.id,
        ...payload,
      }),
    ).resolves.toMatchObject({ startTime: '16:00' });

    await expect(
      managementService.updateCircleSchedule({
        role: 'supervisor',
        actorId: 'user-supervisor-1',
        circleId: notMine.id,
        ...payload,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    for (const role of ['teacher', 'student', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        managementService.updateCircleSchedule({
          role,
          actorId: 'x',
          circleId: mine.id,
          ...payload,
        }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
  });

  it('كل حلقة مبذورة لها موعد كامل', () => {
    for (const circle of getDb().circles) {
      expect(circle.days).toBeTruthy();
      expect(circle.startTime).toMatch(/^([01]\d|2[0-3]):[0-5]\d$/);
      expect(circle.endTime > circle.startTime).toBe(true);
    }
  });
});
