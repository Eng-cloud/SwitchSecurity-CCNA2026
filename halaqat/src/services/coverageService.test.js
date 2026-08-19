import { beforeEach, describe, expect, it } from 'vitest';
import * as coverageService from './coverageService.js';
import * as teacherService from './teacherService.js';
import { getDb, resetDb } from '../mock/db.js';

function scene() {
  const db = getDb();
  const circle = db.circles[0];
  const teacher = db.users.find((user) => user.id === circle.teacherId);
  const supervisor = db.users.find((user) => user.id === circle.supervisorId);
  const other = db.users.find(
    (user) => user.role === 'teacher' && user.status === 'active' && user.id !== teacher.id,
  );
  return { db, circle, teacher, supervisor, other };
}

/** يغيّب معلم الحلقة — نقطة البداية لكل ما يخصّ الإنابة. */
async function markAway({ circle, teacher }, status = 'absent') {
  return coverageService.setTeacherAttendance({
    role: 'teacher',
    userId: teacher.id,
    circleId: circle.id,
    status,
  });
}

describe('حضور المعلم', () => {
  beforeEach(() => {
    resetDb();
  });

  it('اليوم يبدأ بلا تغطية حتى يُثبتها المعلم بحضوره', async () => {
    const world = scene();

    // الأصل أن تُثبَت التغطية لا أن تُفترض: قبل التسجيل الحلقة بلا معلّم.
    const before = await coverageService.getCircleDay({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
    });
    expect(before.teacherStatus).toBe('absent');
    expect(before.state).toBe('needsCover');

    const after = await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      status: 'present',
    });
    expect(after.teacherStatus).toBe('present');
    expect(after.state).toBe('onSite');
    expect(after.needsSupervisor).toBe(false);
  });

  it('غياب المعلم يترك الحلقة بلا تغطية', async () => {
    const world = scene();
    const day = await markAway(world);

    expect(day.state).toBe('needsCover');
    expect(day.needsSupervisor).toBe(true);
  });

  it('المشرف يسجّل حضور معلّمه، والغريب لا يفعل', async () => {
    const world = scene();

    const day = await coverageService.setTeacherAttendance({
      role: 'supervisor',
      userId: world.supervisor.id,
      userName: world.supervisor.name,
      circleId: world.circle.id,
      status: 'excused',
      note: 'إذن مسبق',
    });
    expect(day.teacherStatus).toBe('excused');
    expect(day.recordedByRole).toBe('supervisor');
    expect(day.note).toBe('إذن مسبق');

    await expect(
      coverageService.setTeacherAttendance({
        role: 'teacher',
        userId: world.other.id,
        circleId: world.circle.id,
        status: 'present',
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('حالة غير معروفة تُرفض', async () => {
    const world = scene();
    await expect(
      coverageService.setTeacherAttendance({
        role: 'teacher',
        userId: world.teacher.id,
        circleId: world.circle.id,
        status: 'maybe',
      }),
    ).rejects.toMatchObject({ messageKey: 'coverage.errors.invalidStatus' });
  });
});

describe('الإنابة — السلسلة كاملة', () => {
  beforeEach(() => {
    resetDb();
  });

  it('لا تُطلب إنابة لحلقة معلّمها حاضر', async () => {
    const world = scene();
    await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      status: 'present',
    });

    await expect(
      coverageService.requestDeputy({
        role: 'teacher',
        userId: world.teacher.id,
        circleId: world.circle.id,
        deputyId: world.other.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'coverage.errors.notNeeded' });
  });

  it('غياب ← طلب ← قبول: الحلقة يقودها نائب', async () => {
    const world = scene();
    await markAway(world);

    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      userName: world.teacher.name,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });
    expect(requested.state).toBe('pending');

    const inbox = await coverageService.getDeputyInbox({ userId: world.other.id });
    expect(inbox.pending).toHaveLength(1);

    const accepted = await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: true,
    });
    expect(accepted.state).toBe('deputized');
    expect(accepted.needsSupervisor).toBe(false);
    expect(accepted.deputation.deputyId).toBe(world.other.id);
  });

  it('النائب يقود الحلقة بلا ترقية: سلطته على حلقتها وحدها', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });
    await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: true,
    });

    // يسجّل حضور طلاب الحلقة التي ينوب فيها…
    const student = getDb().students.find((item) => item.circleId === world.circle.id);
    await expect(
      teacherService.setAttendance({
        studentId: student.id,
        status: 'present',
        role: 'teacher',
        userId: world.other.id,
      }),
    ).resolves.toMatchObject({ status: 'present' });

    // …ودوره لم يتغيّر، ولا سلطة له على حلقة ثالثة.
    expect(getDb().users.find((user) => user.id === world.other.id).role).toBe('teacher');
    const thirdCircle = getDb().circles.find(
      (circle) => circle.id !== world.circle.id && circle.teacherId !== world.other.id,
    );
    const stranger = getDb().students.find((item) => item.circleId === thirdCircle.id);
    await expect(
      teacherService.setAttendance({
        studentId: stranger.id,
        status: 'present',
        role: 'teacher',
        userId: world.other.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('الاعتذار يصعّد المسؤولية إلى المشرف ويحفظ السبب', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });

    const declined = await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: false,
      reason: 'عندي ارتباط',
    });

    expect(declined.state).toBe('escalated');
    expect(declined.needsSupervisor).toBe(true);
    expect(declined.deputation.declineReason).toBe('عندي ارتباط');
  });

  it('النائب وحده يردّ، ومرةً واحدة', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });

    await expect(
      coverageService.respondToDeputy({
        userId: world.teacher.id,
        deputationId: requested.deputation.id,
        accept: true,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: true,
    });
    await expect(
      coverageService.respondToDeputy({
        userId: world.other.id,
        deputationId: requested.deputation.id,
        accept: false,
      }),
    ).rejects.toMatchObject({ messageKey: 'coverage.errors.alreadyAnswered' });
  });

  it('لا يُطلب معلمٌ مرتبطٌ بإنابة أخرى اليوم', async () => {
    const world = scene();
    // حلقة ثانية ليست حلقة النائب نفسه، وإلا صار الطلب «إنابة عن النفس».
    const second = world.db.circles.find(
      (circle) => circle.id !== world.circle.id && circle.teacherId !== world.other.id,
    );

    await markAway(world);
    const first = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });
    await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: first.deputation.id,
      accept: true,
    });

    await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: second.teacherId,
      circleId: second.id,
      status: 'absent',
    });
    await expect(
      coverageService.requestDeputy({
        role: 'teacher',
        userId: second.teacherId,
        circleId: second.id,
        deputyId: world.other.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'coverage.errors.deputyBusy' });

    // ويظهر في المرشّحين موسومًا بسبب ارتباطه لا محذوفًا بلا تفسير.
    const candidates = await coverageService.listDeputyCandidates({
      role: 'teacher',
      userId: second.teacherId,
      circleId: second.id,
    });
    const busy = candidates.find((item) => item.id === world.other.id);
    expect(busy.busy).toBe(true);
    expect(busy.busyReason).toBe('deputizing');
  });

  it('عودة المعلم حاضرًا تُنهي الإنابة تلقائيًا', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });
    await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: true,
    });

    const back = await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      status: 'present',
    });

    expect(back.state).toBe('onSite');
    const stored = getDb().deputations.find((row) => row.id === requested.deputation.id);
    expect(stored.status).toBe('ended');
    expect(stored.endedReason).toBe('teacherReturned');

    // وتسقط سلطة النائب بسقوط الإنابة.
    const student = getDb().students.find((item) => item.circleId === world.circle.id);
    await expect(
      teacherService.setAttendance({
        studentId: student.id,
        status: 'present',
        role: 'teacher',
        userId: world.other.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('الحالات المحذوفة لم تعد تُقبل لحضور المعلم', async () => {
    const world = scene();

    for (const status of ['late', 'notRecorded', null]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        coverageService.setTeacherAttendance({
          role: 'teacher',
          userId: world.teacher.id,
          circleId: world.circle.id,
          status,
        }),
      ).rejects.toMatchObject({ messageKey: 'coverage.errors.invalidStatus' });
    }
  });
});

describe('المشرف — آخر السلسلة', () => {
  beforeEach(() => {
    resetDb();
  });

  it('يتولّى الحلقة بنفسه حين لا يقبل أحد', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });
    await coverageService.respondToDeputy({
      userId: world.other.id,
      deputationId: requested.deputation.id,
      accept: false,
      reason: 'ارتباط',
    });

    const claimed = await coverageService.claimCoverage({
      role: 'supervisor',
      userId: world.supervisor.id,
      userName: world.supervisor.name,
      circleId: world.circle.id,
    });

    expect(claimed.state).toBe('deputized');
    expect(claimed.deputation.deputyId).toBe(world.supervisor.id);
    expect(claimed.deputation.deputyRole).toBe('supervisor');

    // والمشرف يسجّل حضور طلاب الحلقة التي تولّاها.
    const student = getDb().students.find((item) => item.circleId === world.circle.id);
    await expect(
      teacherService.setAttendance({
        studentId: student.id,
        status: 'present',
        role: 'supervisor',
        userId: world.supervisor.id,
      }),
    ).resolves.toMatchObject({ status: 'present' });
  });

  it('تولّي الحلقة يلغي الطلب المعلّق بدل أن يتركه معلّقًا', async () => {
    const world = scene();
    await markAway(world);
    const requested = await coverageService.requestDeputy({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      deputyId: world.other.id,
    });

    await coverageService.claimCoverage({
      role: 'supervisor',
      userId: world.supervisor.id,
      circleId: world.circle.id,
    });

    const stored = getDb().deputations.find((row) => row.id === requested.deputation.id);
    expect(stored.status).toBe('ended');
    expect(stored.endedReason).toBe('superseded');
  });

  it('لا يتولّى حلقةً معلّمها حاضر، ولا حلقةً ليست تحت إشرافه', async () => {
    const world = scene();

    await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      status: 'present',
    });
    await expect(
      coverageService.claimCoverage({
        role: 'supervisor',
        userId: world.supervisor.id,
        circleId: world.circle.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'coverage.errors.notNeeded' });

    await markAway(world);
    const otherSupervisor = world.db.users.find(
      (user) => user.role === 'supervisor' && user.id !== world.supervisor.id,
    );
    await expect(
      coverageService.claimCoverage({
        role: 'supervisor',
        userId: otherSupervisor.id,
        circleId: world.circle.id,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('لوحة التغطية تُصدِّر ما يحتاج تدخّلًا', async () => {
    const world = scene();
    await markAway(world);

    const board = await coverageService.listCoverage({
      role: 'supervisor',
      userId: world.supervisor.id,
    });

    expect(board.rows.length).toBeGreaterThan(0);
    expect(board.rows.every((row) => row.supervisorId === world.supervisor.id)).toBe(true);
    expect(board.rows[0].state).toBe('needsCover');
    // كل حلقات المشرف بلا تغطية ما دام معلّموها لم يسجّلوا حضورهم.
    expect(board.gaps).toBe(board.rows.length);
    expect(board.covered).toBe(0);

    // وحضور معلّم واحد ينقل حلقته إلى المغطّاة.
    await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
      status: 'present',
    });
    const after = await coverageService.listCoverage({
      role: 'supervisor',
      userId: world.supervisor.id,
    });
    expect(after.covered).toBe(1);
    expect(after.gaps).toBe(board.gaps - 1);
  });

  it('من لا يملك التغطية لا يقرأ لوحتها', async () => {
    for (const role of ['student', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        coverageService.listCoverage({ role, userId: 'user-parent-1' }),
      ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
    }
  });
});

describe('الغياب المفترض لا يُستبعد به معلّم', () => {
  beforeEach(() => {
    resetDb();
  });

  it('من لم يسجّل حضوره بعد يبقى مرشّحًا للإنابة', async () => {
    const world = scene();
    await markAway(world);

    const candidates = await coverageService.listDeputyCandidates({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
    });

    // كل المعلمين «غائبون» بالافتراض في بداية اليوم، ولو استُبعدوا لما
    // بقي أحدٌ ينوب — فالاستبعاد يكون بغيابٍ مُسجَّل لا مفترض.
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates.every((item) => item.busy)).toBe(false);

    // ومن سجّل غيابه فعلًا يُستبعد موسومًا بسببه.
    const away = world.db.circles.find(
      (circle) => circle.teacherId !== world.teacher.id && circle.teacherId !== world.other.id,
    );
    await coverageService.setTeacherAttendance({
      role: 'teacher',
      userId: away.teacherId,
      circleId: away.id,
      status: 'absent',
    });

    const after = await coverageService.listDeputyCandidates({
      role: 'teacher',
      userId: world.teacher.id,
      circleId: world.circle.id,
    });
    const flagged = after.find((item) => item.id === away.teacherId);
    expect(flagged.busy).toBe(true);
    expect(flagged.busyReason).toBe('away');
  });
});
