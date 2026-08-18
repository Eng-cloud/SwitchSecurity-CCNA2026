/**
 * مصفوفة الصلاحيات — المصدر الوحيد لما يستطيع كل دور فعله.
 *
 * كل الواجهات (التنقل، الأزرار، الصفحات، البحث، الطباعة) تسأل هذا الملف،
 * فلا تتفرق قواعد الصلاحيات داخل المكونات.
 *
 * تنبيه: هذه صلاحيات واجهة في نسخة تجريبية بلا خادم، وليست تفويضًا أمنيًا.
 */

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
  ENROLLMENT_CREATE: 'enrollment.create',
  ENROLLMENT_REVIEW: 'enrollment.review',
  ATTENDANCE_RECORD: 'attendance.record',
  NOTES_WRITE: 'notes.write',
};

const A = ACTIONS;

/**
 * الصلاحيات لكل دور.
 * - المصحف: للطالب والمعلم والمشرف وولي الأمر (الإدارة دورها إداري).
 * - الطباعة: للمعلم والمشرف والإدارة فقط.
 */
const MATRIX = {
  student: [A.QURAN_READ, A.RECITATION_RECORD],

  teacher: [
    A.QURAN_READ,
    A.REPORTS_PRINT,
    A.STUDENTS_MANAGE,
    A.ASSISTANT_ASSIGN,
    A.ATTENDANCE_RECORD,
    A.NOTES_WRITE,
  ],

  supervisor: [
    A.QURAN_READ,
    A.REPORTS_PRINT,
    A.TEACHERS_MANAGE,
    A.CIRCLES_MANAGE,
    A.STUDENTS_MANAGE,
    A.ENROLLMENT_REVIEW,
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
