import { beforeEach, describe, expect, it } from 'vitest';
import * as assistantService from './assistantService.js';
import * as managementService from './managementService.js';
import { getDb, resetDb } from '../mock/db.js';

/** الحلقة التجريبية الأولى ومعلمها ومساعدها. */
function context() {
  const db = getDb();
  const circle = db.circles[0];
  const assistant = db.students.find(
    (student) => student.circleId === circle.id && student.isAssistant,
  );
  const peers = db.students.filter(
    (student) => student.circleId === circle.id && student.id !== assistant.id,
  );
  return { db, circle, teacherId: circle.teacherId, assistant, peers };
}

/** تنظيف التوكيلات المبذورة ليبدأ كل اختبار من صفحة بيضاء. */
function clearDelegations() {
  const db = getDb();
  db.assistantDelegations = [];
}


/** طالب دون الحدّين: متوسطه العام ضعيف ولا نشاط له هذا الشهر. */
function ineligibleStudent(circleId) {
  const db = getDb();
  const student = db.students.find(
    (item) => item.circleId === circleId && !item.isAssistant,
  );
  student.masteryAvg = 60;
  // إسقاط نشاط الشهر حتى لا يتأهل بمسار «متميزي الشهر».
  db.sessions = db.sessions.filter((s) => s.studentId !== student.id);
  db.attendance = db.attendance.filter((a) => a.studentId !== student.id);
  return student;
}

describe('خدمة مساعد المعلم', () => {
  beforeEach(() => {
    resetDb();
  });

  it('المعلم وحده يعيّن المساعد ويوكّل', async () => {
    const { assistant, teacherId, circle } = context();

    await expect(
      assistantService.setAssistant({ role: 'supervisor', studentId: assistant.id, isAssistant: true }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await expect(
      assistantService.createDelegation({
        role: 'student',
        teacherId,
        circleId: circle.id,
        assistantStudentId: assistant.id,
        studentIds: ['x'],
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('التعيين مشروط بالجدارة: متوسط عام عالٍ أو تميّز هذا الشهر', async () => {
    const { circle } = context();

    // لا هذا ولا ذاك ⇒ يُرفض.
    const weak = ineligibleStudent(circle.id);
    await expect(
      assistantService.setAssistant({ role: 'teacher', studentId: weak.id, isAssistant: true }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.notEligible' });

    // متوسطه العام ضعيف لكنه متميز هذا الشهر ⇒ يُقبل.
    const db = getDb();
    const now = new Date();
    const day = (i) => new Date(now.getFullYear(), now.getMonth(), 1 + i, 12).toISOString();
    for (let i = 0; i < 4; i += 1) {
      db.sessions.push({
        id: `sx-${i}`,
        studentId: weak.id,
        circleId: circle.id,
        type: 'review',
        mastery: 95,
        createdAt: day(i),
      });
      db.attendance.push({
        id: `ax-${i}`,
        studentId: weak.id,
        circleId: circle.id,
        date: day(i),
        status: 'present',
      });
    }

    const result = await assistantService.setAssistant({
      role: 'teacher',
      studentId: weak.id,
      isAssistant: true,
    });
    expect(result.isAssistant).toBe(true);
  });

  it('التوكيل مقصور على زملاء الحلقة ولا يشمل المساعد نفسه', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, db } = context();
    const outsider = db.students.find((student) => student.circleId !== circle.id);

    await expect(
      assistantService.createDelegation({
        role: 'teacher',
        teacherId,
        circleId: circle.id,
        assistantStudentId: assistant.id,
        studentIds: [outsider.id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.outsideCircle' });

    // المساعد وحده في القائمة ⇒ تُصفّى فتصبح فارغة.
    await expect(
      assistantService.createDelegation({
        role: 'teacher',
        teacherId,
        circleId: circle.id,
        assistantStudentId: assistant.id,
        studentIds: [assistant.id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.noStudents' });
  });

  it('لا يُوكَّل إلا من عُيّن مساعدًا', async () => {
    clearDelegations();
    const { peers, teacherId, circle } = context();
    const plain = peers.find((student) => !student.isAssistant);

    await expect(
      assistantService.createDelegation({
        role: 'teacher',
        teacherId,
        circleId: circle.id,
        assistantStudentId: plain.id,
        studentIds: [peers[0].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.notAssistant' });
  });

  it('التوكيل ينتهي تلقائيًا بانتهاء الأسماء فيعود الطالب لوضعه الطبيعي', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();
    const targets = peers.slice(0, 2);

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: targets.map((student) => student.id),
      note: 'مراجعة جزء عمّ',
    });
    expect(delegation.status).toBe('active');
    expect(delegation.progress.total).toBe(2);

    let duty = await assistantService.getMyDuty(assistant.id);
    expect(duty.active).toBe(true);

    const first = await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: targets[0].id,
      mastery: 92,
    });
    expect(first.closed).toBe(false);
    expect(first.delegation.progress.done).toBe(1);

    const second = await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: targets[1].id,
      mastery: 80,
    });
    expect(second.closed).toBe(true);
    expect(second.delegation.status).toBe('completed');

    duty = await assistantService.getMyDuty(assistant.id);
    expect(duty.active).toBe(false);
    expect(duty.history).toHaveLength(1);
  });

  it('لا يسمّع أحد نيابة عن مساعد آخر ولا لطالب خارج توكيله', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();
    const targets = peers.slice(0, 2);
    const untouched = peers[2];

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: targets.map((student) => student.id),
    });

    await expect(
      assistantService.recordReview({
        assistantStudentId: untouched.id,
        delegationId: delegation.id,
        studentId: targets[0].id,
        mastery: 90,
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await expect(
      assistantService.recordReview({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentId: untouched.id,
        mastery: 90,
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.notDelegated' });

    await expect(
      assistantService.recordReview({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentId: targets[0].id,
        mastery: 140,
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.invalidMastery' });
  });

  it('لا يُسجَّل سماع مرتين لنفس الطالب', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();
    const targets = peers.slice(0, 2);

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: targets.map((student) => student.id),
    });

    await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: targets[0].id,
      mastery: 88,
    });

    await expect(
      assistantService.recordReview({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentId: targets[0].id,
        mastery: 88,
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.alreadyDone' });
  });

  it('توكيل واحد نشِط لكل مساعد', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id],
    });

    await expect(
      assistantService.createDelegation({
        role: 'teacher',
        teacherId,
        circleId: circle.id,
        assistantStudentId: assistant.id,
        studentIds: [peers[1].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.hasActive' });
  });

  it('إلغاء التعيين يُنهي التوكيل الجاري فورًا', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id],
    });

    await assistantService.setAssistant({
      role: 'teacher',
      studentId: assistant.id,
      isAssistant: false,
    });

    const stored = getDb().assistantDelegations.find((item) => item.id === delegation.id);
    expect(stored.status).toBe('cancelled');

    const duty = await assistantService.getMyDuty(assistant.id);
    expect(duty.active).toBe(false);
    expect(duty.isAssistant).toBe(false);
  });

  it('التوكيل لا يمنح الطالب رتبة المعلم ولا صلاحياته', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id],
    });

    // الدور نفسه لم يتغير.
    const stored = getDb().students.find((student) => student.id === assistant.id);
    expect(stored.role).toBe('student');

    // وما زال ممنوعًا من كل ما هو للمعلم أو المشرف.
    await expect(
      managementService.addStudent({
        role: 'student',
        payload: { name: 'طالب جديد', circleId: circle.id },
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });

    await expect(
      assistantService.setAssistant({ role: 'student', studentId: peers[1].id, isAssistant: true }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('سماع المساعد يُوثَّق باسمه كمراجعة لا كتقييم معلم', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id],
    });

    await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: peers[0].id,
      mastery: 91,
      note: 'أتقن المقطع',
    });

    const session = getDb().sessions.find(
      (item) => item.recordedByAssistantId === assistant.id && item.studentId === peers[0].id,
    );
    expect(session).toBeTruthy();
    expect(session.type).toBe('review');
    expect(session.recordedByAssistantName).toBe(assistant.name);
  });

  it('لوحة المعلم تفصل المؤهلين عن المعيَّنين', async () => {
    clearDelegations();
    const { teacherId, circle, assistant } = context();

    const panel = await assistantService.getAssistantPanel({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
    });

    expect(panel.eligibilityMastery).toBe(assistantService.ELIGIBILITY_MASTERY);
    expect(panel.assistants.some((item) => item.id === assistant.id)).toBe(true);
    // المعيَّن لا يظهر ثانيةً ضمن المرشحين.
    expect(panel.eligible.every((item) => item.id !== assistant.id)).toBe(true);
    // كل مرشح مؤهل بأحد المسارين: متوسط عام عالٍ أو تميّز هذا الشهر.
    const db = getDb();
    expect(
      panel.eligible.every((item) =>
        assistantService.isEligible(db, db.students.find((s) => s.id === item.id)),
      ),
    ).toBe(true);
  });

  it('المعلم يُنهي التوكيل مبكرًا', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id, peers[1].id],
    });

    const closed = await assistantService.completeDelegation({
      role: 'teacher',
      delegationId: delegation.id,
    });
    expect(closed.status).toBe('completed');

    await expect(
      assistantService.completeDelegation({ role: 'teacher', delegationId: delegation.id }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.notActive' });
  });

  /* ---------------------------------------------------------------
     وضع «المساعد يختار زملاءه»
     --------------------------------------------------------------- */

  it('المعلم يفوّض الاختيار للمساعد بعدد محدد', async () => {
    clearDelegations();
    const { assistant, teacherId, circle } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    expect(delegation.selectionMode).toBe('assistant');
    expect(delegation.quota).toBe(2);
    // لا أسماء بعد — المهمة بحجم الحصة لا بما اختير.
    expect(delegation.items).toHaveLength(0);
    expect(delegation.progress.total).toBe(2);
    expect(delegation.progress.toChoose).toBe(2);

    const duty = await assistantService.getMyDuty(assistant.id);
    expect(duty.candidates.length).toBeGreaterThan(0);
    expect(duty.candidates.every((c) => c.id !== assistant.id)).toBe(true);
  });

  it('المساعد يختار زملاءه ثم يسمّع لهم', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    const chosen = await assistantService.chooseDelegationStudents({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentIds: [peers[0].id, peers[1].id],
    });

    expect(chosen.items).toHaveLength(2);
    expect(chosen.items.every((item) => item.chosenBy === 'assistant')).toBe(true);
    expect(chosen.progress.toChoose).toBe(0);

    await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: peers[0].id,
      mastery: 90,
    });
    const last = await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: peers[1].id,
      mastery: 85,
    });

    expect(last.closed).toBe(true);
    expect(last.delegation.status).toBe('completed');
  });

  it('لا يتجاوز المساعد العدد الذي حدده المعلم', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentIds: [peers[0].id, peers[1].id, peers[2].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'student.assistant.errors.overQuota' });

    // ولا بالتقسيط على دفعتين.
    await assistantService.chooseDelegationStudents({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentIds: [peers[0].id, peers[1].id],
    });
    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentIds: [peers[2].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'student.assistant.errors.overQuota' });
  });

  it('اختيار المساعد محصور في حلقته ولا يشمل نفسه', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, db } = context();
    const outsider = db.students.find((student) => student.circleId !== circle.id);

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentIds: [outsider.id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.outsideCircle' });

    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentIds: [assistant.id],
      }),
    ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.noStudents' });
  });

  it('حين يسمّي المعلم الأسماء لا يملك المساعد تغييرها', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      studentIds: [peers[0].id],
    });
    expect(delegation.selectionMode).toBe('teacher');

    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: assistant.id,
        delegationId: delegation.id,
        studentIds: [peers[1].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'student.assistant.errors.notAllowedToChoose' });
  });

  it('لا يختار أحد نيابة عن مساعد آخر', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    await expect(
      assistantService.chooseDelegationStudents({
        assistantStudentId: peers[3].id,
        delegationId: delegation.id,
        studentIds: [peers[0].id],
      }),
    ).rejects.toMatchObject({ messageKey: 'state.forbiddenHint' });
  });

  it('حصة غير صالحة تُرفض', async () => {
    clearDelegations();
    const { assistant, teacherId, circle } = context();

    for (const quota of [0, -1, 99]) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        assistantService.createDelegation({
          role: 'teacher',
          teacherId,
          circleId: circle.id,
          assistantStudentId: assistant.id,
          selectionMode: 'assistant',
          quota,
        }),
      ).rejects.toMatchObject({ messageKey: 'teacher.assistant.errors.invalidQuota' });
    }
  });

  it('التوكيل لا يُغلق قبل اكتمال الاختيار والسماع معًا', async () => {
    clearDelegations();
    const { assistant, teacherId, circle, peers } = context();

    const delegation = await assistantService.createDelegation({
      role: 'teacher',
      teacherId,
      circleId: circle.id,
      assistantStudentId: assistant.id,
      selectionMode: 'assistant',
      quota: 2,
    });

    // اختار واحدًا فقط من اثنين ثم سمّع له: المهمة ما زالت جارية.
    await assistantService.chooseDelegationStudents({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentIds: [peers[0].id],
    });
    const first = await assistantService.recordReview({
      assistantStudentId: assistant.id,
      delegationId: delegation.id,
      studentId: peers[0].id,
      mastery: 90,
    });

    expect(first.closed).toBe(false);
    expect(first.delegation.status).toBe('active');
    expect(first.delegation.progress.toChoose).toBe(1);
  });
});
