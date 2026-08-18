/**
 * تعريف التنقل لكل دور — مصدر واحد للـSidebar وBottom Nav ولوحة الأوامر.
 * النصوص عبر مفاتيح i18n وليست ثابتة هنا.
 */

export const ROLE_HOME = {
  student: '/app/student',
  teacher: '/app/teacher',
  supervisor: '/app/supervisor',
  admin: '/app/admin',
  parent: '/app/parent',
};

const NAVIGATION = {
  student: [
    { to: '/app/student', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/student/quran', labelKey: 'nav.quran', icon: '📖', primary: true },
    { to: '/app/student/recitation', labelKey: 'nav.recitation', icon: '🎙', primary: true },
    { to: '/app/student/review', labelKey: 'nav.review', icon: '🔁' },
    { to: '/app/student/tests', labelKey: 'nav.tests', icon: '📝' },
    { to: '/app/student/goals', labelKey: 'nav.goals', icon: '🎯' },
    { to: '/app/student/progress', labelKey: 'nav.progress', icon: '📈', primary: true },
    { to: '/app/student/reports', labelKey: 'nav.reports', icon: '📊' },
  ],
  teacher: [
    { to: '/app/teacher', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/teacher/circle', labelKey: 'nav.circle', icon: '👥', primary: true },
    { to: '/app/teacher/students', labelKey: 'nav.students', icon: '🧑‍🎓', primary: true },
    { to: '/app/teacher/sessions', labelKey: 'nav.sessions', icon: '🎙', primary: true },
    { to: '/app/teacher/reports', labelKey: 'nav.reports', icon: '📊' },
  ],
  supervisor: [
    { to: '/app/supervisor', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/supervisor/circles', labelKey: 'nav.circles', icon: '🕌', primary: true },
    { to: '/app/supervisor/teachers', labelKey: 'nav.teachers', icon: '🧑‍🏫', primary: true },
    { to: '/app/supervisor/reports', labelKey: 'nav.reports', icon: '📊', primary: true },
  ],
  admin: [
    { to: '/app/admin', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/admin/users', labelKey: 'nav.users', icon: '👤', primary: true },
    { to: '/app/admin/circles', labelKey: 'nav.circles', icon: '🕌', primary: true },
    { to: '/app/admin/reports', labelKey: 'nav.reports', icon: '📊' },
    { to: '/app/admin/analytics', labelKey: 'nav.analytics', icon: '📈', primary: true },
    { to: '/app/admin/settings', labelKey: 'nav.settings', icon: '⚙️' },
  ],
  parent: [
    { to: '/app/parent', labelKey: 'nav.dashboard', icon: '🏠', end: true, primary: true },
    { to: '/app/parent/children', labelKey: 'nav.children', icon: '🧑‍🎓', primary: true },
    { to: '/app/parent/reports', labelKey: 'nav.reports', icon: '📊', primary: true },
  ],
};

/** روابط مشتركة تظهر أسفل القائمة لكل الأدوار. */
export const COMMON_NAV = [
  { to: '/app/notifications', labelKey: 'nav.notifications', icon: '🔔' },
  { to: '/app/settings', labelKey: 'nav.settings', icon: '⚙️' },
];

export function getNavigation(role) {
  return NAVIGATION[role] ?? [];
}

/** عناصر شريط الجوال السفلي — خمسة عناصر كحد أقصى. */
export function getBottomNavigation(role) {
  const items = getNavigation(role).filter((item) => item.primary);
  return [...items.slice(0, 4), { to: '/app/settings', labelKey: 'nav.account', icon: '👤' }];
}

export default NAVIGATION;
