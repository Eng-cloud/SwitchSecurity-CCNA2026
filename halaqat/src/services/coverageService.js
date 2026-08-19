/**
 * خدمة التغطية والإنابة — «من يقود الحلقة اليوم؟»
 *
 * الحلقة موعدٌ لا يُلغى بغياب معلّمها. لذلك تبدأ هذه الخدمة من سؤال واحد
 * تُجيب عنه كل صباح: هل لهذه الحلقة اليوم من يقودها؟
 *
 * السلسلة كاملة وبلا حلقة مفقودة:
 *   المعلم يسجّل حضوره ← إن غاب طلب نائبًا ← النائب يقبل أو يعتذر
 *   ← إن لم يقبل أحد صعدت المسؤولية إلى المشرف ← والمشرف يعيّن بديلًا
 *   أو يتولّاها بنفسه.
 *
 * النائب لا يُرقّى: دوره يبقى معلمًا كما هو، وسلطته محصورة بحلقةٍ واحدة
 * في يومٍ واحد، ومصدرها بيانات الإنابة لا مصفوفة الصلاحيات. وتسقط عنه
 * ساعة تنتهي الإنابة أو يعود صاحب الحلقة.
 *
 * تنبيه: نسخة تجريبية بلا خادم — هذه قواعد واجهة لا تفويض أمني.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb } from '../mock/db.js';
import { can, ACTIONS } from '../config/permissions.js';
import { toISODate } from '../lib/format.js';
import { monthRange } from './distinguishedService.js';

/** ثلاث حالات لحضور المعلم، كحضور الطالب سواءً بسواء. */
export const TEACHER_STATUSES = ['present', 'absent', 'excused'];

/** الحالتان اللتان تتركان الحلقة بلا معلّم فتستدعيان الإنابة. */
export const ABSENT_STATUSES = ['absent', 'excused'];

/**
 * حالات التغطية — ترتيبها هنا هو ترتيب إلحاحها عند المشرف.
 *  needsCover: الحلقة بلا معلّم ولم يُطلب أحد. وهي حالة اليوم قبل أن
 *              يسجّل المعلم حضوره: الأصل أن تُثبَت التغطية لا أن تُفترض.
 *  escalated : طُلب نائب فاعتذر — المسؤولية على المشرف.
 *  pending   : طلبٌ بانتظار ردّ.
 *  deputized : نائب قَبِل ويقود الحلقة.
 *  onSite    : المعلم نفسه موجود.
 */
export const COVERAGE_ORDER = ['needsCover', 'escalated', 'pending', 'deputized', 'onSite'];

const OPEN_DEPUTATION = ['pending', 'active'];

/* ---------------------------------------------------------------
   قراءات أساسية
   --------------------------------------------------------------- */

function today() {
  return toISODate(new Date());
}

function circleOf(db, circleId) {
  const circle = db.circles.find((item) => item.id === circleId);
  if (!circle) throw new ApiError('notFound', 'state.notFoundHint');
  return circle;
}

function userOf(db, userId) {
  return db.users.find((item) => item.id === userId) ?? null;
}

function attendanceRows(db) {
  if (!Array.isArray(db.circleAttendance)) db.circleAttendance = [];
  return db.circleAttendance;
}

function deputationRows(db) {
  if (!Array.isArray(db.deputations)) db.deputations = [];
  return db.deputations;
}

function attendanceOf(db, circleId, date) {
  return attendanceRows(db).find((row) => row.circleId === circleId && row.date === date) ?? null;
}

/** آخر إنابة تخصّ هذه الحلقة في هذا اليوم — المفتوحة أولًا ثم المنتهية. */
function deputationOf(db, circleId, date) {
  const rows = deputationRows(db).filter(
    (row) => row.circleId === circleId && row.date === date,
  );
  return rows.find((row) => OPEN_DEPUTATION.includes(row.status)) ?? rows[0] ?? null;
}

/**
 * حالة تغطية الحلقة في يوم بعينه.
 * دالة خالصة تُشتق من السجلين معًا، فلا تُخزَّن حالة مشتقّة تتناقض مع أصلها.
 */
export function coverageOf(db, circleId, date) {
  const attendance = attendanceOf(db, circleId, date);
  const teacherStatus = attendance?.status ?? 'absent';
  const deputation = deputationOf(db, circleId, date);

  let state;
  if (!ABSENT_STATUSES.includes(teacherStatus)) state = 'onSite';
  else if (deputation?.status === 'active') state = 'deputized';
  else if (deputation?.status === 'pending') state = 'pending';
  else if (deputation?.status === 'declined') state = 'escalated';
  else state = 'needsCover';

  return { state, teacherStatus, attendance, deputation };
}

/** هل تحتاج هذه الحالة تدخّل المشرف؟ */
export function needsSupervisor(state) {
  return state === 'needsCover' || state === 'escalated';
}

/* ---------------------------------------------------------------
   السلطة على الحلقة
   --------------------------------------------------------------- */

/**
 * من يملك التصرّف في هذه الحلقة اليوم — ولماذا.
 *
 * أربعة مصادر لا خامس لها، ومصدر النائب بيانات لا دور: إنابة نشِطة
 * تحمل اسمه في هذه الحلقة وهذا اليوم.
 */
export function authorityOver(db, { role, userId, circleId, date = today() }) {
  const circle = db.circles.find((item) => item.id === circleId);
  if (!circle) return { allowed: false, as: null };

  if (role === 'admin') return { allowed: true, as: 'admin' };

  if (role === 'supervisor' && circle.supervisorId === userId) {
    return { allowed: true, as: 'supervisor' };
  }

  if (role === 'teacher') {
    if (circle.teacherId === userId) return { allowed: true, as: 'teacher' };

    const deputation = deputationOf(db, circleId, date);
    if (deputation?.status === 'active' && deputation.deputyId === userId) {
      return { allowed: true, as: 'deputy', deputation };
    }
  }

  return { allowed: false, as: null };
}

/**
 * يرمي إن لم يكن للفاعل سلطة، ويعيد نوعها إن كانت.
 *
 * شرطان لا شرط: صلاحية إدارة التغطية في المصفوفة، وسلطةٌ على هذه الحلقة
 * بعينها. الأولى تُخرج من لا شأن له باليوم أصلًا (الإدارة تقرأ ولا
 * تتدخّل)، والثانية تحصر من له شأنٌ به في حلقاته.
 */
function requireAuthority(db, { role, userId, circleId, date, allow }) {
  if (!can(role, ACTIONS.COVERAGE_MANAGE)) {
    throw new ApiError('forbidden', 'coverage.errors.notFieldRole');
  }
  const authority = authorityOver(db, { role, userId, circleId, date });
  if (!authority.allowed) throw new ApiError('forbidden', 'state.forbiddenHint');
  if (allow && !allow.includes(authority.as)) {
    throw new ApiError('forbidden', 'state.forbiddenHint');
  }
  return authority;
}

/* ---------------------------------------------------------------
   تشكيل المخرجات
   --------------------------------------------------------------- */

function shapeDeputation(db, deputation) {
  if (!deputation) return null;
  const circle = db.circles.find((item) => item.id === deputation.circleId);
  return {
    ...deputation,
    circleName: circle?.name ?? '',
    absentTeacherName: userOf(db, deputation.absentTeacherId)?.name ?? '',
  };
}

function shapeDay(db, circle, date) {
  const { state, teacherStatus, attendance, deputation } = coverageOf(db, circle.id, date);
  const teacher = userOf(db, circle.teacherId);

  return {
    circleId: circle.id,
    circleName: circle.name,
    date,
    days: circle.days ?? '',
    startTime: circle.startTime ?? '',
    endTime: circle.endTime ?? '',
    // موقع الحلقة يسافر مع صفّها: التغطية تُقرأ جغرافيًّا لا بأسماء الحلقات.
    city: circle.city ?? '',
    district: circle.district ?? '',
    mosque: circle.mosque ?? '',
    supervisorId: circle.supervisorId,
    teacher: teacher ? { id: teacher.id, name: teacher.name, status: teacher.status } : null,
    teacherStatus,
    note: attendance?.note ?? '',
    recordedByRole: attendance?.recordedByRole ?? null,
    recordedByName: attendance?.recordedByName ?? null,
    state,
    needsSupervisor: needsSupervisor(state),
    deputation: shapeDeputation(db, deputation),
  };
}

/* ---------------------------------------------------------------
   حضور المعلم
   --------------------------------------------------------------- */

/**
 * يضبط حضور معلّم الحلقة في يومه — بيده أو بيد مشرفه.
 *
 * النائب مستثنى عمدًا: من ينوب عن غائب لا يقرّر حضور الغائب.
 * وعودة المعلم حاضرًا تُنهي الإنابة القائمة تلقائيًا، فلا تبقى سلطتان
 * على حلقة واحدة في وقت واحد. والعكس صحيح: تسجيلُه غائبًا بعد حضورٍ
 * خاطئ يعيد الحلقة إلى طلب التغطية.
 */
export async function setTeacherAttendance({
  role,
  userId,
  userName,
  circleId,
  status,
  note = '',
  date = today(),
}) {
  return request(() =>
    mutateDb((db) => {
      const circle = circleOf(db, circleId);
      requireAuthority(db, {
        role,
        userId,
        circleId,
        date,
        allow: ['teacher', 'supervisor', 'admin'],
      });

      const rows = attendanceRows(db);
      const index = rows.findIndex((row) => row.circleId === circleId && row.date === date);
      const open = deputationRows(db).find(
        (row) =>
          row.circleId === circleId && row.date === date && OPEN_DEPUTATION.includes(row.status),
      );

      if (!TEACHER_STATUSES.includes(status)) {
        throw new ApiError('validation', 'coverage.errors.invalidStatus');
      }

      const record = {
        id: `cat-${circleId}-${date}`,
        circleId,
        teacherId: circle.teacherId,
        date,
        status,
        note: String(note ?? '').trim().slice(0, 200),
        recordedBy: userId,
        recordedByRole: role,
        recordedByName: userName ?? userOf(db, userId)?.name ?? '',
        recordedAt: new Date().toISOString(),
      };

      if (index >= 0) rows[index] = { ...rows[index], ...record };
      else rows.unshift(record);

      // حضر المعلم ⇐ لا حاجة لمن ينوب عنه.
      if (!ABSENT_STATUSES.includes(status) && open) {
        open.status = 'ended';
        open.endedAt = new Date().toISOString();
        open.endedReason = 'teacherReturned';
      }

      return shapeDay(db, circle, date);
    }),
  );
}

/* ---------------------------------------------------------------
   الإنابة
   --------------------------------------------------------------- */

/**
 * المرشّحون للإنابة: معلمون نشِطون غير صاحب الحلقة.
 * من غاب اليوم عن حلقته أو ارتبط بإنابة أخرى يظهر موسومًا بأنه مرتبط،
 * فيرى الطالبُ سببَ استبعاده بدل أن يختفي الاسم بلا تفسير.
 */
export async function listDeputyCandidates({ role, userId, circleId, date = today() }) {
  return request(() => {
    const db = getDb();
    const circle = circleOf(db, circleId);
    requireAuthority(db, {
      role,
      userId,
      circleId,
      date,
      allow: ['teacher', 'supervisor', 'admin'],
    });

    return db.users
      .filter(
        (user) =>
          user.role === 'teacher' && user.status === 'active' && user.id !== circle.teacherId,
      )
      .map((user) => {
        const own = db.circles.find((item) => item.teacherId === user.id);
        const committed = deputationRows(db).some(
          (row) =>
            row.date === date && row.deputyId === user.id && OPEN_DEPUTATION.includes(row.status),
        );
        // «غائب» هنا تعني غيابًا مُسجَّلًا لا مفترضًا: افتراض التغطية يصلح
        // لتنبيه المشرف، ولا يصلح لاستبعاد معلمٍ لم يقل شيئًا بعد.
        const ownRecord = own ? attendanceOf(db, own.id, date) : null;
        const away = ownRecord ? ABSENT_STATUSES.includes(ownRecord.status) : false;

        return {
          id: user.id,
          name: user.name,
          circleName: own?.name ?? '',
          busy: committed || away,
          busyReason: committed ? 'deputizing' : away ? 'away' : null,
        };
      })
      .sort((a, b) => Number(a.busy) - Number(b.busy) || a.name.localeCompare(b.name, 'ar'));
  });
}

/**
 * يطلب من معلمٍ آخر أن ينوب عن الغائب.
 * لا يُطلب إلا لحلقةٍ فقدت معلّمها فعلًا — الطلب بلا غياب بابٌ لإنابات
 * معلّقة بلا معنى.
 */
export async function requestDeputy({
  role,
  userId,
  userName,
  circleId,
  deputyId,
  note = '',
  date = today(),
}) {
  return request(() =>
    mutateDb((db) => {
      const circle = circleOf(db, circleId);
      requireAuthority(db, {
        role,
        userId,
        circleId,
        date,
        allow: ['teacher', 'supervisor', 'admin'],
      });

      const { state } = coverageOf(db, circle.id, date);
      if (!needsSupervisor(state)) {
        throw new ApiError('conflict', 'coverage.errors.notNeeded');
      }

      const deputy = userOf(db, deputyId);
      if (!deputy || deputy.role !== 'teacher' || deputy.status !== 'active') {
        throw new ApiError('validation', 'coverage.errors.invalidDeputy');
      }
      if (deputy.id === circle.teacherId) {
        throw new ApiError('validation', 'coverage.errors.selfDeputy');
      }

      const committed = deputationRows(db).some(
        (row) =>
          row.date === date && row.deputyId === deputyId && OPEN_DEPUTATION.includes(row.status),
      );
      if (committed) throw new ApiError('conflict', 'coverage.errors.deputyBusy');

      const now = new Date().toISOString();
      const deputation = {
        id: `dep-${circleId}-${date}-${deputationRows(db).length + 1}`,
        circleId,
        date,
        absentTeacherId: circle.teacherId,
        deputyId,
        deputyName: deputy.name,
        deputyRole: 'teacher',
        status: 'pending',
        note: String(note ?? '').trim().slice(0, 200),
        requestedBy: userId,
        requestedByRole: role,
        requestedByName: userName ?? userOf(db, userId)?.name ?? '',
        requestedAt: now,
        respondedAt: null,
        declineReason: null,
        endedAt: null,
        endedReason: null,
      };

      deputationRows(db).unshift(deputation);
      db.notifications.unshift({
        id: `notif-dep-${Date.now()}`,
        typeKey: 'deputyRequest',
        createdAt: now,
        read: false,
        link: '/app/teacher',
        roles: ['teacher'],
      });

      return shapeDay(db, circle, date);
    }),
  );
}

/** النائب وحده يردّ على طلبه: قبولًا أو اعتذارًا. */
export async function respondToDeputy({ userId, deputationId, accept, reason = '' }) {
  return request(() =>
    mutateDb((db) => {
      const deputation = deputationRows(db).find((row) => row.id === deputationId);
      if (!deputation) throw new ApiError('notFound', 'state.notFoundHint');
      if (deputation.deputyId !== userId) throw new ApiError('forbidden', 'state.forbiddenHint');
      if (deputation.status !== 'pending') {
        throw new ApiError('conflict', 'coverage.errors.alreadyAnswered');
      }

      const now = new Date().toISOString();
      deputation.status = accept ? 'active' : 'declined';
      deputation.respondedAt = now;
      deputation.declineReason = accept ? null : String(reason ?? '').trim().slice(0, 200);

      // الاعتذار ليس نهاية الطريق بل تحويلة: المشرف يُخطَر ليتصرّف.
      db.notifications.unshift({
        id: `notif-dep-${Date.now()}`,
        typeKey: accept ? 'deputyAccepted' : 'deputyDeclined',
        createdAt: now,
        read: false,
        linkByRole: {
          supervisor: '/app/supervisor/coverage',
          admin: '/app/admin/circles',
          teacher: '/app/teacher',
        },
        roles: accept ? ['teacher', 'supervisor'] : ['supervisor', 'admin', 'teacher'],
      });

      const circle = circleOf(db, deputation.circleId);
      return shapeDay(db, circle, deputation.date);
    }),
  );
}

/**
 * المشرف يتولّى الحلقة بنفسه — آخر حلقة في السلسلة.
 * لا تُترك حلقة بلا قائد لأن أحدًا لم يقبل: من يشرف عليها يقودها.
 */
export async function claimCoverage({ role, userId, userName, circleId, date = today() }) {
  return request(() =>
    mutateDb((db) => {
      const circle = circleOf(db, circleId);
      requireAuthority(db, { role, userId, circleId, date, allow: ['supervisor', 'admin'] });

      const { state } = coverageOf(db, circle.id, date);
      if (state === 'onSite') throw new ApiError('conflict', 'coverage.errors.notNeeded');
      if (state === 'deputized') throw new ApiError('conflict', 'coverage.errors.alreadyCovered');

      const now = new Date().toISOString();
      // طلبٌ معلّق لم يعد له معنى بعد أن تولّاها المشرف.
      deputationRows(db)
        .filter(
          (row) => row.circleId === circleId && row.date === date && row.status === 'pending',
        )
        .forEach((row) => {
          row.status = 'ended';
          row.endedAt = now;
          row.endedReason = 'superseded';
        });

      deputationRows(db).unshift({
        id: `dep-${circleId}-${date}-self-${deputationRows(db).length + 1}`,
        circleId,
        date,
        absentTeacherId: circle.teacherId,
        deputyId: userId,
        deputyName: userName ?? userOf(db, userId)?.name ?? '',
        deputyRole: role,
        status: 'active',
        note: '',
        requestedBy: userId,
        requestedByRole: role,
        requestedByName: userName ?? userOf(db, userId)?.name ?? '',
        requestedAt: now,
        respondedAt: now,
        declineReason: null,
        endedAt: null,
        endedReason: null,
      });

      return shapeDay(db, circle, date);
    }),
  );
}

/** إنهاء الإنابة مبكرًا — لصاحب الحلقة أو لمن يشرف عليها. */
export async function endDeputation({ role, userId, deputationId }) {
  return request(() =>
    mutateDb((db) => {
      const deputation = deputationRows(db).find((row) => row.id === deputationId);
      if (!deputation) throw new ApiError('notFound', 'state.notFoundHint');
      if (!OPEN_DEPUTATION.includes(deputation.status)) {
        throw new ApiError('conflict', 'coverage.errors.alreadyEnded');
      }
      requireAuthority(db, {
        role,
        userId,
        circleId: deputation.circleId,
        date: deputation.date,
        allow: ['teacher', 'supervisor', 'admin'],
      });

      deputation.status = 'ended';
      deputation.endedAt = new Date().toISOString();
      deputation.endedReason = 'manual';

      const circle = circleOf(db, deputation.circleId);
      return shapeDay(db, circle, deputation.date);
    }),
  );
}

/* ---------------------------------------------------------------
   قراءات الواجهات
   --------------------------------------------------------------- */

/** يوم حلقةٍ واحدة كما تحتاجه شاشة المعلم أو المشرف. */
export async function getCircleDay({ role, userId, circleId, date = today() }) {
  return request(() => {
    const db = getDb();
    const circle = circleOf(db, circleId);
    const authority = authorityOver(db, { role, userId, circleId, date });
    return { ...shapeDay(db, circle, date), authority: authority.as, mayManage: authority.allowed };
  });
}

/**
 * لوحة التغطية عند المشرف: حلقاته اليوم مرتّبة بإلحاحها.
 * ما يحتاج تدخّلًا يتصدّر، لأن اللوحة تُقرأ من أعلاها.
 */
export async function listCoverage({
  role,
  userId,
  date = today(),
  city = 'all',
  district = 'all',
  mosque = 'all',
} = {}) {
  return request(() => {
    const db = getDb();
    if (!can(role, ACTIONS.COVERAGE_REPORT)) {
      throw new ApiError('forbidden', 'state.forbiddenHint');
    }

    const scope =
      role === 'admin'
        ? db.circles
        : db.circles.filter((circle) => circle.supervisorId === userId);

    // خيارات الفلاتر تُشتق من النطاق قبل تصفيته، وإلا اختفى الخيار الذي
    // يقف عليه المستخدم من قائمته.
    const optionsOf = (key) =>
      [...new Set(scope.map((circle) => circle[key]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ar'),
      );

    const filtered = scope.filter(
      (circle) =>
        (city === 'all' || circle.city === city) &&
        (district === 'all' || circle.district === district) &&
        (mosque === 'all' || circle.mosque === mosque),
    );

    const rows = filtered
      .map((circle) => shapeDay(db, circle, date))
      .sort(
        (a, b) =>
          COVERAGE_ORDER.indexOf(a.state) - COVERAGE_ORDER.indexOf(b.state) ||
          a.city.localeCompare(b.city, 'ar') ||
          a.district.localeCompare(b.district, 'ar'),
      );

    return {
      date,
      filters: { city, district, mosque },
      options: {
        cities: optionsOf('city'),
        districts: optionsOf('district'),
        mosques: optionsOf('mosque'),
      },
      rows,
      gaps: rows.filter((row) => row.needsSupervisor).length,
      covered: rows.filter((row) => row.state === 'onSite' || row.state === 'deputized').length,
    };
  });
}

/** صندوق النائب: ما طُلب منه اليوم وما يقوده فعلًا. */
export async function getDeputyInbox({ userId, date = today() }) {
  return request(() => {
    const db = getDb();
    const mine = deputationRows(db).filter(
      (row) => row.deputyId === userId && row.date === date,
    );

    return {
      date,
      pending: mine.filter((row) => row.status === 'pending').map((row) => shapeDeputation(db, row)),
      active: mine.filter((row) => row.status === 'active').map((row) => shapeDeputation(db, row)),
    };
  });
}

/* ---------------------------------------------------------------
   تقرير الشهر — متى حضر المعلم ومتى غاب ومتى استأذن
   --------------------------------------------------------------- */

/** أيام الشهر التي مرّت فعلًا: لا يُحسب على المعلم غدٌ لم يأتِ. */
function elapsedDays(range, now = new Date()) {
  const end = range.end.getTime() < now.getTime() ? range.end : now;
  const days = [];
  for (
    let cursor = new Date(range.start);
    cursor.getTime() <= end.getTime();
    cursor.setDate(cursor.getDate() + 1)
  ) {
    days.push(toISODate(cursor));
  }
  return days;
}

/**
 * سجلّ حضور المعلمين في شهر.
 *
 * هذا ما يُقرأ في آخر الشهر لا في أثنائه: صفٌّ لكل معلم فيه عدد أيام
 * حضوره وغيابه واستئذانه، ومعه الأيام نفسها مؤرَّخة — فمن سأل «متى غاب؟»
 * وجد التاريخ لا الرقم وحده.
 *
 * الأيام التي لم يُسجَّل فيها شيء تُحسب غيابًا، على القاعدة نفسها التي
 * تقرأ بها التغطية يومَها: من لم يُسجَّل حضوره لم يحضر.
 */
export async function getTeacherAttendanceReport({
  role,
  userId,
  month = 'current',
  city = 'all',
  district = 'all',
  mosque = 'all',
} = {}) {
  return request(() => {
    const db = getDb();
    if (!can(role, ACTIONS.COVERAGE_REPORT)) {
      throw new ApiError('forbidden', 'state.forbiddenHint');
    }

    const range = monthRange(month);
    const days = elapsedDays(range);

    const scope =
      role === 'admin'
        ? db.circles
        : db.circles.filter((circle) => circle.supervisorId === userId);

    const optionsOf = (key) =>
      [...new Set(scope.map((circle) => circle[key]).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b, 'ar'),
      );

    const filtered = scope.filter(
      (circle) =>
        (city === 'all' || circle.city === city) &&
        (district === 'all' || circle.district === district) &&
        (mosque === 'all' || circle.mosque === mosque),
    );

    const rows = filtered
      .filter((circle) => circle.teacherId)
      .map((circle) => {
        const teacher = userOf(db, circle.teacherId);
        const records = attendanceRows(db).filter((row) => row.circleId === circle.id);

        const byDay = days.map((day) => {
          const record = records.find((row) => row.date === day);
          return {
            date: day,
            status: record?.status ?? 'absent',
            note: record?.note ?? '',
            recordedByRole: record?.recordedByRole ?? null,
          };
        });

        const count = (status) => byDay.filter((entry) => entry.status === status).length;
        const present = count('present');
        const absent = count('absent');
        const excused = count('excused');

        // أيام الإنابة: غيابٌ لم تتعطّل معه الحلقة، وهو فارقٌ يُذكر.
        const covered = deputationRows(db).filter(
          (row) =>
            row.circleId === circle.id && row.status === 'active' && days.includes(row.date),
        ).length;

        return {
          teacherId: teacher?.id ?? circle.teacherId,
          teacherName: teacher?.name ?? '',
          circleId: circle.id,
          circleName: circle.name,
          city: circle.city ?? '',
          district: circle.district ?? '',
          mosque: circle.mosque ?? '',
          totalDays: days.length,
          present,
          absent,
          excused,
          coveredDays: covered,
          attendanceRate: days.length === 0 ? 0 : Math.round((present / days.length) * 100),
          absentDates: byDay.filter((entry) => entry.status === 'absent').map((e) => e.date),
          excusedDates: byDay.filter((entry) => entry.status === 'excused').map((e) => e.date),
          presentDates: byDay.filter((entry) => entry.status === 'present').map((e) => e.date),
          days: byDay,
        };
      })
      // الأكثر غيابًا أولًا: التقرير يُقرأ لمن يحتاج متابعة لا لمن انضبط.
      .sort((a, b) => b.absent - a.absent || a.teacherName.localeCompare(b.teacherName, 'ar'));

    return {
      month,
      monthKey: range.key,
      days: days.length,
      filters: { city, district, mosque },
      options: {
        cities: optionsOf('city'),
        districts: optionsOf('district'),
        mosques: optionsOf('mosque'),
      },
      rows,
      totals: {
        teachers: rows.length,
        absent: rows.reduce((sum, row) => sum + row.absent, 0),
        excused: rows.reduce((sum, row) => sum + row.excused, 0),
        present: rows.reduce((sum, row) => sum + row.present, 0),
      },
    };
  });
}
