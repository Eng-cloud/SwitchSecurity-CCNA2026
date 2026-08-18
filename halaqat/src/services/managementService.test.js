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

  it('تشترط الإتقان لتعيين المساعد', async () => {
    const weak = getDb().students.find((student) => student.masteryAvg < 85);
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
});
