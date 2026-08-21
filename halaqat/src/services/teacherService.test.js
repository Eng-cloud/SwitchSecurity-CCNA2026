import { beforeEach, describe, expect, it } from 'vitest';
import * as teacherService from './teacherService.js';
import { getDb, resetDb } from '../mock/db.js';
import { toISODate } from '../lib/format.js';

/** المعلم صاحب الحلقة — الفاعل الافتراضي في هذه الاختبارات. */
function asTeacher(student) {
  return { role: 'teacher', userId: student.teacherId };
}

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

describe('حضور اليوم — ثلاث حالات تُضبط في الاتجاهين', () => {
  beforeEach(() => {
    resetDb();
  });

  it('من لم يُسجَّل حضوره يُقرأ غائبًا', async () => {
    const student = freshStudent();

    expect(attendanceRow(student.id)).toBeUndefined();
    expect((await rowFor(student)).attendanceToday).toBe('absent');
  });

  it('المعلم يصحّح حضورًا سجّله بالخطأ، ويعود منه إلى الغياب', async () => {
    const student = freshStudent();

    for (const status of ['present', 'excused', 'absent', 'present']) {
      // eslint-disable-next-line no-await-in-loop
      const result = await teacherService.setAttendance({
        studentId: student.id,
        status,
        ...asTeacher(student),
      });
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

  it('الضبط لا يمسّ أيام الطالب الأخرى ولا بقية الطلاب', async () => {
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
    await teacherService.setAttendance({
      studentId: other.id,
      status: 'present',
      role: 'teacher',
      userId: other.teacherId,
    });

    await teacherService.setAttendance({
      studentId: student.id,
      status: 'absent',
      ...asTeacher(student),
    });

    expect(getDb().attendance.find((row) => row.id === 'att-old')?.status).toBe('present');
    expect(attendanceRow(other.id)?.status).toBe('present');
  });

  it('الحالات المحذوفة لم تعد تُقبل، ولا أيّ حالة مجهولة', async () => {
    const student = freshStudent();

    for (const status of ['late', 'notRecorded', 'here', null]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        teacherService.setAttendance({ studentId: student.id, status, ...asTeacher(student) }),
      ).rejects.toMatchObject({ messageKey: 'teacher.attendanceInvalid' });
    }
    expect(attendanceRow(student.id)).toBeUndefined();
  });

  it('لا يسجّل الحضورَ من لا سلطة له على الحلقة', async () => {
    const db = getDb();
    const student = freshStudent();
    const stranger = db.users.find(
      (user) => user.role === 'teacher' && user.id !== student.teacherId,
    );

    for (const actor of [
      { role: 'teacher', userId: stranger.id },
      { role: 'student', userId: student.id },
      { role: 'parent', userId: 'user-parent-1' },
    ]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        teacherService.setAttendance({ studentId: student.id, status: 'present', ...actor }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
    expect(attendanceRow(student.id)).toBeUndefined();
  });

  it('مشرف الحلقة يسجّل حضور طلابها', async () => {
    const db = getDb();
    const student = freshStudent();
    const circle = db.circles.find((item) => item.id === student.circleId);

    await teacherService.setAttendance({
      studentId: student.id,
      status: 'excused',
      role: 'supervisor',
      userId: circle.supervisorId,
    });
    expect(attendanceRow(student.id)?.status).toBe('excused');

    // ومشرف حلقةٍ أخرى لا يملك ذلك.
    const otherSupervisor = db.users.find(
      (user) => user.role === 'supervisor' && user.id !== circle.supervisorId,
    );
    await expect(
      teacherService.setAttendance({
        studentId: student.id,
        status: 'absent',
        role: 'supervisor',
        userId: otherSupervisor.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('طالب غير موجود يُرفض', async () => {
    await expect(
      teacherService.setAttendance({
        studentId: 'student-nope',
        status: 'present',
        role: 'teacher',
        userId: 'user-teacher-1',
      }),
    ).rejects.toMatchObject({ messageKey: 'state.notFoundHint' });
  });
});
