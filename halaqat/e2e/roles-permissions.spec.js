import { test, expect } from '@playwright/test';
import {
  watchConsole,
  assertNoConsoleErrors,
  loginAs,
  logout,
  sidebarVisible,
} from './helpers.js';

/** رابط التنقل يظهر في الشريط الجانبي على سطح المكتب وفي الدرج على الجوال. */
async function expectNavLink(page, name, shouldExist = true) {
  const sidebar = page.locator('[data-app-sidebar]');
  if (await sidebarVisible(page)) {
    await expect(sidebar.getByRole('link', { name })).toHaveCount(shouldExist ? 1 : 0);
    return;
  }
  await page.getByRole('button', { name: 'فتح القائمة الرئيسية' }).click();
  const drawer = page.getByRole('dialog');
  await expect(drawer.getByRole('link', { name })).toHaveCount(shouldExist ? 1 : 0);
  await page.keyboard.press('Escape');
}

/** الصلاحيات: المصحف، الطباعة، ونطاق البحث لكل دور. */

test('المصحف للطالب والمعلم وولي الأمر ومحجوب عن المشرف والإدارة', async ({ page }) => {
  const errors = watchConsole(page);

  for (const role of ['student', 'teacher', 'parent']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto('/');
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await expectNavLink(page, 'المصحف', true);

    // eslint-disable-next-line no-await-in-loop
    await page.goto('/app/quran/1');
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBeVisible();
  }

  // المشرف والإدارة: دورهما إشرافي وإداري، والمصحف أداة تعليم.
  for (const role of ['supervisor', 'admin']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto('/');
    // eslint-disable-next-line no-await-in-loop
    await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await expectNavLink(page, 'المصحف', false);
    // eslint-disable-next-line no-await-in-loop
    await page.goto('/app/quran');
    // eslint-disable-next-line no-await-in-loop
    await expect(page).toHaveURL(new RegExp(`/app/${role}`));
  }

  assertNoConsoleErrors(errors);
});

test('الطباعة للمشرف والإدارة فقط', async ({ page }) => {
  const errors = watchConsole(page);

  // المعلم: يقرأ تقرير حلقته بلا طباعة ولا تصدير.
  await loginAs(page, 'teacher');
  await page.goto('/app/teacher/reports');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'معاينة الطباعة' })).toHaveCount(0);
  await logout(page);

  // المشرف والإدارة: الطباعة متاحة.
  for (const role of ['supervisor', 'admin']) {
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`/app/${role}/reports`);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('button', { name: 'طباعة', exact: true })).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    await logout(page);
  }

  assertNoConsoleErrors(errors);
});

test('البحث محصور بنطاق الدور', async ({ page }) => {
  const errors = watchConsole(page);

  // الطالب: سور فقط، بلا طلاب
  await loginAs(page, 'student');
  await page.goto('/app/search');
  await page.locator('main').getByRole('searchbox').fill('عبدالله');
  await expect(page.getByText('لا توجد نتائج مطابقة.')).toBeVisible();

  await page.locator('main').getByRole('searchbox').fill('الفاتحة');
  await expect(page.getByRole('heading', { name: 'السور' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الطلاب' })).toHaveCount(0);

  // المعلم: يجد طلاب حلقته
  await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
  await loginAs(page, 'teacher');
  await page.goto('/app/search');
  await page.locator('main').getByRole('searchbox').fill('عبدالله');
  await expect(page.getByRole('heading', { name: 'الطلاب' })).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('تعيين المساعد قسم مستقل عند المعلم لا زر متناثر في جدول الحلقة', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'teacher');

  // لم يعد التعيين إجراءً في صف الجدول.
  await page.goto('/app/teacher/circle');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('button', { name: 'تعيين مساعدًا' })).toHaveCount(0);

  // بل في قسم «الطالب المتميز ومساعد المعلم».
  await page.goto('/app/teacher/assistant');
  await expect(
    page.getByRole('heading', { name: 'الطالب المتميز ومساعد المعلم' }),
  ).toBeVisible();
  await page.getByTestId('assign-assistant').first().click();
  await expect(page.getByText('تم تعيين الطالب مساعدًا للمعلم')).toBeVisible();

  assertNoConsoleErrors(errors);
});
