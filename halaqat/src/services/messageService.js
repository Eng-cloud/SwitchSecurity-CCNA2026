/**
 * خدمة التواصل بين ولي الأمر ومعلّم ابنه.
 *
 * محادثة واحدة لكل طالب، طرفاها اثنان لا ثالث لهما: وليّه ومعلّمه.
 * الطالب لا يقرأها لأنها عنه لا معه، والإدارة لا تدخلها لأن ما يُقال فيها
 * متابعةٌ تربوية لا سجلٌّ إداري — ومن أراد الحال العام فالتقارير مكانه.
 *
 * تنبيه: نسخة تجريبية بلا خادم — هذه قواعد واجهة لا تفويض أمني.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb } from '../mock/db.js';

const MAX_BODY = 600;
const MIN_BODY = 2;

function messages(db) {
  if (!Array.isArray(db.messages)) db.messages = [];
  return db.messages;
}

function studentOf(db, studentId) {
  const student = db.students.find((item) => item.id === studentId);
  if (!student) throw new ApiError('notFound', 'state.notFoundHint');
  return student;
}

/** وليُّ أمر الطالب: من يحمل معرّفه في قائمة أبنائه. */
function guardianOf(db, studentId) {
  return (
    db.users.find(
      (user) => user.role === 'parent' && (user.childrenIds ?? []).includes(studentId),
    ) ?? null
  );
}

/**
 * طرفا المحادثة — ومن يحقّ له دخولها.
 * ولي الأمر لابنه وحده، والمعلم لطلاب حلقته وحدهم.
 */
export function partiesOf(db, studentId, { role, userId }) {
  const student = studentOf(db, studentId);
  const guardian = guardianOf(db, studentId);
  const teacher = db.users.find((user) => user.id === student.teacherId) ?? null;

  const allowed =
    (role === 'parent' && guardian?.id === userId) ||
    (role === 'teacher' && student.teacherId === userId);

  return { student, guardian, teacher, allowed };
}

function requireParty(db, studentId, actor) {
  const parties = partiesOf(db, studentId, actor);
  if (!parties.allowed) throw new ApiError('forbidden', 'state.forbiddenHint');
  return parties;
}

/* ---------------------------------------------------------------
   القراءة
   --------------------------------------------------------------- */

/**
 * محادثة طالبٍ واحد.
 * الدخول يُعلِّم رسائل الطرف الآخر مقروءةً: من فتح المحادثة قرأها.
 */
export async function getThread({ role, userId, studentId }) {
  return request(() =>
    mutateDb((db) => {
      const { student, guardian, teacher } = requireParty(db, studentId, { role, userId });

      const thread = messages(db)
        .filter((message) => message.studentId === studentId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      const now = new Date().toISOString();
      thread.forEach((message) => {
        if (message.from !== role && !message.readAt) message.readAt = now;
      });

      return {
        studentId,
        studentName: student.name,
        guardianName: guardian?.name ?? student.guardianName ?? '',
        teacherName: teacher?.name ?? '',
        // الطرف الآخر: من تُكتب إليه الرسالة.
        counterpart: role === 'parent' ? (teacher?.name ?? '') : (guardian?.name ?? ''),
        messages: thread.map((message) => ({ ...message, mine: message.from === role })),
      };
    }),
  );
}

/** عدد ما لم يُقرأ من رسائل الطرف الآخر — للّافتة في اللوحة. */
export async function countUnread({ role, userId }) {
  return request(() => {
    const db = getDb();

    const studentIds =
      role === 'parent'
        ? (db.users.find((user) => user.id === userId)?.childrenIds ?? [])
        : db.students.filter((student) => student.teacherId === userId).map((s) => s.id);

    return messages(db).filter(
      (message) =>
        studentIds.includes(message.studentId) && message.from !== role && !message.readAt,
    ).length;
  });
}

/* ---------------------------------------------------------------
   الإرسال
   --------------------------------------------------------------- */

export async function sendMessage({ role, userId, userName, studentId, body }) {
  return request(() =>
    mutateDb((db) => {
      const { student } = requireParty(db, studentId, { role, userId });

      const text = String(body ?? '').trim();
      if (text.length < MIN_BODY) throw new ApiError('validation', 'messages.errors.empty');

      const now = new Date().toISOString();
      const message = {
        id: `msg-${Date.now()}-${messages(db).length + 1}`,
        studentId,
        circleId: student.circleId,
        from: role,
        authorId: userId,
        authorName: userName ?? db.users.find((item) => item.id === userId)?.name ?? '',
        body: text.slice(0, MAX_BODY),
        createdAt: now,
        readAt: null,
      };

      messages(db).push(message);
      db.notifications.unshift({
        id: `notif-msg-${Date.now()}`,
        typeKey: 'message',
        createdAt: now,
        read: false,
        linkByRole: {
          parent: `/app/parent/children/${studentId}`,
          teacher: `/app/teacher/students/${studentId}`,
        },
        roles: [role === 'parent' ? 'teacher' : 'parent'],
      });

      return { ...message, mine: true };
    }),
  );
}
