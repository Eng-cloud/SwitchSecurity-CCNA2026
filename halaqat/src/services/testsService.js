/**
 * خدمة الاختبارات — أسئلة مولّدة حتميًا من السور المتضمَّنة نصوصها.
 * أنواع الأسئلة: إكمال الآية، عدد الآيات، نوع السورة، ترتيب السورة.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb, getStudent } from '../mock/db.js';
import { SURAHS_WITH_TEXT, getSurahAyat } from '../mock/quran.js';

function shuffleDeterministic(items, seed) {
  const array = [...items];
  let value = seed;
  for (let i = array.length - 1; i > 0; i -= 1) {
    value = (value * 1103515245 + 12345) % 2147483648;
    const j = value % (i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function buildQuestions(seed, count) {
  const pool = SURAHS_WITH_TEXT.filter((surah) => surah.ayahCount >= 3);
  const questions = [];

  for (let index = 0; index < count; index += 1) {
    const surah = pool[(seed + index * 3) % pool.length];
    const kind = (seed + index) % 4;
    const ayat = getSurahAyat(surah.number);

    if (kind === 0 && ayat.length >= 2) {
      const ayahIndex = (seed + index) % (ayat.length - 1);
      const question = ayat[ayahIndex];
      const answer = ayat[ayahIndex + 1];
      const distractors = pool
        .filter((item) => item.number !== surah.number)
        .slice(0, 3)
        .map((item) => getSurahAyat(item.number)[0]?.text)
        .filter(Boolean);

      questions.push({
        id: `q-${index}`,
        type: 'completion',
        prompt: 'أكمل الآية التالية:',
        context: question.text,
        options: shuffleDeterministic([answer.text, ...distractors].slice(0, 4), seed + index),
        correct: answer.text,
        meta: `${surah.name}`,
      });
    } else if (kind === 1) {
      const wrong = [surah.ayahCount + 2, surah.ayahCount - 1, surah.ayahCount + 5].map((value) =>
        String(Math.max(1, value)),
      );
      questions.push({
        id: `q-${index}`,
        type: 'count',
        prompt: `كم عدد آيات سورة ${surah.name}؟`,
        context: null,
        options: shuffleDeterministic(
          [...new Set([String(surah.ayahCount), ...wrong])].slice(0, 4),
          seed + index,
        ),
        correct: String(surah.ayahCount),
        meta: `سورة ${surah.name}`,
      });
    } else if (kind === 2) {
      questions.push({
        id: `q-${index}`,
        type: 'revelation',
        prompt: `سورة ${surah.name} — مكية أم مدنية؟`,
        context: null,
        options: ['مكية', 'مدنية'],
        correct: surah.revelation === 'makki' ? 'مكية' : 'مدنية',
        meta: `سورة ${surah.name}`,
      });
    } else {
      const wrong = [surah.number + 1, surah.number - 1, surah.number + 3]
        .filter((value) => value > 0 && value <= 114)
        .map(String);
      questions.push({
        id: `q-${index}`,
        type: 'order',
        prompt: `ما ترتيب سورة ${surah.name} في المصحف؟`,
        context: null,
        options: shuffleDeterministic(
          [...new Set([String(surah.number), ...wrong])].slice(0, 4),
          seed + index,
        ),
        correct: String(surah.number),
        meta: `سورة ${surah.name}`,
      });
    }
  }

  return questions;
}

export async function listTests(studentId) {
  return request(() => {
    const db = getDb();
    return db.tests.map((test) => {
      const attempt = db.testAttempts.find(
        (item) => item.testId === test.id && item.studentId === studentId,
      );
      return {
        ...test,
        attempt: attempt ? { score: attempt.score, submittedAt: attempt.submittedAt } : null,
        status: attempt ? 'completed' : test.status,
      };
    });
  });
}

export async function getTest(testId) {
  return request(() => {
    const test = getDb().tests.find((item) => item.id === testId);
    if (!test) throw new ApiError('notFound', 'state.notFoundHint');
    const seed = test.scope === 'weekly' ? 41 : 97;
    return {
      ...test,
      questions: buildQuestions(seed, test.questionCount),
    };
  });
}

export async function submitTest(testId, studentId, answers) {
  return request(() =>
    mutateDb((db) => {
      const test = db.tests.find((item) => item.id === testId);
      if (!test) throw new ApiError('notFound', 'state.notFoundHint');
      const seed = test.scope === 'weekly' ? 41 : 97;
      const questions = buildQuestions(seed, test.questionCount);

      const details = questions.map((question) => ({
        id: question.id,
        prompt: question.prompt,
        context: question.context,
        correct: question.correct,
        answer: answers?.[question.id] ?? null,
        isCorrect: answers?.[question.id] === question.correct,
      }));

      const correctCount = details.filter((item) => item.isCorrect).length;
      const score = Math.round((correctCount / questions.length) * 100);

      const attempt = {
        id: `attempt-${Date.now()}`,
        testId,
        studentId,
        score,
        correctCount,
        totalCount: questions.length,
        details,
        submittedAt: new Date().toISOString(),
      };

      db.testAttempts = db.testAttempts.filter(
        (item) => !(item.testId === testId && item.studentId === studentId),
      );
      db.testAttempts.unshift(attempt);

      const student = getStudent(studentId);
      if (student) student.testsAvg = Math.round((student.testsAvg + score) / 2);

      db.notifications.unshift({
        id: `notif-${Date.now()}`,
        typeKey: 'test',
        createdAt: attempt.submittedAt,
        read: false,
        link: '/app/student/tests',
        roles: ['student', 'parent'],
      });

      return attempt;
    }),
  );
}

export async function getAttempt(testId, studentId) {
  return request(() => {
    const attempt = getDb().testAttempts.find(
      (item) => item.testId === testId && item.studentId === studentId,
    );
    if (!attempt) throw new ApiError('notFound', 'state.notFoundHint');
    return attempt;
  });
}
