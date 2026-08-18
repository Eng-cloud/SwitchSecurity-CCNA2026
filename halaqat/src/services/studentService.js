/** خدمة الطالب — كل بيانات رحلة الطالب تمر من هنا. */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb, getStudent, getSurahName } from '../mock/db.js';
import { SURAHS_WITH_TEXT } from '../mock/quran.js';
import { toISODate } from '../lib/format.js';

function summarizeSessions(sessions) {
  if (!sessions.length) return { count: 0, avgMastery: 0, lastAt: null };
  const avg = Math.round(
    sessions.reduce((sum, session) => sum + (session.mastery || 0), 0) / sessions.length,
  );
  return {
    count: sessions.length,
    avgMastery: avg,
    lastAt: sessions[0]?.createdAt ?? null,
  };
}

export async function getDashboard(studentId) {
  return request(() => {
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');

    const db = getDb();
    const sessions = db.sessions
      .filter((session) => session.studentId === studentId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const recent = sessions.slice(0, 5).map((session) => ({
      id: session.id,
      type: session.type,
      surahName: getSurahName(session.surahNumber),
      fromAyah: session.fromAyah,
      toAyah: session.toAyah,
      mastery: session.mastery,
      createdAt: session.createdAt,
    }));

    const nextTest = db.tests.find((test) => test.status === 'available') ?? null;

    return {
      student: {
        id: student.id,
        name: student.name,
        streak: student.streak,
        targetDaily: student.targetDaily,
        todayDone: student.todayDone,
        memorizedPages: student.memorizedPages,
        memorizedJuz: student.memorizedJuz,
        masteryAvg: student.masteryAvg,
        reviewRate: student.reviewRate,
        lastReadPage: student.lastReadPage,
        currentSurah: student.currentSurah,
        currentSurahName: getSurahName(student.currentSurah),
        isAssistant: Boolean(student.isAssistant),
      },
      summary: summarizeSessions(sessions),
      recent,
      nextTest,
      plan: buildDailyPlan(student),
    };
  });
}

/**
 * إنجاز اليوم محفوظ باسم كل بند على حدة ومقيَّد بتاريخه.
 *
 * كان الإنجاز عدّادًا واحدًا، فتعليم بندٍ يُعلّم ما قبله تلقائيًا ولا سبيل
 * للتراجع عن ضغطة بالخطأ. الآن لكل بند حالته، والتبديل يعمل في الاتجاهين.
 */
function planProgressOf(student) {
  const today = toISODate(new Date());
  const stored = student.planProgress;
  // يوم جديد ⇒ صفحة جديدة: لا يُحسب إنجاز الأمس على اليوم.
  if (!stored || stored.date !== today) return { date: today, doneIds: [] };
  return { date: today, doneIds: [...(stored.doneIds ?? [])] };
}

function buildDailyPlan(student) {
  const base = SURAHS_WITH_TEXT;
  const pick = (offset) => base[(student.memorizedPages + offset) % base.length];
  const newSurah = pick(0);
  const recentSurah = pick(3);
  const farSurah = pick(7);
  const { doneIds } = planProgressOf(student);

  return [
    {
      id: 'plan-new',
      kind: 'newMemorization',
      surahNumber: newSurah.number,
      surahName: newSurah.name,
      fromAyah: 1,
      toAyah: Math.min(newSurah.ayahCount, 5),
    },
    {
      id: 'plan-recent',
      kind: 'recentReview',
      surahNumber: recentSurah.number,
      surahName: recentSurah.name,
      fromAyah: 1,
      toAyah: recentSurah.ayahCount,
    },
    {
      id: 'plan-far',
      kind: 'farReview',
      surahNumber: farSurah.number,
      surahName: farSurah.name,
      fromAyah: 1,
      toAyah: farSurah.ayahCount,
    },
  ].map((item) => ({ ...item, done: doneIds.includes(item.id) }));
}

/** أسماء بنود الخطة — تُستعمل للتحقق من صحة المُعرَّف الوارد. */
const PLAN_IDS = ['plan-new', 'plan-recent', 'plan-far'];

/**
 * تبديل حالة بند في خطة اليوم.
 * @param {boolean|undefined} done اتركه فارغًا للتبديل، أو مرّره صراحةً.
 */
export async function completePlanItem(studentId, planId, { done } = {}) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');
      if (!PLAN_IDS.includes(planId)) throw new ApiError('notFound', 'state.notFoundHint');

      const progress = planProgressOf(student);
      const wasDone = progress.doneIds.includes(planId);
      const nextDone = done === undefined ? !wasDone : Boolean(done);

      progress.doneIds = nextDone
        ? [...new Set([...progress.doneIds, planId])]
        : progress.doneIds.filter((id) => id !== planId);

      student.planProgress = progress;
      // عدّاد الصفحات يتبع عدد البنود المنجزة فلا يفترقان.
      student.todayDone = Math.min(student.targetDaily, progress.doneIds.length);

      return { planId, done: nextDone, todayDone: student.todayDone };
    }),
  );
}

export async function getProgress(studentId) {
  return request(() => {
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const sessions = db.sessions.filter((session) => session.studentId === studentId);

    const weeks = db.weeklySeries.map((week, index) => ({
      label: week.label,
      memorization: Math.max(2, week.memorization - index),
      review: week.review,
      mastery: Math.min(99, student.masteryAvg + ((index % 3) - 1) * 4),
    }));

    const juzProgress = Array.from({ length: 30 }, (_, index) => {
      const juz = index + 1;
      const completed = juz <= student.memorizedJuz;
      const partial = juz === student.memorizedJuz + 1;
      return {
        juz,
        percent: completed ? 100 : partial ? (student.memorizedPages % 20) * 5 : 0,
      };
    });

    return {
      memorizedPages: student.memorizedPages,
      memorizedJuz: student.memorizedJuz,
      totalSessions: sessions.length,
      averageMastery: student.masteryAvg,
      attendanceRate: student.attendanceRate,
      reviewRate: student.reviewRate,
      testsAvg: student.testsAvg,
      weeks,
      juzProgress,
    };
  });
}

/** حساب حالة هدف الأجزاء: الوتيرة المطلوبة، المنجز، والمتبقي. */
function computeJuzGoal(student) {
  const goal = student.juzGoal ?? {
    targetJuz: 1,
    durationDays: 90,
    startedAt: new Date().toISOString(),
    startJuz: student.memorizedJuz,
  };

  const PAGES_PER_JUZ = 20;
  const startedAt = new Date(goal.startedAt);
  const elapsedDays = Math.max(
    0,
    Math.floor((Date.now() - startedAt.getTime()) / (24 * 60 * 60 * 1000)),
  );
  const remainingDays = Math.max(0, goal.durationDays - elapsedDays);
  const achievedJuz = Math.max(0, student.memorizedJuz - (goal.startJuz ?? 0));
  const requiredPagePerDay = (goal.targetJuz * PAGES_PER_JUZ) / Math.max(1, goal.durationDays);
  const expectedJuz = (goal.targetJuz * Math.min(elapsedDays, goal.durationDays)) / Math.max(1, goal.durationDays);

  return {
    ...goal,
    elapsedDays,
    remainingDays,
    achievedJuz,
    expectedJuz: Math.round(expectedJuz * 10) / 10,
    requiredPagePerDay: Math.round(requiredPagePerDay * 10) / 10,
    progressPercent: Math.min(100, Math.round((achievedJuz / Math.max(1, goal.targetJuz)) * 100)),
    pace: achievedJuz >= expectedJuz + 0.5 ? 'ahead' : achievedJuz + 0.5 < expectedJuz ? 'behind' : 'onTrack',
  };
}

export async function updateJuzGoal(studentId, { targetJuz, durationDays }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      const juz = Math.max(1, Math.min(30, Number(targetJuz) || 1));
      // أقصى مدة للهدف سنة واحدة.
      const days = Math.max(30, Math.min(365, Number(durationDays) || 90));

      student.juzGoal = {
        targetJuz: juz,
        durationDays: days,
        startedAt: new Date().toISOString(),
        startJuz: student.memorizedJuz,
      };
      return computeJuzGoal(student);
    }),
  );
}

export async function getGoals(studentId) {
  return request(() => {
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const attendance = db.attendance.filter((row) => row.studentId === studentId);
    const presentDays = attendance.filter((row) => row.status === 'present').length;

    return {
      juzGoal: computeJuzGoal(student),
      memorizedJuz: student.memorizedJuz,
      targetDaily: student.targetDaily,
      targetWeekly: student.targetWeekly,
      todayDone: student.todayDone,
      streak: student.streak,
      commitmentRate: Math.round((presentDays / Math.max(1, attendance.length)) * 100),
      history: db.weeklySeries.map((week) => ({
        label: week.label,
        planned: student.targetWeekly,
        done: Math.min(student.targetWeekly, week.memorization),
      })),
    };
  });
}

export async function updateGoals(studentId, { targetDaily, targetWeekly }) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');
      if (targetDaily != null) student.targetDaily = Math.max(1, Math.min(10, Number(targetDaily)));
      if (targetWeekly != null)
        student.targetWeekly = Math.max(1, Math.min(60, Number(targetWeekly)));
      return { targetDaily: student.targetDaily, targetWeekly: student.targetWeekly };
    }),
  );
}

export async function getSessions(studentId, { type = 'all' } = {}) {
  return request(() => {
    const db = getDb();
    return db.sessions
      .filter((session) => session.studentId === studentId)
      .filter((session) => (type === 'all' ? true : session.type === type))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .map((session) => ({ ...session, surahName: getSurahName(session.surahNumber) }));
  });
}

export async function saveRecitationSession(studentId, payload) {
  return request(() =>
    mutateDb((db) => {
      const student = db.students.find((item) => item.id === studentId);
      if (!student) throw new ApiError('notFound', 'state.notFoundHint');

      const session = {
        id: `session-live-${Date.now()}`,
        studentId,
        teacherId: student.teacherId,
        circleId: student.circleId,
        type: 'review',
        surahNumber: payload.surahNumber,
        fromAyah: payload.fromAyah,
        toAyah: payload.toAyah,
        mastery: payload.mastery,
        grade:
          payload.mastery >= 90 ? 'excellent' : payload.mastery >= 75 ? 'good' : 'needsWork',
        durationSeconds: payload.durationSeconds ?? 0,
        notes: '',
        createdAt: new Date().toISOString(),
      };

      db.sessions.unshift(session);
      student.todayDone = Math.min(student.targetDaily, student.todayDone + 1);
      student.lastRecitationAt = session.createdAt;
      student.masteryAvg = Math.round((student.masteryAvg * 3 + payload.mastery) / 4);

      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'session',
        createdAt: session.createdAt,
        read: false,
        link: '/app/student/progress',
        roles: ['student'],
      });

      return { ...session, surahName: getSurahName(session.surahNumber) };
    }),
  );
}

export async function getStudentReport(studentId, { period = 'weekly' } = {}) {
  return request(() => {
    const student = getStudent(studentId);
    if (!student) throw new ApiError('notFound', 'state.notFoundHint');
    const db = getDb();
    const sessions = db.sessions.filter((session) => session.studentId === studentId);
    const attendance = db.attendance.filter((row) => row.studentId === studentId);
    const windowDays = period === 'daily' ? 1 : period === 'weekly' ? 7 : 30;
    const since = Date.now() - windowDays * 24 * 60 * 60 * 1000;
    const windowSessions = sessions.filter(
      (session) => new Date(session.createdAt).getTime() >= since,
    );

    return {
      period,
      student: { id: student.id, name: student.name },
      pagesMemorized: Math.max(1, Math.round(windowSessions.length * 0.8)),
      pagesReviewed: windowSessions.length * 2,
      sessionsCount: windowSessions.length,
      averageMastery: summarizeSessions(windowSessions).avgMastery || student.masteryAvg,
      attendanceRate: Math.round(
        (attendance.filter((row) => row.status === 'present').length /
          Math.max(1, attendance.length)) *
          100,
      ),
      testsAverage: student.testsAvg,
      series: db.weeklySeries.map((week) => ({
        label: week.label,
        memorization: week.memorization,
        review: week.review,
        tests: week.tests,
      })),
      rows: windowSessions.slice(0, 12).map((session) => ({
        id: session.id,
        date: session.createdAt,
        type: session.type,
        surahName: getSurahName(session.surahNumber),
        range: `${session.fromAyah}–${session.toAyah}`,
        mastery: session.mastery,
      })),
    };
  });
}
