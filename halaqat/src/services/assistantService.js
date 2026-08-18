/**
 * خدمة «مساعد المعلم».
 *
 * الفكرة بدقة: المعلم يعيّن طالبًا متميزًا من حلقته مساعدًا، ثم يوكّله بسماع
 * مراجعة عدد محدد من زملائه. التوكيل:
 *  - نطاقه «مراجعة» فقط (scope: 'review')، لا حفظ جديد ولا اختبار ولا درجات نهائية.
 *  - لا يمنح الطالب رتبة المعلم: دوره يبقى student، ولا يحصل على أي صلاحية دور.
 *    القدرة هنا مربوطة بالبيانات (توكيل نشِط يخصّه) لا بمصفوفة الصلاحيات.
 *  - مؤقت: ينتهي تلقائيًا بانتهاء أسماء التوكيل فيعود الطالب لوضعه الطبيعي،
 *    ويمكن للمعلم إنهاؤه في أي وقت.
 *
 * تنبيه: نسخة تجريبية بلا خادم — هذه قواعد واجهة لا تفويض أمني.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb } from '../mock/db.js';
import { can, ACTIONS } from '../config/permissions.js';
import { evaluateStudent } from './distinguishedService.js';

/** الحد الأدنى لمتوسط الإتقان العام ليُعتبر الطالب مؤهلًا للمساعدة. */
export const ELIGIBILITY_MASTERY = 85;

/**
 * يؤهَّل للمساعدة من أثبت جدارته بأحد طريقين:
 *  - متوسط عام ≥ 85% (سجل طويل)، أو
 *  - تميّز هذا الشهر بمعايير «متميزي الشهر» (أداء حاضر).
 * توحيد التعريف مقصود: لا يظهر اسم في قائمة المتميزين ثم يُرفض تعيينه.
 */
export function isEligible(db, student) {
  if (!student) return false;
  if (student.masteryAvg >= ELIGIBILITY_MASTERY) return true;
  return evaluateStudent(db, student).distinguished;
}

/** أقصى عدد زملاء في توكيل واحد — التوكيل مهمة قصيرة لا عبء دائم. */
export const MAX_DELEGATION_ITEMS = 6;

function assertCan(role, action) {
  if (!can(role, action)) throw new ApiError('forbidden', 'state.forbiddenHint');
}

/* ---------------------------------------------------------------
   إشعار داخلي بتغيّر التوكيلات — تستمع له الواجهة لتُظهر/تُخفي
   قسم المساعد فور بدء المهمة أو انتهائها بلا إعادة تحميل.
   --------------------------------------------------------------- */
const listeners = new Set();

export function subscribeDelegations(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emitChange() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      /* لا نسمح لمستمع واحد بإسقاط البقية */
    }
  });
}

function delegations(db) {
  if (!Array.isArray(db.assistantDelegations)) db.assistantDelegations = [];
  return db.assistantDelegations;
}

function progressOf(delegation) {
  // في وضع «المساعد يختار» المهمة بحجم الحصة لا بعدد ما اختاره حتى الآن،
  // فلا يبدو التوكيل مكتملًا لمجرد أنه سمّع أول من اختار.
  const quota = delegation.quota ?? delegation.items.length;
  const total = delegation.selectionMode === 'assistant' ? quota : delegation.items.length;
  const done = delegation.items.filter((item) => item.status === 'done').length;
  return {
    total,
    done,
    remaining: Math.max(0, total - done),
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    chosen: delegation.items.length,
    toChoose: Math.max(0, total - delegation.items.length),
  };
}

function shape(delegation) {
  return {
    ...delegation,
    items: delegation.items.map((item) => ({ ...item })),
    progress: progressOf(delegation),
  };
}

/* ===============================================================
   جانب المعلم
   =============================================================== */

/**
 * لوحة المساعد عند المعلم: المتميزون المؤهلون، والمساعدون الحاليون،
 * والتوكيلات النشطة والمنتهية.
 */
export async function getAssistantPanel({ role, teacherId, circleId }) {
  return request(() => {
    assertCan(role, ACTIONS.ASSISTANT_ASSIGN);
    const db = getDb();
    const circleStudents = db.students.filter((student) => student.circleId === circleId);

    const toRow = (student) => ({
      id: student.id,
      name: student.name,
      masteryAvg: student.masteryAvg,
      attendanceRate: student.attendanceRate,
      memorizedJuz: student.memorizedJuz,
      status: student.status,
      isAssistant: Boolean(student.isAssistant),
      eligible: isEligible(db, student),
    });

    const all = circleStudents.map(toRow);
    const list = delegations(db).filter((item) => item.circleId === circleId);
    const active = list.filter((item) => item.status === 'active');

    const assistants = all
      .filter((student) => student.isAssistant)
      .map((student) => ({
        ...student,
        activeDelegationId: active.find((item) => item.assistantStudentId === student.id)?.id ?? null,
        completedCount: list.filter(
          (item) => item.assistantStudentId === student.id && item.status === 'completed',
        ).length,
      }));

    return {
      // المؤهلون غير المعيّنين بعد، الأعلى إتقانًا أولًا.
      eligible: all
        .filter((student) => student.eligible && !student.isAssistant)
        .sort((a, b) => b.masteryAvg - a.masteryAvg),
      assistants,
      // بقية الحلقة: من يصلح أن يُوكَّل المساعدُ بسماعه.
      circleStudents: all,
      delegations: list
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .map(shape),
      eligibilityMastery: ELIGIBILITY_MASTERY,
      maxItems: MAX_DELEGATION_ITEMS,
    };
  });
}

/**
 * تعيين طالب متميز مساعدًا أو إلغاء التعيين.
 * إلغاء التعيين يُنهي أي توكيل نشِط فورًا فلا تبقى مهمة بلا صاحب.
 */
export async function setAssistant({ role, studentId, isAssistant }) {
  const result = await request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.ASSISTANT_ASSIGN);
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      if (isAssistant && !isEligible(db, student)) {
        throw new ApiError('notEligible', 'teacher.assistant.notEligible');
      }

      student.isAssistant = Boolean(isAssistant);

      if (student.isAssistant) {
        db.notifications.unshift({
          id: `notif-${Date.now()}`,
          typeKey: 'assistant',
          createdAt: new Date().toISOString(),
          read: false,
          link: '/app/student',
          roles: ['student', 'parent'],
        });
      } else {
        // لا مساعد ⇐ لا توكيل معلّق.
        delegations(db)
          .filter((item) => item.assistantStudentId === studentId && item.status === 'active')
          .forEach((item) => {
            item.status = 'cancelled';
            item.completedAt = new Date().toISOString();
          });
      }

      return { id: studentId, isAssistant: student.isAssistant };
    }),
  );
  emitChange();
  return result;
}

/**
 * توكيل المساعد بسماع مراجعة زملائه.
 *
 * وضعان يختارهما المعلم:
 *  - `teacher`: المعلم يسمّي الطلاب بأعيانهم (studentIds).
 *  - `assistant`: المعلم يحدد عددًا (quota) والمساعد يختار زملاءه بنفسه،
 *    ويبقى الاختيار محصورًا في حلقة المعلم ومحدودًا بالعدد المسموح.
 */
export async function createDelegation({
  role,
  teacherId,
  circleId,
  assistantStudentId,
  studentIds = [],
  selectionMode = 'teacher',
  quota = 3,
  note = '',
}) {
  const result = await request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.DELEGATION_MANAGE);

      const assistant = db.students.find((item) => item.id === assistantStudentId);
      if (!assistant) throw new ApiError('notFound', 'state.notFoundHint');
      if (!assistant.isAssistant) {
        throw new ApiError('notAssistant', 'teacher.assistant.errors.notAssistant');
      }
      if (assistant.circleId !== circleId) {
        throw new ApiError('outsideCircle', 'teacher.assistant.errors.outsideCircle');
      }

      const open = delegations(db).find(
        (item) => item.assistantStudentId === assistantStudentId && item.status === 'active',
      );
      if (open) throw new ApiError('hasActive', 'teacher.assistant.errors.hasActive');

      if (!['teacher', 'assistant'].includes(selectionMode)) {
        throw new ApiError('invalidMode', 'teacher.assistant.errors.invalidMode');
      }

      // في وضع «المساعد يختار» لا أسماء عند الإنشاء، بل عدد مسموح به فقط.
      const allowed = selectionMode === 'assistant' ? Number(quota) : 0;
      if (selectionMode === 'assistant') {
        if (!Number.isInteger(allowed) || allowed < 1 || allowed > MAX_DELEGATION_ITEMS) {
          throw new ApiError('invalidQuota', 'teacher.assistant.errors.invalidQuota');
        }
      }

      const unique =
        selectionMode === 'assistant'
          ? []
          : [...new Set(studentIds ?? [])].filter((id) => id !== assistantStudentId);

      if (selectionMode === 'teacher') {
        if (unique.length === 0) {
          throw new ApiError('noStudents', 'teacher.assistant.errors.noStudents');
        }
        if (unique.length > MAX_DELEGATION_ITEMS) {
          throw new ApiError('tooMany', 'teacher.assistant.errors.tooMany');
        }
      }

      const targets = unique.map((id) => {
        const student = db.students.find((item) => item.id === id);
        // لا يُوكَّل المساعد إلا بزملائه في حلقته.
        if (!student || student.circleId !== circleId) {
          throw new ApiError('outsideCircle', 'teacher.assistant.errors.outsideCircle');
        }
        return student;
      });

      const delegation = {
        id: `delegation-${Date.now()}`,
        assistantStudentId,
        assistantName: assistant.name,
        teacherId,
        circleId,
        scope: 'review',
        status: 'active',
        selectionMode,
        // العدد المسموح به: حصة المساعد في وضع اختياره، وإلا عدد الأسماء.
        quota: selectionMode === 'assistant' ? allowed : targets.length,
        note: String(note ?? '').trim(),
        createdAt: new Date().toISOString(),
        completedAt: null,
        items: targets.map((student) => ({
          studentId: student.id,
          studentName: student.name,
          status: 'pending',
          mastery: null,
          note: '',
          doneAt: null,
        })),
      };

      delegations(db).unshift(delegation);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'delegation',
        createdAt: delegation.createdAt,
        read: false,
        link: '/app/student/assistant',
        roles: ['student'],
      });

      return shape(delegation);
    }),
  );
  emitChange();
  return result;
}

/** إنهاء التوكيل مبكرًا بقرار المعلم. */
export async function completeDelegation({ role, delegationId }) {
  const result = await request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.DELEGATION_MANAGE);
      const delegation = delegations(db).find((item) => item.id === delegationId);
      if (!delegation) throw new ApiError('notFound', 'state.notFoundHint');
      if (delegation.status !== 'active') {
        throw new ApiError('notActive', 'teacher.assistant.errors.notActive');
      }
      delegation.status = 'completed';
      delegation.completedAt = new Date().toISOString();
      return shape(delegation);
    }),
  );
  emitChange();
  return result;
}

/* ===============================================================
   جانب الطالب المساعد
   =============================================================== */

/**
 * مهمة الطالب الحالية — تُبنى من البيانات لا من الدور.
 * تعود `active: false` حين لا يوجد توكيل، فتختفي واجهة المساعد تلقائيًا.
 */
export async function getMyDuty(studentId) {
  return request(() => {
    const db = getDb();
    const student = db.students.find((item) => item.id === studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');

    const delegation = delegations(db).find(
      (item) => item.assistantStudentId === studentId && item.status === 'active',
    );

    const history = delegations(db)
      .filter((item) => item.assistantStudentId === studentId && item.status !== 'active')
      .sort((a, b) => new Date(b.completedAt ?? 0) - new Date(a.completedAt ?? 0))
      .slice(0, 5)
      .map(shape);

    if (!delegation) {
      return { active: false, isAssistant: Boolean(student.isAssistant), delegation: null, history };
    }

    const teacher = db.users.find((item) => item.id === delegation.teacherId);
    const circle = db.circles.find((item) => item.id === delegation.circleId);
    const shaped = shape(delegation);

    // من يصلح أن يختاره المساعد: زملاء حلقته ممن لم يخترهم بعد.
    const chosen = new Set(delegation.items.map((item) => item.studentId));
    const candidates =
      delegation.selectionMode === 'assistant' && shaped.progress.toChoose > 0
        ? db.students
            .filter(
              (item) =>
                item.circleId === delegation.circleId &&
                item.id !== studentId &&
                !chosen.has(item.id),
            )
            .map((item) => ({ id: item.id, name: item.name, memorizedJuz: item.memorizedJuz }))
        : [];

    return {
      active: true,
      isAssistant: Boolean(student.isAssistant),
      delegation: {
        ...shaped,
        teacherName: teacher?.name ?? '',
        circleName: circle?.name ?? '',
      },
      candidates,
      history,
    };
  });
}

/**
 * اختيار المساعد لزملائه — متاح فقط حين يفوّضه المعلم بذلك.
 *
 * الاختيار محكوم بثلاثة قيود: من حلقته، وليس نفسه، وضمن العدد الذي حدده
 * المعلم. فالتفويض بالاختيار لا يعني تفويضًا مفتوحًا.
 */
export async function chooseDelegationStudents({ assistantStudentId, delegationId, studentIds }) {
  const result = await request(() =>
    mutateDb((db) => {
      const delegation = delegations(db).find((item) => item.id === delegationId);
      if (!delegation) throw new ApiError('notFound', 'state.notFoundHint');

      if (delegation.assistantStudentId !== assistantStudentId) {
        throw new ApiError('forbidden', 'state.forbiddenHint');
      }
      if (delegation.status !== 'active') {
        throw new ApiError('notActive', 'teacher.assistant.errors.notActive');
      }
      if (delegation.selectionMode !== 'assistant') {
        // المعلم سمّى الطلاب بنفسه، فليس للمساعد تعديل القائمة.
        throw new ApiError('notAllowedToChoose', 'student.assistant.errors.notAllowedToChoose');
      }

      const already = new Set(delegation.items.map((item) => item.studentId));
      const unique = [...new Set(studentIds ?? [])].filter(
        (id) => id !== assistantStudentId && !already.has(id),
      );
      if (unique.length === 0) {
        throw new ApiError('noStudents', 'teacher.assistant.errors.noStudents');
      }

      const room = (delegation.quota ?? 0) - delegation.items.length;
      if (unique.length > room) {
        throw new ApiError('overQuota', 'student.assistant.errors.overQuota');
      }

      unique.forEach((id) => {
        const target = db.students.find((item) => item.id === id);
        if (!target || target.circleId !== delegation.circleId) {
          throw new ApiError('outsideCircle', 'teacher.assistant.errors.outsideCircle');
        }
        delegation.items.push({
          studentId: target.id,
          studentName: target.name,
          status: 'pending',
          mastery: null,
          note: '',
          doneAt: null,
          // توثيق من اختار هذا الاسم — المساعد أم المعلم.
          chosenBy: 'assistant',
        });
      });

      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'delegationChosen',
        createdAt: new Date().toISOString(),
        read: false,
        link: '/app/teacher/assistant',
        roles: ['teacher'],
      });

      return shape(delegation);
    }),
  );
  emitChange();
  return result;
}

/**
 * تسجيل سماع مراجعة زميل موكَّل.
 * تُسجَّل الجلسة باسم المساعد صراحةً (`recordedByAssistantId`) فيبقى واضحًا
 * في سجل المعلم أن السماع كان مراجعة بتوكيل لا تقييمًا من معلم.
 */
export async function recordReview({ assistantStudentId, delegationId, studentId, mastery, note = '' }) {
  const result = await request(() =>
    mutateDb((db) => {
      const delegation = delegations(db).find((item) => item.id === delegationId);
      if (!delegation) throw new ApiError('notFound', 'state.notFoundHint');

      // القدرة من التوكيل نفسه: لا أحد يسمّع نيابة عن غيره.
      if (delegation.assistantStudentId !== assistantStudentId) {
        throw new ApiError('forbidden', 'state.forbiddenHint');
      }
      if (delegation.status !== 'active') {
        throw new ApiError('notActive', 'teacher.assistant.errors.notActive');
      }

      const item = delegation.items.find((entry) => entry.studentId === studentId);
      if (!item) throw new ApiError('notDelegated', 'teacher.assistant.errors.notDelegated');
      if (item.status === 'done') {
        throw new ApiError('alreadyDone', 'teacher.assistant.errors.alreadyDone');
      }

      const score = Number(mastery);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new ApiError('invalidMastery', 'teacher.assistant.errors.invalidMastery');
      }

      const now = new Date().toISOString();
      item.status = 'done';
      item.mastery = Math.round(score);
      item.note = String(note ?? '').trim();
      item.doneAt = now;

      const target = db.students.find((entry) => entry.id === studentId);
      db.sessions.unshift({
        id: `session-assist-${Date.now()}`,
        studentId,
        teacherId: delegation.teacherId,
        circleId: delegation.circleId,
        type: 'review',
        surahNumber: target?.currentSurah ?? 1,
        fromAyah: 1,
        toAyah: 1,
        mastery: item.mastery,
        grade: item.mastery >= 90 ? 'excellent' : item.mastery >= 75 ? 'good' : 'needsWork',
        durationSeconds: 0,
        notes: item.note,
        createdAt: now,
        // توثيق مصدر السماع: مراجعة بتوكيل من المعلم لا تقييم معلم.
        recordedByAssistantId: assistantStudentId,
        recordedByAssistantName: delegation.assistantName,
      });

      const progress = progressOf(delegation);
      let closed = false;
      if (progress.remaining === 0 && progress.toChoose === 0) {
        // انتهت الأسماء ⇒ انتهت المهمة، ويعود الطالب لوضعه الطبيعي.
        delegation.status = 'completed';
        delegation.completedAt = now;
        closed = true;
        db.notifications.unshift({
          id: `notif-${Date.now()}`,
          typeKey: 'delegationDone',
          createdAt: now,
          read: false,
          link: '/app/teacher/assistant',
          roles: ['teacher'],
        });
      }

      return { delegation: shape(delegation), closed };
    }),
  );
  emitChange();
  return result;
}
