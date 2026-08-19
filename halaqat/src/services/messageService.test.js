import { beforeEach, describe, expect, it } from 'vitest';
import * as messageService from './messageService.js';
import { getDb, resetDb } from '../mock/db.js';

/** ابنٌ وليُّه ومعلّمه — طرفا المحادثة. */
function scene() {
  const db = getDb();
  const parent = db.users.find((user) => user.role === 'parent');
  const studentId = parent.childrenIds[0];
  const student = db.students.find((item) => item.id === studentId);
  return { db, parent, student, teacherId: student.teacherId };
}

const PARENT_MSG = 'كيف مستوى ابني في المراجعة؟';
const TEACHER_MSG = 'مستواه جيد، ويحتاج تثبيت المدود.';

describe('التواصل بين ولي الأمر والمعلم', () => {
  beforeEach(() => {
    resetDb();
  });

  it('المحادثة تبدأ فارغة ثم يتبادل الطرفان فيها', async () => {
    const { parent, student, teacherId } = scene();

    const empty = await messageService.getThread({
      role: 'parent',
      userId: parent.id,
      studentId: student.id,
    });
    expect(empty.messages).toHaveLength(0);
    expect(empty.counterpart).toBeTruthy();

    await messageService.sendMessage({
      role: 'parent',
      userId: parent.id,
      userName: parent.name,
      studentId: student.id,
      body: PARENT_MSG,
    });
    await messageService.sendMessage({
      role: 'teacher',
      userId: teacherId,
      studentId: student.id,
      body: TEACHER_MSG,
    });

    // ويراها الطرفان بنفس الترتيب، وكلٌّ يميّز رسالته.
    const forParent = await messageService.getThread({
      role: 'parent',
      userId: parent.id,
      studentId: student.id,
    });
    expect(forParent.messages.map((m) => m.body)).toEqual([PARENT_MSG, TEACHER_MSG]);
    expect(forParent.messages.map((m) => m.mine)).toEqual([true, false]);

    const forTeacher = await messageService.getThread({
      role: 'teacher',
      userId: teacherId,
      studentId: student.id,
    });
    expect(forTeacher.messages.map((m) => m.mine)).toEqual([false, true]);
  });

  it('فتح المحادثة يُعلّم رسائل الطرف الآخر مقروءة', async () => {
    const { parent, student, teacherId } = scene();

    await messageService.sendMessage({
      role: 'parent',
      userId: parent.id,
      studentId: student.id,
      body: PARENT_MSG,
    });

    expect(await messageService.countUnread({ role: 'teacher', userId: teacherId })).toBe(1);
    // رسائله هو ليست غير مقروءة عنده.
    expect(await messageService.countUnread({ role: 'parent', userId: parent.id })).toBe(0);

    await messageService.getThread({ role: 'teacher', userId: teacherId, studentId: student.id });
    expect(await messageService.countUnread({ role: 'teacher', userId: teacherId })).toBe(0);
  });

  it('لا يدخلها إلا طرفاها', async () => {
    const { db, parent, student, teacherId } = scene();
    const otherTeacher = db.users.find(
      (user) => user.role === 'teacher' && user.id !== teacherId,
    );
    const otherParent = db.users.find(
      (user) => user.role === 'parent' && user.id !== parent.id,
    );

    const intruders = [
      { role: 'teacher', userId: otherTeacher.id },
      { role: 'supervisor', userId: 'user-supervisor-1' },
      { role: 'admin', userId: 'user-admin' },
      { role: 'student', userId: student.id },
      ...(otherParent ? [{ role: 'parent', userId: otherParent.id }] : []),
    ];

    for (const actor of intruders) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        messageService.getThread({ ...actor, studentId: student.id }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
      // eslint-disable-next-line no-await-in-loop
      await expect(
        messageService.sendMessage({ ...actor, studentId: student.id, body: 'مرحبًا' }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
  });

  it('كل طالب محادثته وحده', async () => {
    const { db, parent, student, teacherId } = scene();
    const sibling = db.students.find(
      (item) => item.teacherId === teacherId && item.id !== student.id,
    );

    await messageService.sendMessage({
      role: 'parent',
      userId: parent.id,
      studentId: student.id,
      body: PARENT_MSG,
    });

    const other = await messageService.getThread({
      role: 'teacher',
      userId: teacherId,
      studentId: sibling.id,
    });
    expect(other.messages).toHaveLength(0);
  });

  it('الرسالة الفارغة تُرفض', async () => {
    const { parent, student } = scene();
    for (const body of ['', '   ', 'ا']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        messageService.sendMessage({
          role: 'parent',
          userId: parent.id,
          studentId: student.id,
          body,
        }),
      ).rejects.toMatchObject({ messageKey: 'messages.errors.empty' });
    }
    expect(getDb().messages).toHaveLength(0);
  });
});
