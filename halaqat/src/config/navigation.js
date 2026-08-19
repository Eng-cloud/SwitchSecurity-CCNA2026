/**
 * تعريف التنقل لكل دور — مصدر واحد للـSidebar وBottom Nav ولوحة الأوامر.
 * النصوص عبر مفاتيح i18n وليست ثابتة هنا.
 */

import { can, ACTIONS } from './permissions.js';

export const ROLE_HOME = {
  student: '/app/student',
  teacher: '/app/teacher',
  supervisor: '/app/supervisor',
  admin: '/app/admin',
  parent: '/app/parent',
};

/** المصحف مسار مشترك — يظهر لكل دور يملك صلاحية القراءة. */
const QURAN_ITEM = { to: '/app/quran', labelKey: 'nav.quran', icon: '📖', primary: true };

const NAVIGATION = {
  student: [
    { to: '/app/student', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    QURAN_ITEM,
    { to: '/app/student/recitation', labelKey: 'nav.recitation', icon: '🎙', primary: true },
    // مؤقت: يظهر فقط أثناء وجود توكيل نشِط من المعلم ويختفي بانتهائه.
    {
      to: '/app/student/assistant',
      labelKey: 'nav.assistantDuty',
      icon: '⭐',
      primary: true,
      requires: 'assistantDuty',
    },
    { to: '/app/student/review', labelKey: 'nav.review', icon: '🔁' },
    { to: '/app/student/tests', labelKey: 'nav.tests', icon: '📝' },
    { to: '/app/student/goals', labelKey: 'nav.goals', icon: '🎯' },
  ],
  teacher: [
    { to: '/app/teacher', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/teacher/circle', labelKey: 'nav.circle', icon: '👥', primary: true },
    { to: '/app/teacher/students', labelKey: 'nav.students', icon: '🧑‍🎓', primary: true },
    { to: '/app/teacher/assistant', labelKey: 'nav.assistant', icon: '⭐' },
    { to: '/app/teacher/sessions', labelKey: 'nav.sessions', icon: '🎙' },
    QURAN_ITEM,
    { to: '/app/teacher/reports', labelKey: 'nav.reports', icon: '📊' },
  ],
  supervisor: [
    { to: '/app/supervisor', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/supervisor/coverage', labelKey: 'nav.coverage', icon: '🛡', primary: true },
    { to: '/app/supervisor/circles', labelKey: 'nav.circles', icon: '🕌', primary: true },
    { to: '/app/supervisor/teachers', labelKey: 'nav.teachers', icon: '🧑‍🏫', primary: true },
    { to: '/app/supervisor/distinguished', labelKey: 'nav.distinguished', icon: '🏅' },
    { to: '/app/supervisor/requests', labelKey: 'nav.requests', icon: '📬', primary: true },
    { to: '/app/supervisor/reports', labelKey: 'nav.reports', icon: '📊' },
  ],
  admin: [
    { to: '/app/admin', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/admin/users', labelKey: 'nav.users', icon: '👤', primary: true },
    { to: '/app/admin/supervisors', labelKey: 'nav.supervisors', icon: '🧭' },
    { to: '/app/admin/teachers', labelKey: 'nav.teachers', icon: '🧑‍🏫' },
    { to: '/app/admin/circles', labelKey: 'nav.circles', icon: '🕌', primary: true },
    { to: '/app/admin/coverage', labelKey: 'nav.coverage', icon: '🛡' },
    { to: '/app/admin/requests', labelKey: 'nav.requests', icon: '📬' },
    { to: '/app/admin/reports', labelKey: 'nav.reports', icon: '📊' },
    { to: '/app/admin/analytics', labelKey: 'nav.analytics', icon: '📈', primary: true },
    { to: '/app/admin/settings', labelKey: 'nav.platformSettings', icon: '🛠' },
  ],
  parent: [
    { to: '/app/parent', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/parent/children', labelKey: 'nav.children', icon: '🧑‍🎓', primary: true },
    { to: '/app/parent/requests', labelKey: 'nav.requests', icon: '📬', primary: true },
    QURAN_ITEM,
  ],
};

/** روابط مشتركة تظهر أسفل القائمة لكل الأدوار. */
export const COMMON_NAV = [
  { to: '/app/notifications', labelKey: 'nav.notifications', icon: '🔔' },
  { to: '/app/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

/**
 * تنقل الدور.
 * @param {string} role الدور
 * @param {object} context رايات مؤقتة مبنية على البيانات لا على الدور،
 *   مثل `assistantDuty` حين يكون للطالب توكيل نشِط من معلمه.
 */
export function getNavigation(role, context = {}) {
  const items = NAVIGATION[role] ?? [];
  return items
    // المصحف يظهر فقط لمن يملك صلاحية قراءته.
    .filter((item) => (item.to === '/app/quran' ? can(role, ACTIONS.QURAN_READ) : true))
    // العناصر المشروطة تظهر بوجود شرطها فقط.
    .filter((item) => (item.requires ? Boolean(context[item.requires]) : true));
}

/** الروابط المشتركة بلا تكرار لما هو موجود أصلًا في تنقل الدور. */
export function getCommonNavigation(role, context = {}) {
  const existing = new Set(getNavigation(role, context).map((item) => item.to));
  return COMMON_NAV.filter((item) => !existing.has(item.to));
}

/** عناصر شريط الجوال السفلي — خمسة عناصر كحد أقصى. */
export function getBottomNavigation(role, context = {}) {
  const items = getNavigation(role, context).filter((item) => item.primary);
  return [...items.slice(0, 4), { to: '/app/settings', labelKey: 'nav.account', icon: '👤' }];
}

export default NAVIGATION;
