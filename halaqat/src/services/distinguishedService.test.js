import { beforeEach, describe, expect, it } from 'vitest';
import * as distinguishedService from './distinguishedService.js';
import { getDb, resetDb } from '../mock/db.js';

const { DISTINCTION } = distinguishedService;

/** يضع للطالب نشاطًا معلومًا داخل الشهر الجاري. */
function seedMonth(studentId, { sessions, mastery, presentDays, absentDays = 0 }) {
  const db = getDb();
  const circle = db.students.find((s) => s.id === studentId).circleId;
  const now = new Date();
  const dayInMonth = (offset) =>
    new Date(now.getFullYear(), now.getMonth(), 1 + offset, 12, 0, 0).toISOString();

  db.sessions = db.sessions.filter((s) => s.studentId !== studentId);
  db.attendance = db.attendance.filter((a) => a.studentId !== studentId);

  for (let i = 0; i < sessions; i += 1) {
    db.sessions.push({
      id: `s-${studentId}-${i}`,
      studentId,
      circleId: circle,
      type: 'review',
      mastery,
      createdAt: dayInMonth(i),
    });
  }
  for (let i = 0; i < presentDays; i += 1) {
    db.attendance.push({ id: `a-${studentId}-p${i}`, studentId, circleId: circle, date: dayInMonth(i), status: 'present' });
  }
  for (let i = 0; i < absentDays; i += 1) {
    db.attendance.push({ id: `a-${studentId}-x${i}`, studentId, circleId: circle, date: dayInMonth(i), status: 'absent' });
  }
}

describe('متميزو الشهر', () => {
  beforeEach(() => {
    resetDb();
  });

  it('محجوب عن الطالب وولي الأمر', async () => {
    await expect(
      distinguishedService.listMonthlyDistinguished({ role: 'student', userId: 'x' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    await expect(
      distinguishedService.listMonthlyDistinguished({ role: 'parent', userId: 'x' }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('المعلم يرى حلقته فقط والمشرف يرى حلقاته', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const teacher = db.users.find((u) => u.id === circle.teacherId);
    const supervisor = db.users.find((u) => u.id === circle.supervisorId);

    const asTeacher = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: teacher.id,
    });
    expect(asTeacher.circles).toHaveLength(1);
    expect(asTeacher.circles[0].circleId).toBe(circle.id);

    const asSupervisor = await distinguishedService.listMonthlyDistinguished({
      role: 'supervisor',
      userId: supervisor.id,
    });
    const supervised = db.circles.filter((c) => c.supervisorId === supervisor.id);
    expect(asSupervisor.circles).toHaveLength(supervised.length);
    expect(asSupervisor.circles.length).toBeGreaterThan(0);
  });

  it('التميّز من نشاط الشهر لا من المتوسط العام', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const teacherId = circle.teacherId;
    const members = db.students.filter((s) => s.circleId === circle.id);

    const star = members[0];
    const slacker = members[1];

    // متوسطه العام ضعيف لكن شهره ممتاز ⇒ متميز.
    star.masteryAvg = 60;
    seedMonth(star.id, { sessions: 5, mastery: 95, presentDays: 10 });

    // متوسطه العام ممتاز لكن شهره ضعيف ⇒ ليس متميزًا.
    slacker.masteryAvg = 99;
    seedMonth(slacker.id, { sessions: 4, mastery: 55, presentDays: 10 });

    // بقية الحلقة بلا نشاط هذا الشهر.
    members.slice(2).forEach((s) => seedMonth(s.id, { sessions: 0, mastery: 0, presentDays: 0 }));

    const result = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: teacherId,
    });
    const ids = result.circles[0].students.map((s) => s.id);

    expect(ids).toContain(star.id);
    expect(ids).not.toContain(slacker.id);
  });

  it('لا يتميز من قلّ نشاطه مهما علا إتقانه', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const members = db.students.filter((s) => s.circleId === circle.id);
    members.forEach((s) => seedMonth(s.id, { sessions: 0, mastery: 0, presentDays: 0 }));

    // جلسة واحدة بإتقان كامل — دون الحد الأدنى للجلسات.
    seedMonth(members[0].id, { sessions: 1, mastery: 100, presentDays: 10 });

    const result = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
    });
    expect(result.circles[0].students).toHaveLength(0);
    expect(result.totalDistinguished).toBe(0);
  });

  it('الغياب يُسقط التميّز ولو أتقن', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const members = db.students.filter((s) => s.circleId === circle.id);
    members.forEach((s) => seedMonth(s.id, { sessions: 0, mastery: 0, presentDays: 0 }));

    seedMonth(members[0].id, { sessions: 6, mastery: 98, presentDays: 5, absentDays: 5 });

    const result = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
    });
    expect(result.circles[0].students).toHaveLength(0);
  });

  it('الترتيب بالإتقان أولًا', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const members = db.students.filter((s) => s.circleId === circle.id);
    members.forEach((s) => seedMonth(s.id, { sessions: 0, mastery: 0, presentDays: 0 }));

    seedMonth(members[0].id, { sessions: 5, mastery: 88, presentDays: 10 });
    seedMonth(members[1].id, { sessions: 5, mastery: 97, presentDays: 10 });
    seedMonth(members[2].id, { sessions: 5, mastery: 92, presentDays: 10 });

    const result = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
    });
    const order = result.circles[0].students.map((s) => s.id);
    expect(order).toEqual([members[1].id, members[2].id, members[0].id]);
    expect(result.circles[0].students[0].mastery).toBe(97);
  });

  it('الشهر الماضي مدة مستقلة عن الجاري', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const members = db.students.filter((s) => s.circleId === circle.id);
    members.forEach((s) => seedMonth(s.id, { sessions: 0, mastery: 0, presentDays: 0 }));
    seedMonth(members[0].id, { sessions: 5, mastery: 95, presentDays: 10 });

    const current = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
      month: 'current',
    });
    const previous = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
      month: 'previous',
    });

    expect(current.totalDistinguished).toBe(1);
    expect(previous.totalDistinguished).toBe(0);
    expect(previous.month.key).not.toBe(current.month.key);
  });

  it('المعايير معلنة مع النتيجة لتُعرض في الواجهة', async () => {
    const db = getDb();
    const circle = db.circles[0];
    const result = await distinguishedService.listMonthlyDistinguished({
      role: 'teacher',
      userId: circle.teacherId,
    });
    expect(result.criteria).toEqual(DISTINCTION);
  });

  it('حدود الشهر تُحسب صحيحة عبر رأس السنة', () => {
    const jan = distinguishedService.monthRange('previous', new Date(2026, 0, 15));
    expect(jan.key).toBe('2025-12');
    expect(jan.start.getFullYear()).toBe(2025);
    expect(jan.end.getFullYear()).toBe(2026);
  });
});
