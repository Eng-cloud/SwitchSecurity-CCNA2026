/**
 * قاعدة بيانات وهمية (Mock Data) تُولَّد محليًا في المتصفح.
 * - التوليد حتمي (Seeded) فتبقى الأرقام ثابتة بين الجلسات وتصلح للاختبارات.
 * - التعديلات (جلسات، ملاحظات، حضور...) تُحفظ في localStorage.
 */

import { SURAHS_WITH_TEXT, SURAHS } from './quran.js';
import { readStorage, writeStorage, removeStorage, STORAGE_KEYS } from '../lib/storage.js';

const DB_VERSION = 3;

/* ---------------------------------------------------------------
   مولّد أرقام عشوائية حتمي
   --------------------------------------------------------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeRng(seed) {
  const random = mulberry32(seed);
  return {
    next: random,
    int: (min, max) => Math.floor(random() * (max - min + 1)) + min,
    pick: (arr) => arr[Math.floor(random() * arr.length)],
    bool: (probability = 0.5) => random() < probability,
    /** توزيع مائل نحو الأعلى ليبدو الأداء واقعيًا */
    score: (min = 55, max = 99) => {
      const base = random() * random();
      return Math.round(max - base * (max - min));
    },
  };
}

/* ---------------------------------------------------------------
   قوائم أسماء
   --------------------------------------------------------------- */
const MALE_FIRST = [
  'عبدالله', 'محمد', 'أحمد', 'خالد', 'يوسف', 'عمر', 'سلمان', 'إبراهيم', 'حمزة', 'زياد',
  'فيصل', 'ماجد', 'راكان', 'بدر', 'ياسر', 'أنس', 'مصعب', 'طلال', 'سعد', 'نايف',
  'وليد', 'هيثم', 'تركي', 'مهند', 'عبدالرحمن', 'صالح', 'ريان', 'معاذ', 'أيمن', 'بندر',
];

const FAMILY = [
  'العتيبي', 'الحربي', 'القحطاني', 'الشهري', 'الزهراني', 'الغامدي', 'الدوسري', 'المالكي',
  'السبيعي', 'الأنصاري', 'البقمي', 'الشمري', 'العنزي', 'المطيري', 'الرشيدي', 'الخالدي',
  'اليامي', 'الصاعدي', 'البلوي', 'الجهني',
];

const CIRCLE_NAMES = [
  'حلقة النور', 'حلقة الفرقان', 'حلقة السكينة', 'حلقة البيان', 'حلقة الهدى', 'حلقة الرشاد',
];

const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'أبها', 'بريدة'];

const DISTRICTS = [
  'حي النرجس', 'حي الياسمين', 'حي الملقا', 'حي الروضة', 'حي السلامة',
  'حي الشاطئ', 'حي العزيزية', 'حي الخالدية', 'حي المروج', 'حي قرطبة',
];

const MOSQUES = [
  'جامع الرحمة', 'جامع التقوى', 'جامع الفرقان', 'جامع النور',
  'جامع السلام', 'جامع الإيمان', 'جامع الهدى',
];

const SCHEDULES = [
  'الأحد – الخميس · بعد المغرب',
  'السبت – الأربعاء · بعد العصر',
  'الأحد – الخميس · بعد الفجر',
];

const LOCATIONS = ['جامع الرحمة', 'جامع التقوى', 'جامع الفرقان', 'مركز الحلقات النموذجي'];

const LEVELS = ['beginner', 'intermediate', 'advanced'];

function fullName(rng) {
  return `${rng.pick(MALE_FIRST)} ${rng.pick(FAMILY)}`;
}

function daysAgo(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/* ---------------------------------------------------------------
   الحسابات التجريبية الثابتة
   --------------------------------------------------------------- */
export const DEMO_ACCOUNTS = [
  { role: 'student', email: 'student@demo.local' },
  { role: 'teacher', email: 'teacher@demo.local' },
  { role: 'supervisor', email: 'supervisor@demo.local' },
  { role: 'admin', email: 'admin@demo.local' },
  { role: 'parent', email: 'parent@demo.local' },
];

export const DEMO_OTP = '123456';

/* ---------------------------------------------------------------
   التوليد
   --------------------------------------------------------------- */
function generate() {
  const rng = makeRng(20260817);

  const users = [];
  const circles = [];
  const students = [];
  const sessions = [];
  const notes = [];
  const attendance = [];
  const notifications = [];

  let idCounter = 0;
  const nextId = (prefix) => `${prefix}-${String(++idCounter).padStart(4, '0')}`;

  /* --- الإدارة --- */
  const admin = {
    id: 'user-admin',
    name: 'سارة القحطاني',
    role: 'admin',
    email: 'admin@demo.local',
    phone: '0500000004',
    city: 'الرياض',
    joinedAt: daysAgo(720),
    status: 'active',
    title: 'مديرة المنصة',
  };
  users.push(admin);

  /* --- المشرفون --- */
  const supervisors = [0, 1].map((index) => ({
    id: `user-supervisor-${index + 1}`,
    name: index === 0 ? 'عبدالعزيز الأنصاري' : fullName(rng),
    role: 'supervisor',
    email: index === 0 ? 'supervisor@demo.local' : `supervisor${index + 1}@demo.local`,
    phone: `05000000${20 + index}`,
    city: rng.pick(CITIES),
    district: rng.pick(DISTRICTS),
    joinedAt: daysAgo(540 - index * 30),
    status: 'active',
    title: 'مشرف حلقات',
  }));
  users.push(...supervisors);

  /* --- المعلمون والحلقات --- */
  const teachers = CIRCLE_NAMES.map((circleName, index) => ({
    id: `user-teacher-${index + 1}`,
    name: index === 0 ? 'إبراهيم الغامدي' : fullName(rng),
    role: 'teacher',
    email: index === 0 ? 'teacher@demo.local' : `teacher${index + 1}@demo.local`,
    phone: `05100000${String(index + 10)}`,
    city: rng.pick(CITIES),
    district: rng.pick(DISTRICTS),
    joinedAt: daysAgo(400 - index * 25),
    status: index === 5 ? 'inactive' : 'active',
    title: 'معلم حلقة',
  }));
  users.push(...teachers);

  CIRCLE_NAMES.forEach((name, index) => {
    circles.push({
      id: `circle-${index + 1}`,
      name,
      teacherId: teachers[index].id,
      supervisorId: supervisors[index % supervisors.length].id,
      level: LEVELS[index % LEVELS.length],
      schedule: SCHEDULES[index % SCHEDULES.length],
      location: LOCATIONS[index % LOCATIONS.length],
      city: teachers[index].city,
      district: teachers[index].district,
      mosque: MOSQUES[index % MOSQUES.length],
      studentIds: [],
    });
  });

  /* --- ولي أمر تجريبي --- */
  const parent = {
    id: 'user-parent-1',
    name: 'أحمد الحربي',
    role: 'parent',
    email: 'parent@demo.local',
    phone: '0500000005',
    city: 'الرياض',
    joinedAt: daysAgo(300),
    status: 'active',
    title: 'ولي أمر',
    childrenIds: [],
  };
  users.push(parent);

  /* --- الطلاب --- */
  const STUDENTS_PER_CIRCLE = 24;
  circles.forEach((circle, circleIndex) => {
    for (let i = 0; i < STUDENTS_PER_CIRCLE; i += 1) {
      const isDemoStudent = circleIndex === 0 && i === 0;
      const id = `student-${circleIndex + 1}-${String(i + 1).padStart(2, '0')}`;
      const memorizedPages = rng.int(12, 380);
      const mastery = rng.score(58, 98);
      const attendanceRate = rng.score(62, 100);
      const targetDaily = rng.pick([2, 3, 3, 4]);
      const lastRecitationDays = rng.int(0, 12);

      const student = {
        id,
        userId: `user-${id}`,
        name: isDemoStudent ? 'عبدالله العتيبي' : fullName(rng),
        role: 'student',
        email: isDemoStudent ? 'student@demo.local' : `${id}@demo.local`,
        phone: `0530${String(circleIndex)}${String(i).padStart(4, '0')}`,
        city: circle.location.includes('نموذجي') ? 'الرياض' : rng.pick(CITIES),
        circleId: circle.id,
        teacherId: circle.teacherId,
        supervisorId: circle.supervisorId,
        level: circle.level,
        age: rng.int(9, 17),
        guardianName: isDemoStudent ? parent.name : fullName(rng),
        guardianPhone: `0540${String(circleIndex)}${String(i).padStart(4, '0')}`,
        joinedAt: daysAgo(rng.int(60, 500)),
        memorizedPages,
        memorizedJuz: Math.floor(memorizedPages / 20),
        targetDaily,
        targetWeekly: targetDaily * 5,
        todayDone: isDemoStudent ? 2 : rng.int(0, targetDaily),
        streak: isDemoStudent ? 15 : rng.int(0, 40),
        attendanceRate,
        masteryAvg: mastery,
        reviewRate: rng.score(60, 99),
        testsAvg: rng.score(55, 99),
        lastRecitationAt: daysAgo(lastRecitationDays),
        status:
          attendanceRate < 72 || mastery < 68
            ? 'atRisk'
            : mastery > 92
              ? 'excellent'
              : attendanceRate < 85
                ? 'behind'
                : 'onTrack',
        currentSurah: rng.pick(SURAHS_WITH_TEXT).number,
        lastReadPage: rng.int(580, 604),
        // الطالب المتميز يُرشَّح مساعدًا للمعلم — أول متميز في كل حلقة.
        isAssistant: i === 1 && mastery > 90,
        district: circle.district,
        // هدف بالأجزاء ضمن مدة محددة
        juzGoal: {
          targetJuz: rng.pick([1, 2, 3, 5]),
          durationDays: rng.pick([30, 60, 90, 180]),
          startedAt: daysAgo(rng.int(3, 25)),
          startJuz: Math.floor(memorizedPages / 20),
        },
      };

      students.push(student);
      circle.studentIds.push(student.id);
      users.push({
        id: student.userId,
        name: student.name,
        role: 'student',
        email: student.email,
        phone: student.phone,
        city: student.city,
        joinedAt: student.joinedAt,
        status: 'active',
        studentId: student.id,
        circleId: circle.id,
      });
    }
  });

  // ابنان لولي الأمر التجريبي.
  parent.childrenIds = [students[0].id, students[1].id];
  students[0].guardianName = parent.name;
  students[1].guardianName = parent.name;

  /* --- الجلسات --- */
  const sessionTypes = ['memorization', 'review', 'test'];
  students.forEach((student, studentIndex) => {
    const count = rng.int(6, 14);
    for (let i = 0; i < count; i += 1) {
      const surah = rng.pick(SURAHS_WITH_TEXT);
      const fromAyah = rng.int(1, Math.max(1, surah.ayahCount - 3));
      const toAyah = Math.min(surah.ayahCount, fromAyah + rng.int(2, 8));
      sessions.push({
        id: nextId('session'),
        studentId: student.id,
        teacherId: student.teacherId,
        circleId: student.circleId,
        type: sessionTypes[(studentIndex + i) % sessionTypes.length],
        surahNumber: surah.number,
        fromAyah,
        toAyah,
        mastery: rng.score(55, 99),
        grade: rng.pick(['excellent', 'good', 'needsWork']),
        durationSeconds: rng.int(90, 420),
        notes: '',
        createdAt: daysAgo(i * 2 + rng.int(0, 1)),
      });
    }
  });

  /* --- الملاحظات --- */
  const noteTypes = ['praise', 'improvement', 'behavior', 'absence'];
  const noteTexts = {
    praise: 'أداء ممتاز في التسميع مع إتقان واضح للتجويد.',
    improvement: 'يحتاج إلى تثبيت المقطع الأخير قبل الانتقال لحفظ جديد.',
    behavior: 'ملتزم بآداب الحلقة ومتعاون مع زملائه.',
    absence: 'تكرر الغياب هذا الأسبوع، يُرجى التواصل مع ولي الأمر.',
  };
  students.forEach((student, index) => {
    const count = index % 3 === 0 ? 3 : index % 3 === 1 ? 2 : 1;
    for (let i = 0; i < count; i += 1) {
      const type = noteTypes[(index + i) % noteTypes.length];
      notes.push({
        id: nextId('note'),
        studentId: student.id,
        authorId: student.teacherId,
        authorName: users.find((u) => u.id === student.teacherId)?.name ?? '',
        type,
        text: noteTexts[type],
        createdAt: daysAgo(i * 5 + 1),
      });
    }
  });

  /* --- الحضور (آخر 14 يومًا) --- */
  const attendanceStatuses = ['present', 'present', 'present', 'late', 'absent', 'excused'];
  students.forEach((student) => {
    for (let day = 0; day < 14; day += 1) {
      attendance.push({
        id: nextId('att'),
        studentId: student.id,
        circleId: student.circleId,
        date: daysAgo(day).slice(0, 10),
        status:
          day === 0
            ? student.status === 'atRisk'
              ? 'absent'
              : 'present'
            : rng.pick(attendanceStatuses),
      });
    }
  });

  /* --- الاختبارات --- */
  const tests = [
    {
      id: 'test-weekly-1',
      scope: 'weekly',
      titleKey: 'tests.weekly',
      durationMinutes: 10,
      questionCount: 5,
      availableFrom: daysAgo(1),
      status: 'available',
    },
    {
      id: 'test-monthly-1',
      scope: 'monthly',
      titleKey: 'tests.monthly',
      durationMinutes: 20,
      questionCount: 8,
      availableFrom: daysAgo(0),
      status: 'available',
    },
  ];

  /* --- الإشعارات --- */
  const notificationSeeds = [
    { typeKey: 'session', daysAgo: 0, link: '/app/student/recitation' },
    { typeKey: 'test', daysAgo: 0, link: '/app/student/tests' },
    { typeKey: 'report', daysAgo: 1, link: '/app/student/reports' },
    { typeKey: 'goal', daysAgo: 2, link: '/app/student/goals' },
    { typeKey: 'note', daysAgo: 3, link: '/app/student/progress' },
  ];
  notificationSeeds.forEach((seed, index) => {
    notifications.push({
      id: nextId('notif'),
      typeKey: seed.typeKey,
      createdAt: daysAgo(seed.daysAgo),
      read: index > 2,
      link: seed.link,
      roles: ['student', 'teacher', 'supervisor', 'admin', 'parent'],
    });
  });

  /* --- سلاسل زمنية للرسوم --- */
  const weeklySeries = Array.from({ length: 6 }, (_, index) => ({
    label: `أ${index + 1}`,
    memorization: rng.int(8, 22),
    review: rng.int(12, 34),
    tests: rng.int(50, 98),
    activity: rng.int(120, 420),
  }));

  /* --- طلبات تسجيل من أولياء الأمور --- */
  const enrollmentRequests = [
    {
      id: 'req-seed-1',
      parentId: parent.id,
      parentName: parent.name,
      childName: 'سعد الحربي',
      age: 10,
      city: 'الرياض',
      district: DISTRICTS[0],
      mosque: MOSQUES[0],
      circleId: circles[0].id,
      circleName: circles[0].name,
      note: 'الابن حافظ لجزء عمّ ويرغب بالانتظام في الحلقة.',
      status: 'pending',
      createdAt: daysAgo(2),
      decidedBy: null,
      decidedByName: null,
      decidedAt: null,
      rejectionReason: null,
    },
  ];

  return {
    version: DB_VERSION,
    createdAt: new Date().toISOString(),
    enrollmentRequests,
    users,
    circles,
    students,
    sessions,
    notes,
    attendance,
    tests,
    testAttempts: [],
    notifications,
    weeklySeries,
    bookmarks: [],
    platformSettings: {
      platformName: 'منصة الحلقات',
      defaultGoal: 3,
      allowRegistration: true,
      maintenanceMode: false,
    },
  };
}

/* ---------------------------------------------------------------
   التحميل / الحفظ
   --------------------------------------------------------------- */
let cache = null;

export function getDb() {
  if (cache) return cache;
  const stored = readStorage(STORAGE_KEYS.db);
  if (stored && stored.version === DB_VERSION) {
    cache = stored;
    return cache;
  }
  cache = generate();
  writeStorage(STORAGE_KEYS.db, cache);
  return cache;
}

export function saveDb(next) {
  cache = next ?? cache;
  writeStorage(STORAGE_KEYS.db, cache);
  return cache;
}

/** تعديل آمن: يمرر نسخة من القاعدة ويحفظ النتيجة. */
export function mutateDb(mutator) {
  const db = getDb();
  const result = mutator(db);
  saveDb(db);
  return result;
}

export function resetDb() {
  removeStorage(STORAGE_KEYS.db);
  cache = generate();
  writeStorage(STORAGE_KEYS.db, cache);
  return cache;
}

/* ---------------------------------------------------------------
   محددات مساعدة
   --------------------------------------------------------------- */
export function findUserByEmail(email) {
  if (!email) return null;
  const normalized = String(email).trim().toLowerCase();
  return getDb().users.find((user) => user.email?.toLowerCase() === normalized) ?? null;
}

export function findUserByPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '').slice(-9);
  return getDb().users.find((user) => user.phone?.replace(/\D/g, '').endsWith(digits)) ?? null;
}

export function getStudent(studentId) {
  return getDb().students.find((student) => student.id === studentId) ?? null;
}

export function getUser(userId) {
  return getDb().users.find((user) => user.id === userId) ?? null;
}

export function getCircle(circleId) {
  return getDb().circles.find((circle) => circle.id === circleId) ?? null;
}

export function getSurahName(number) {
  return SURAHS.find((surah) => surah.number === Number(number))?.name ?? '';
}

export function getSupervisorCircles(supervisorId) {
  return getDb().circles.filter((circle) => circle.supervisorId === supervisorId);
}

export const CITY_LIST = CITIES;
export const DISTRICT_LIST = DISTRICTS;
export const MOSQUE_LIST = MOSQUES;
