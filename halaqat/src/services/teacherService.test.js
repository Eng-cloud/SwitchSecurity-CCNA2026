import { beforeEach, describe, expect, it } from 'vitest';
import * as teacherService from './teacherService.js';
import { getDb, resetDb } from '../mock/db.js';
import { toISODate } from '../lib/format.js';

function today() {
  return toISODate(new Date());
}

function attendanceRow(studentId) {
  return getDb().attendance.find((row) => row.studentId === studentId && row.date === today());
}

async function rowFor(student) {
  const page = await teacherService.getCircleStudents(student.circleId, { perPage: 100 });
  return page.items.find((item) => item.id === student.id);
}

function freshStudent() {
  const db = getDb();
  const student = db.students[0];
  // نبدأ من يومٍ لم يُلمس: هكذا نميّز «لم يُسجَّل» عن «غائب».
  db.attendance = db.attendance.filter(
    (row) => !(row.studentId === student.id && row.date === today()),
  );
  return student;
}

describe('حضور اليوم — ضبط لا تسجيل باتجاه واحد', () => {
  beforeEach(() => {
    resetDb();
  });

  it('اليوم قبل أن يُلمس ليس غيابًا بل «لم يُسجَّل»', async () => {
    const student = freshStudent();

    expect(attendanceRow(student.id)).toBeUndefined();
    expect((await rowFor(student)).attendanceToday).toBe('notRecorded');
  });

  it('المعلم يصحّح حضورًا سجّله بالخطأ إلى أي حالة أخرى', async () => {
    const student = freshStudent();

    await teacherService.setAttendance(student.id, 'present');
    expect((await rowFor(student)).attendanceToday).toBe('present');

    for (const status of ['absent', 'late', 'excused', 'present']) {
      // eslint-disable-next-line no-await-in-loop
      const result = await teacherService.setAttendance(student.id, status);
      expect(result.status).toBe(status);
      // eslint-disable-next-line no-await-in-loop
      expect((await rowFor(student)).attendanceToday).toBe(status);
    }

    // ولا يتضاعف السجل مهما تكرّر الضبط.
    const rows = getDb().attendance.filter(
      (row) => row.studentId === student.id && row.date === today(),
    );
    expect(rows).toHaveLength(1);
  });

  it('إلغاء التسجيل يمحو السجل فيعود اليوم كما كان', async () => {
    const student = freshStudent();

    await teacherService.setAttendance(student.id, 'present');
    expect(attendanceRow(student.id)).toBeTruthy();

    const result = await teacherService.setAttendance(student.id, 'notRecorded');
    expect(result.cleared).toBe(true);
    expect(attendanceRow(student.id)).toBeUndefined();
    expect((await rowFor(student)).attendanceToday).toBe('notRecorded');

    // الإلغاء على يومٍ غير مسجَّل أصلًا لا يعطب.
    await expect(teacherService.setAttendance(student.id, null)).resolves.toMatchObject({
      status: 'notRecorded',
    });
  });

  it('الإلغاء لا يمسّ أيام الطالب الأخرى ولا بقية الطلاب', async () => {
    const db = getDb();
    const student = freshStudent();
    const other = db.students.find((item) => item.id !== student.id);

    db.attendance.push({
      id: 'att-old',
      studentId: student.id,
      circleId: student.circleId,
      date: '2026-01-05',
      status: 'present',
    });
    await teacherService.setAttendance(other.id, 'present');
    await teacherService.setAttendance(student.id, 'present');

    await teacherService.setAttendance(student.id, 'notRecorded');

    expect(getDb().attendance.find((row) => row.id === 'att-old')).toBeTruthy();
    expect(attendanceRow(other.id)?.status).toBe('present');
  });

  it('حالة غير معروفة تُرفض بدل أن تُكتب في البيانات', async () => {
    const student = freshStudent();

    await expect(teacherService.setAttendance(student.id, 'here')).rejects.toMatchObject({
      messageKey: 'teacher.attendanceInvalid',
    });
    expect(attendanceRow(student.id)).toBeUndefined();
  });

  it('طالب غير موجود يُرفض', async () => {
    await expect(teacherService.setAttendance('student-nope', 'present')).rejects.toMatchObject({
      messageKey: 'state.notFoundHint',
    });
  });
});
