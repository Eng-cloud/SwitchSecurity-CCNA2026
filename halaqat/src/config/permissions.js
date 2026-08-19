/**
 * مصفوفة الصلاحيات — المصدر الوحيد لما يستطيع كل دور فعله.
 *
 * كل الواجهات (التنقل، الأزرار، الصفحات، البحث، الطباعة) تسأل هذا الملف،
 * فلا تتفرق قواعد الصلاحيات داخل المكونات.
 *
 * تنبيه: هذه صلاحيات واجهة في نسخة تجريبية بلا خادم، وليست تفويضًا أمنيًا.
 */

/**
 * ترتيب عرض الأدوار في كل الواجهات — من الأقرب للطالب إلى الأعلى إشرافًا.
 * مصدر واحد كي لا يختلف الترتيب بين صفحة وأخرى.
 */
export const ROLE_ORDER = ['student', 'parent', 'teacher', 'supervisor', 'admin'];

/** ترتيب قائمة أدوار بحسب الترتيب المعتمد. */
export function sortRoles(roles) {
  return [...roles].sort((a, b) => ROLE_ORDER.indexOf(a) - ROLE_ORDER.indexOf(b));
}

/** كل الإجراءات المعرّفة في المنصة. */
export const ACTIONS = {
  QURAN_READ: 'quran.read',
  RECITATION_RECORD: 'recitation.record',
  REPORTS_PRINT: 'reports.print',
  USERS_MANAGE: 'users.manage',
  SUPERVISORS_MANAGE: 'supervisors.manage',
  TEACHERS_MANAGE: 'teachers.manage',
  CIRCLES_MANAGE: 'circles.manage',
  STUDENTS_MANAGE: 'students.manage',
  ASSISTANT_ASSIGN: 'assistant.assign',
  DELEGATION_MANAGE: 'delegation.manage',
  DISTINGUISHED_VIEW: 'distinguished.view',
  TASKS_ASSIGN: 'tasks.assign',
  ENROLLMENT_CREATE: 'enrollment.create',
  ENROLLMENT_REVIEW: 'enrollment.review',
  ATTENDANCE_RECORD: 'attendance.record',
  COVERAGE_MANAGE: 'coverage.manage',
  NOTES_WRITE: 'notes.write',
};

const A = ACTIONS;

/**
 * الصلاحيات لكل دور.
 * - المصحف: للطالب والمعلم وولي الأمر. الإدارة والمشرف دورهما إداري
 *   وإشرافي، والمصحف أداة تعليم لا أداة إشراف.
 * - الطباعة والتصدير (REPORTS_PRINT): للمشرف والإدارة فقط. المعلم يقرأ
 *   تقارير حلقته ولا يُخرجها من المنصة — التوثيق الرسمي فوقه.
 * - إضافة الطلاب وحذفهم (STUDENTS_MANAGE): للمشرف والإدارة فقط.
 *   المعلم يعلّم حلقته ويتابعها ولا يبني تشكيلتها، فلا تختلط الأدوار.
 * - الحضور (ATTENDANCE_RECORD): للمعلم في حلقته، وللمشرف في حلقاته كاملةً.
 *   المشرف مسؤول عن انعقاد الحلقة، ومن يُسأل عن انعقادها يملك تسجيله.
 * - التغطية (COVERAGE_MANAGE): المعلم يطلب نائبًا ويردّ على الطلبات،
 *   والمشرف يعيّن بديلًا أو يتولّى الحلقة بنفسه.
 */
const MATRIX = {
  student: [A.QURAN_READ, A.RECITATION_RECORD],

  // المعلم داخل حلقته: تسميع وحضور وملاحظات وتقارير وتعيين مساعد.
  // ليس له STUDENTS_MANAGE ولا TEACHERS_MANAGE ولا CIRCLES_MANAGE ولا مراجعة الطلبات.
  teacher: [
    A.QURAN_READ,
    A.ASSISTANT_ASSIGN,
    A.DELEGATION_MANAGE,
    A.DISTINGUISHED_VIEW,
    A.TASKS_ASSIGN,
    A.ATTENDANCE_RECORD,
    A.COVERAGE_MANAGE,
    A.NOTES_WRITE,
  ],

  supervisor: [
    A.REPORTS_PRINT,
    A.TEACHERS_MANAGE,
    A.CIRCLES_MANAGE,
    A.STUDENTS_MANAGE,
    A.ENROLLMENT_REVIEW,
    A.DISTINGUISHED_VIEW,
    A.ATTENDANCE_RECORD,
    A.COVERAGE_MANAGE,
    A.NOTES_WRITE,
  ],

  admin: [
    A.REPORTS_PRINT,
    A.USERS_MANAGE,
    A.SUPERVISORS_MANAGE,
    A.TEACHERS_MANAGE,
    A.CIRCLES_MANAGE,
    A.STUDENTS_MANAGE,
    A.ENROLLMENT_REVIEW,
    A.DISTINGUISHED_VIEW,
    A.ATTENDANCE_RECORD,
    A.COVERAGE_MANAGE,
  ],

  parent: [A.QURAN_READ, A.ENROLLMENT_CREATE],
};

/** هل يملك هذا الدور هذا الإجراء؟ */
export function can(role, action) {
  return (MATRIX[role] ?? []).includes(action);
}

/** كل صلاحيات الدور (للاختبارات والتوثيق). */
export function permissionsOf(role) {
  return [...(MATRIX[role] ?? [])];
}

/**
 * نطاق البحث لكل دور — لا يبحث أحد فيما لا يخصه.
 * students: نطاق الطلاب الظاهر | circles: الحلقات | surahs: السور
 */
export const SEARCH_SCOPE = {
  student: { students: 'none', circles: 'none', surahs: true },
  teacher: { students: 'circle', circles: 'none', surahs: true },
  supervisor: { students: 'supervised', circles: 'supervised', surahs: true },
  admin: { students: 'all', circles: 'all', surahs: false },
  parent: { students: 'children', circles: 'none', surahs: true },
};

export function searchScope(role) {
  return SEARCH_SCOPE[role] ?? SEARCH_SCOPE.student;
}

export default MATRIX;
