import { beforeEach, describe, expect, it } from 'vitest';
import * as taskService from './taskService.js';
import { getDb, resetDb } from '../mock/db.js';

function firstStudent() {
  return getDb().students[0];
}

describe('خدمة المهام', () => {
  beforeEach(() => {
    resetDb();
  });

  it('يوم الطالب يبدأ بمهمتين تلقائيتين وتثبتان', async () => {
    const student = firstStudent();

    const first = await taskService.listToday(student.id);
    expect(first.tasks).toHaveLength(2);
    expect(first.tasks.map((task) => task.type).sort()).toEqual(['memorize', 'review']);
    expect(first.done).toBe(0);

    // الطلب الثاني لا يولّد مهام جديدة.
    const second = await taskService.listToday(student.id);
    expect(second.tasks.map((task) => task.id)).toEqual(first.tasks.map((task) => task.id));
  });

  it('إتمام مهمة يحرّك تقدّم الطالب فعلًا', async () => {
    const student = firstStudent();
    const { tasks } = await taskService.listToday(student.id);
    const memorize = tasks.find((task) => task.type === 'memorize');

    const before = getDb().students.find((item) => item.id === student.id).memorizedPages;
    const result = await taskService.completeTask({
      taskId: memorize.id,
      studentId: student.id,
      mastery: 92,
    });

    expect(result.task.status).toBe('done');
    expect(result.progress.after.memorizedPages).toBe(before + 1);
    expect(result.progress.doneToday).toBe(1);

    // وتُسجَّل جلسة مربوطة بالمهمة.
    const session = getDb().sessions.find((item) => item.taskId === memorize.id);
    expect(session).toBeTruthy();
    expect(session.type).toBe('memorization');
  });

  it('الأخطاء تقود إلى توصية بمراجعتها لا إلى رقم صامت', async () => {
    const student = firstStudent();
    const { tasks } = await taskService.listToday(student.id);

    const result = await taskService.completeTask({
      taskId: tasks[0].id,
      studentId: student.id,
      mastery: 78,
      mistakes: [{ ayah: 6 }, { ayah: 9 }],
    });

    expect(result.recommendation.kind).toBe('reviewMistakes');
    expect(result.recommendation.ayat).toEqual([6, 9]);

    const followUp = await taskService.createReviewFromMistakes({
      studentId: student.id,
      taskId: tasks[0].id,
    });
    expect(followUp.type).toBe('review');
    expect(followUp.fromAyah).toBe(6);
    expect(followUp.toAyah).toBe(9);

    const today = await taskService.listToday(student.id);
    expect(today.tasks.some((task) => task.id === followUp.id)).toBe(true);
  });

  it('بلا أخطاء: التوصية هي المهمة التالية ثم ختام اليوم', async () => {
    const student = firstStudent();
    const { tasks } = await taskService.listToday(student.id);

    const first = await taskService.completeTask({
      taskId: tasks[0].id,
      studentId: student.id,
      mastery: 96,
    });
    expect(first.recommendation.kind).toBe('nextTask');
    expect(first.recommendation.taskId).toBe(tasks[1].id);

    const second = await taskService.completeTask({
      taskId: tasks[1].id,
      studentId: student.id,
      mastery: 95,
    });
    expect(second.recommendation.kind).toBe('dayComplete');

    const today = await taskService.listToday(student.id);
    expect(today.allDone).toBe(true);
  });

  it('لا تُنجز المهمة مرتين ولا ينجزها غير صاحبها', async () => {
    const db = getDb();
    const student = db.students[0];
    const other = db.students[1];
    const { tasks } = await taskService.listToday(student.id);

    await taskService.completeTask({ taskId: tasks[0].id, studentId: student.id, mastery: 90 });

    await expect(
      taskService.completeTask({ taskId: tasks[0].id, studentId: student.id, mastery: 90 }),
    ).rejects.toMatchObject({ messageKey: 'tasks.errors.alreadyDone' });

    await expect(
      taskService.completeTask({ taskId: tasks[1].id, studentId: other.id, mastery: 90 }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  /* ---------------------------------------------------------------
     تعيين المعلم
     --------------------------------------------------------------- */

  it('المعلم يعيّن مهمة فتظهر عند الطالب موسومة بمصدرها', async () => {
    const student = firstStudent();

    const assigned = await taskService.assignTask({
      role: 'teacher',
      teacherId: student.teacherId,
      teacherName: 'إبراهيم',
      studentId: student.id,
      type: 'review',
      surahNumber: 1,
      fromAyah: 1,
      toAyah: 5,
      note: 'انتبه للمدود',
    });

    expect(assigned.source).toBe('teacher');
    expect(assigned.assignedByName).toBe('إبراهيم');

    const today = await taskService.listToday(student.id);
    const found = today.tasks.find((task) => task.id === assigned.id);
    expect(found).toBeTruthy();
    // المعيَّن من المعلم يتصدّر القائمة.
    expect(today.tasks[0].id).toBe(assigned.id);
  });

  it('المعلم لا يعيّن لطالب خارج حلقته، وغيره لا يعيّن أصلًا', async () => {
    const db = getDb();
    const student = db.students[0];
    const stranger = db.students.find((item) => item.teacherId !== student.teacherId);

    await expect(
      taskService.assignTask({
        role: 'teacher',
        teacherId: student.teacherId,
        studentId: stranger.id,
        type: 'review',
        surahNumber: 1,
        fromAyah: 1,
        toAyah: 3,
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.outsideCircle' });

    for (const role of ['student', 'supervisor', 'admin', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        taskService.assignTask({
          role,
          teacherId: student.teacherId,
          studentId: student.id,
          type: 'review',
          surahNumber: 1,
          fromAyah: 1,
          toAyah: 3,
        }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
  });

  it('نطاق آيات غير صحيح يُرفض', async () => {
    const student = firstStudent();
    const base = {
      role: 'teacher',
      teacherId: student.teacherId,
      studentId: student.id,
      type: 'memorize',
      surahNumber: 1,
    };

    for (const range of [
      { fromAyah: 0, toAyah: 3 },
      { fromAyah: 5, toAyah: 2 },
      { fromAyah: 1, toAyah: 99 },
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(taskService.assignTask({ ...base, ...range })).rejects.toMatchObject({
        messageKey: 'tasks.errors.invalidRange',
      });
    }
  });
});
