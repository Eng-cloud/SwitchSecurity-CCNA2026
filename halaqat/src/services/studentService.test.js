import { beforeEach, describe, expect, it } from 'vitest';
import * as studentService from './studentService.js';
import { getDb, resetDb } from '../mock/db.js';

describe('خدمة الطالب — خطة اليوم', () => {
  beforeEach(() => {
    resetDb();
  });

  it('تعليم بند لا يُعلّم بقية البنود', async () => {
    const student = getDb().students[0];
    await studentService.completePlanItem(student.id, 'plan-far', { done: true });

    const { plan } = await studentService.getDashboard(student.id);
    const byId = Object.fromEntries(plan.map((item) => [item.id, item.done]));

    expect(byId['plan-far']).toBe(true);
    expect(byId['plan-new']).toBe(false);
    expect(byId['plan-recent']).toBe(false);
  });

  it('الضغطة الخاطئة يتراجع عنها', async () => {
    const student = getDb().students[0];

    const marked = await studentService.completePlanItem(student.id, 'plan-new', { done: true });
    expect(marked.done).toBe(true);

    const undone = await studentService.completePlanItem(student.id, 'plan-new', { done: false });
    expect(undone.done).toBe(false);

    const { plan } = await studentService.getDashboard(student.id);
    expect(plan.find((item) => item.id === 'plan-new').done).toBe(false);
  });

  it('بلا وسيط يبدّل الحالة ذهابًا وإيابًا', async () => {
    const student = getDb().students[0];

    expect((await studentService.completePlanItem(student.id, 'plan-recent')).done).toBe(true);
    expect((await studentService.completePlanItem(student.id, 'plan-recent')).done).toBe(false);
  });

  it('عدّاد اليوم يتبع البنود المنجزة صعودًا وهبوطًا', async () => {
    const student = getDb().students[0];
    await studentService.completePlanItem(student.id, 'plan-new', { done: true });
    const two = await studentService.completePlanItem(student.id, 'plan-recent', { done: true });
    expect(two.todayDone).toBe(2);

    const back = await studentService.completePlanItem(student.id, 'plan-recent', { done: false });
    expect(back.todayDone).toBe(1);
  });

  it('إنجاز الأمس لا يُحسب على اليوم', async () => {
    const student = getDb().students[0];
    student.planProgress = { date: '2020-01-01', doneIds: ['plan-new', 'plan-recent'] };

    const { plan } = await studentService.getDashboard(student.id);
    expect(plan.every((item) => item.done === false)).toBe(true);
  });

  it('بند غير معروف يُرفض', async () => {
    const student = getDb().students[0];
    await expect(
      studentService.completePlanItem(student.id, 'plan-ghost', { done: true }),
    ).rejects.toMatchObject({ messageKey: 'state.notFoundHint' });
  });
});
