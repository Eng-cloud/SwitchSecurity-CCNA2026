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

describe('التسميع بابان: حفظٌ جديد ومراجعة', () => {
  beforeEach(() => {
    resetDb();
  });

  const RANGE = { surahNumber: 1, fromAyah: 1, toAyah: 5, mastery: 90, durationSeconds: 60 };

  it('الحفظ الجديد يزيد الرصيد، والمراجعة تتعاهده ولا تزيده', async () => {
    const student = getDb().students[0];
    const before = student.memorizedPages;

    await studentService.saveRecitationSession(student.id, { ...RANGE, type: 'memorization' });
    const afterMemorize = getDb().students.find((item) => item.id === student.id).memorizedPages;
    expect(afterMemorize).toBe(before + 1);

    await studentService.saveRecitationSession(student.id, { ...RANGE, type: 'review' });
    expect(getDb().students.find((item) => item.id === student.id).memorizedPages).toBe(
      afterMemorize,
    );
  });

  it('النوع يُسجَّل كما جاء، لا «مراجعة» دائمًا', async () => {
    const student = getDb().students[0];

    const memorize = await studentService.saveRecitationSession(student.id, {
      ...RANGE,
      type: 'memorization',
    });
    expect(memorize.type).toBe('memorization');

    const review = await studentService.saveRecitationSession(student.id, {
      ...RANGE,
      type: 'review',
    });
    expect(review.type).toBe('review');

    // ويظهران مفترقين في سجل الطالب.
    const onlyMemorization = await studentService.getSessions(student.id, {
      type: 'memorization',
    });
    expect(onlyMemorization.every((session) => session.type === 'memorization')).toBe(true);
    expect(onlyMemorization.some((session) => session.id === memorize.id)).toBe(true);
    expect(onlyMemorization.some((session) => session.id === review.id)).toBe(false);
  });

  it('نوع مجهول يُرفض', async () => {
    const student = getDb().students[0];
    await expect(
      studentService.saveRecitationSession(student.id, { ...RANGE, type: 'test' }),
    ).rejects.toMatchObject({ messageKey: 'recitation.errors.invalidType' });
  });
});
