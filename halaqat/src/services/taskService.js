/**
 * خدمة المهام — العمود الفقري للرحلة.
 *
 * كل ما يفعله الطالب يبدأ من مهمة وينتهي بأثر: مهمة اليوم ← تنفيذها ← نتيجة
 * ← توصية بما بعدها ← تقدّم يتحرّك. والتسميع والمراجعة أنواع مهام لا أقسامًا
 * منفصلة في التنقل.
 *
 * مصدر المهمة إمّا خطة اليوم التلقائية أو تعيينٌ من المعلم، والفرق ظاهر
 * للطالب كي يعرف أن معلمه يتابعه.
 *
 * تنبيه: نسخة بلا خادم — القواعد هنا للتجربة لا تفويضًا أمنيًا.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb, getStudent } from '../mock/db.js';
import { getSurah, SURAHS_WITH_TEXT } from '../mock/quran.js';
import { can, ACTIONS } from '../config/permissions.js';
import { toISODate } from '../lib/format.js';

/** أنواع المهام. */
export const TASK_TYPES = ['memorize', 'review'];

function assertCan(role, action) {
  if (!can(role, action)) throw new ApiError('forbidden', 'state.forbiddenHint');
}

function tasksOf(db) {
  if (!Array.isArray(db.tasks)) db.tasks = [];
  return db.tasks;
}

function shape(task) {
  const surah = getSurah(task.surahNumber);
  return {
    ...task,
    surahName: surah?.name ?? '',
    ayahCount: task.toAyah - task.fromAyah + 1,
    result: task.result ? { ...task.result } : null,
  };
}

/**
 * خطة اليوم التلقائية — مقطع حفظ جديد ومقطع مراجعة.
 * تُشتق من موضع الطالب فتبقى ثابتة له في اليوم نفسه.
 */
function autoTasksFor(student, date) {
  const base = SURAHS_WITH_TEXT;
  const pick = (offset) => base[(student.memorizedPages + offset) % base.length];
  const fresh = pick(0);
  const older = pick(3);

  return [
    {
      id: `task-auto-${student.id}-${date}-memorize`,
      studentId: student.id,
      circleId: student.circleId,
      teacherId: student.teacherId,
      type: 'memorize',
      surahNumber: fresh.number,
      fromAyah: 1,
      toAyah: Math.min(fresh.ayahCount, 10),
      source: 'system',
      assignedById: null,
      assignedByName: '',
      note: '',
      dueDate: date,
      status: 'pending',
      result: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: `task-auto-${student.id}-${date}-review`,
      studentId: student.id,
      circleId: student.circleId,
      teacherId: student.teacherId,
      type: 'review',
      surahNumber: older.number,
      fromAyah: 1,
      toAyah: Math.min(older.ayahCount, 15),
      source: 'system',
      assignedById: null,
      assignedByName: '',
      note: '',
      dueDate: date,
      status: 'pending',
      result: null,
      createdAt: new Date().toISOString(),
    },
  ];
}

/**
 * مهام يوم الطالب — تُولَّد عند أول طلب لليوم ثم تثبت.
 * التوليد عند القراءة مقبول هنا لأن القاعدة محلية بلا خادم.
 */
export async function listToday(studentId) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      const date = toISODate(new Date());
      const all = tasksOf(db);
      const todays = all.filter((task) => task.studentId === studentId && task.dueDate === date);

      if (todays.length === 0) {
        const generated = autoTasksFor(student, date);
        all.push(...generated);
        todays.push(...generated);
      }

      // المعيَّن من المعلم أولًا: متابعته أولى من الخطة التلقائية.
      const ordered = [...todays].sort((a, b) => {
        if (a.status !== b.status) return a.status === 'pending' ? -1 : 1;
        if (a.source !== b.source) return a.source === 'teacher' ? -1 : 1;
        return 0;
      });

      const done = todays.filter((task) => task.status === 'done').length;

      return {
        date,
        tasks: ordered.map(shape),
        total: todays.length,
        done,
        remaining: todays.length - done,
        allDone: todays.length > 0 && done === todays.length,
      };
    }),
  );
}

export async function getTask(taskId) {
  return request(() => {
    const task = tasksOf(getDb()).find((item) => item.id === taskId);
    if (!task) throw new ApiError('notFound', 'state.notFoundHint');
    return shape(task);
  });
}

/** مهام الطالب كلها — للسجل وصفحة «مهامي». */
export async function listByStudent({ studentId, status = 'all' } = {}) {
  return request(() => {
    let list = tasksOf(getDb()).filter((task) => task.studentId === studentId);
    if (status !== 'all') list = list.filter((task) => task.status === status);
    return list
      .sort((a, b) => (a.dueDate < b.dueDate ? 1 : a.dueDate > b.dueDate ? -1 : 0))
      .map(shape);
  });
}

/**
 * التوصية بعد إتمام المهمة — الرحلة لا تقف عند رقم.
 * أخطاء ⇒ مراجعة لها، وإلا مهمة تالية، وإلا خُتم اليوم.
 */
function buildRecommendation(db, task, date) {
  const mistakes = task.result?.mistakes ?? [];
  if (mistakes.length > 0) {
    return {
      kind: 'reviewMistakes',
      ayat: mistakes.map((item) => item.ayah),
      surahNumber: task.surahNumber,
    };
  }

  const next = tasksOf(db).find(
    (item) =>
      item.studentId === task.studentId &&
      item.dueDate === date &&
      item.status === 'pending' &&
      item.id !== task.id,
  );
  if (next) return { kind: 'nextTask', taskId: next.id, type: next.type };

  return { kind: 'dayComplete' };
}

/**
 * إتمام مهمة بنتيجتها.
 * يسجّل جلسة، ويحرّك مؤشرات الطالب، ويعيد التوصية والتقدّم بعدها —
 * فيرى الطالب أثر فعله في الشاشة نفسها.
 */
export async function completeTask({ taskId, studentId, mastery, mistakes = [] }) {
  return request(() =>
    mutateDb((db) => {
      const task = tasksOf(db).find((item) => item.id === taskId);
      if (!task) throw new ApiError('notFound', 'state.notFoundHint');
      if (task.studentId !== studentId) throw new ApiError('forbidden', 'state.forbiddenHint');
      if (task.status === 'done') {
        throw new ApiError('alreadyDone', 'tasks.errors.alreadyDone');
      }

      const score = Number(mastery);
      if (!Number.isFinite(score) || score < 0 || score > 100) {
        throw new ApiError('invalidMastery', 'tasks.errors.invalidMastery');
      }

      const now = new Date().toISOString();
      task.status = 'done';
      task.result = {
        mastery: Math.round(score),
        mistakes: mistakes.map((item) => ({ ayah: item.ayah, kind: item.kind ?? 'pronunciation' })),
        completedAt: now,
      };

      const student = db.students.find((item) => item.id === studentId);
      const before = {
        memorizedPages: student.memorizedPages,
        masteryAvg: student.masteryAvg,
        todayDone: student.todayDone,
      };

      // أثر ملموس: الحفظ يزيد الصفحات، والاثنان يحرّكان متوسط الإتقان.
      if (task.type === 'memorize') {
        student.memorizedPages += 1;
        student.memorizedJuz = Math.floor(student.memorizedPages / 20);
      }
      student.masteryAvg = Math.round((student.masteryAvg * 4 + task.result.mastery) / 5);
      student.todayDone = Math.min(student.targetDaily, student.todayDone + 1);
      student.lastRecitationAt = now;

      db.sessions.unshift({
        id: `session-task-${Date.now()}`,
        studentId,
        teacherId: task.teacherId,
        circleId: task.circleId,
        type: task.type === 'memorize' ? 'memorization' : 'review',
        surahNumber: task.surahNumber,
        fromAyah: task.fromAyah,
        toAyah: task.toAyah,
        mastery: task.result.mastery,
        grade:
          task.result.mastery >= 90 ? 'excellent' : task.result.mastery >= 75 ? 'good' : 'needsWork',
        durationSeconds: 0,
        notes: '',
        createdAt: now,
        taskId: task.id,
      });

      // إشعار المعلم بما أنجزه من عيّنه.
      if (task.source === 'teacher') {
        db.notifications.unshift({
          id: `notif-${Date.now()}`,
          typeKey: 'taskDone',
          createdAt: now,
          read: false,
          link: '/app/teacher/students',
          roles: ['teacher'],
        });
      }

      const date = toISODate(new Date());
      const todays = tasksOf(db).filter(
        (item) => item.studentId === studentId && item.dueDate === date,
      );

      return {
        task: shape(task),
        recommendation: buildRecommendation(db, task, date),
        progress: {
          before,
          after: {
            memorizedPages: student.memorizedPages,
            masteryAvg: student.masteryAvg,
            todayDone: student.todayDone,
          },
          targetDaily: student.targetDaily,
          doneToday: todays.filter((item) => item.status === 'done').length,
          totalToday: todays.length,
        },
      };
    }),
  );
}

/** ينشئ مهمة مراجعة للآيات التي أخطأ فيها — امتداد طبيعي للتوصية. */
export async function createReviewFromMistakes({ studentId, taskId }) {
  return request(() =>
    mutateDb((db) => {
      const source = tasksOf(db).find((item) => item.id === taskId);
      if (!source) throw new ApiError('notFound', 'state.notFoundHint');
      if (source.studentId !== studentId) throw new ApiError('forbidden', 'state.forbiddenHint');

      const ayat = (source.result?.mistakes ?? []).map((item) => item.ayah);
      if (ayat.length === 0) throw new ApiError('noMistakes', 'tasks.errors.noMistakes');

      const task = {
        id: `task-fix-${Date.now()}`,
        studentId,
        circleId: source.circleId,
        teacherId: source.teacherId,
        type: 'review',
        surahNumber: source.surahNumber,
        fromAyah: Math.min(...ayat),
        toAyah: Math.max(...ayat),
        source: 'system',
        assignedById: null,
        assignedByName: '',
        note: '',
        dueDate: toISODate(new Date()),
        status: 'pending',
        result: null,
        createdAt: new Date().toISOString(),
        fromTaskId: source.id,
      };

      tasksOf(db).push(task);
      return shape(task);
    }),
  );
}

/* ===============================================================
   جانب المعلم
   =============================================================== */

/** تعيين مهمة لطالب في حلقة المعلم. */
export async function assignTask({
  role,
  teacherId,
  teacherName,
  studentId,
  type,
  surahNumber,
  fromAyah,
  toAyah,
  note = '',
  dueDate,
}) {
  return request(() =>
    mutateDb((db) => {
      assertCan(role, ACTIONS.TASKS_ASSIGN);

      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');
      if (student.teacherId !== teacherId) {
        throw new ApiError('outsideCircle', 'teacher.assistant.errors.outsideCircle');
      }
      if (!TASK_TYPES.includes(type)) throw new ApiError('invalidType', 'tasks.errors.invalidType');

      const surah = getSurah(Number(surahNumber));
      if (!surah) throw new ApiError('invalidSurah', 'tasks.errors.invalidSurah');

      const from = Number(fromAyah);
      const to = Number(toAyah);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > surah.ayahCount) {
        throw new ApiError('invalidRange', 'tasks.errors.invalidRange');
      }

      const task = {
        id: `task-${Date.now()}`,
        studentId,
        circleId: student.circleId,
        teacherId,
        type,
        surahNumber: surah.number,
        fromAyah: from,
        toAyah: to,
        source: 'teacher',
        assignedById: teacherId,
        assignedByName: teacherName ?? '',
        note: String(note ?? '').trim(),
        dueDate: dueDate || toISODate(new Date()),
        status: 'pending',
        result: null,
        createdAt: new Date().toISOString(),
      };

      tasksOf(db).push(task);
      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'taskAssigned',
        createdAt: task.createdAt,
        read: false,
        link: '/app/student',
        roles: ['student'],
      });

      return shape(task);
    }),
  );
}

/** مهام طالب واحد كما يراها معلمه. */
export async function listForTeacher({ role, studentId }) {
  return request(() => {
    assertCan(role, ACTIONS.TASKS_ASSIGN);
    return tasksOf(getDb())
      .filter((task) => task.studentId === studentId)
      .sort((a, b) => (a.dueDate < b.dueDate ? 1 : -1))
      .map(shape);
  });
}
