import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs } from './helpers.js';

/** فحص سريع: كل مسار أساسي يفتح بلا أخطاء Console ولا صفحة مكسورة. */

const ROUTES = {
  student: [
    '/app/student',
    '/app/quran',
    '/app/quran/1',
    '/app/student/review',
    '/app/student/recitation',
    '/app/student/tests',
    '/app/student/goals',
  ],
  teacher: [
    '/app/teacher',
    '/app/teacher/circle',
    '/app/teacher/students',
    '/app/teacher/sessions',
    '/app/teacher/reports',
    '/app/quran',
  ],
  supervisor: [
    '/app/supervisor',
    '/app/supervisor/circles',
    '/app/supervisor/teachers',
    '/app/supervisor/manage-teachers',
    '/app/supervisor/requests',
    '/app/supervisor/reports',
    '/app/supervisor/coverage',
  ],
  admin: [
    '/app/admin',
    '/app/admin/users',
    '/app/admin/supervisors',
    '/app/admin/teachers',
    '/app/admin/circles',
    '/app/admin/requests',
    '/app/admin/reports',
    '/app/admin/analytics',
    '/app/admin/settings',
  ],
  parent: [
    '/app/parent',
    '/app/parent/children',
    '/app/parent/requests',
    '/app/quran',
  ],
};

const SHARED = ['/app/settings', '/app/settings/accessibility', '/app/notifications', '/app/profile', '/app/search'];

test.describe('الصفحات العامة', () => {
  test('الصفحة التعريفية تعمل وبها الإجراءات الأساسية', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('link', { name: 'استعراض الأدوار' }).first()).toBeVisible();
    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    assertNoConsoleErrors(errors);
  });

  test('مسار غير موجود يعرض صفحة 404 وليس شاشة بيضاء', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/no-such-page');
    await expect(page.getByText('الصفحة غير موجودة')).toBeVisible();
    assertNoConsoleErrors(errors);
  });

  test('صفحات الدخول والتسجيل والتجربة تفتح', async ({ page }) => {
    const errors = watchConsole(page);
    for (const path of ['/login', '/register', '/demo']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
    assertNoConsoleErrors(errors);
  });
});

for (const [role, routes] of Object.entries(ROUTES)) {
  test(`كل صفحات ${role} تفتح بلا أخطاء`, async ({ page }) => {
    const errors = watchConsole(page);
    await loginAs(page, role);

    for (const path of [...routes, ...SHARED]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
      // لا توجد صفحة تعيد المستخدم إلى 404 أو صفحة الدخول
      await expect(page).toHaveURL(new RegExp(path.replace(/\//g, '\\/')));
    }

    assertNoConsoleErrors(errors);
  });
}

test('الحماية: بدون جلسة يعاد التوجيه إلى صفحة الدخول', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/app/student');
  await expect(page).toHaveURL(/\/login/);
  assertNoConsoleErrors(errors);
});
