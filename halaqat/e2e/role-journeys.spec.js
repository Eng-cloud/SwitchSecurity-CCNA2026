import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, logout, navigate } from './helpers.js';

/**
 * رحلات الأدوار الكاملة (المواصفات §80).
 */

test('رحلة المعلم: الحلقة → الطلاب → الطالب → ملاحظة → جلسة → تقرير → رجوع → خروج', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loginAs(page, 'teacher');

  // Dashboard
  await expect(page.getByRole('heading', { name: 'حلقتي اليوم' })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'طلاب الحلقة' })).toBeVisible();

  // Circle
  await navigate(page, 'الحلقة', /\/app\/teacher\/circle/);
  await expect(page.getByRole('table')).toBeVisible();

  // تسجيل حضور من الجدول
  const attendanceButton = page.getByRole('button', { name: 'تسجيل حضور' }).first();
  if (await attendanceButton.isEnabled()) {
    await attendanceButton.click();
    await expect(page.getByText('تم تسجيل الحضور').first()).toBeVisible();
  }

  // Students → Student profile
  await page.goto('/app/teacher/students');
  await page.locator('.card a').first().click();
  await expect(page).toHaveURL(/\/app\/teacher\/students\/student-/);

  // Add note
  await page.getByTestId('open-note').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('textbox', { name: 'الملاحظة' }).fill('أداء ممتاز في تسميع اليوم وإتقان واضح.');
  await page.getByTestId('save-note').click();
  await expect(page.getByText('تم حفظ الملاحظة').first()).toBeVisible();

  // الملاحظة ظهرت فعليًا في التبويب
  await page.getByRole('tab', { name: 'الملاحظات' }).click();
  await expect(page.getByText('أداء ممتاز في تسميع اليوم وإتقان واضح.')).toBeVisible();

  // Session
  await page.goto('/app/teacher/sessions');
  await page.getByTestId('save-session').click();
  await expect(page.getByText('تم تسجيل الجلسة').first()).toBeVisible();

  // Report + print preview
  await page.goto('/app/teacher/reports');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByRole('button', { name: 'معاينة الطباعة' }).click();
  await expect(page.locator('.print-header')).toBeVisible();

  // In-app back + browser back
  await page.goto('/app/teacher/students');
  await page.locator('.card a').first().click();
  await page.getByRole('button', { name: 'رجوع' }).click();
  await expect(page).toHaveURL(/\/app\/teacher\/students$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/app\/teacher\/students\/student-/);

  await logout(page);
  assertNoConsoleErrors(errors);
});

test('رحلة المشرف: الحلقات → حلقة → المعلم → الطلاب → طالب → تقارير → طباعة → خروج', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loginAs(page, 'supervisor');

  await expect(page.getByRole('heading', { name: 'نظرة عامة على الحلقات' })).toBeVisible();

  await navigate(page, 'الحلقات', /\/app\/supervisor\/circles/);

  await page.getByRole('link', { name: 'فتح الحلقة' }).first().click();
  await expect(page).toHaveURL(/\/app\/supervisor\/circles\/circle-/);
  await expect(page.getByText('ملف المعلم')).toBeVisible();

  // طالب من داخل الحلقة
  await page.getByRole('link', { name: 'عرض الطالب' }).first().click();
  await expect(page).toHaveURL(/\/app\/supervisor\/students\/student-/);
  // المشرف لا يملك زر إضافة ملاحظة (تجربة مختلفة لكل دور)
  await expect(page.getByTestId('open-note')).toHaveCount(0);

  await page.goto('/app/supervisor/teachers');
  await expect(page.getByRole('heading', { name: 'المعلمون' })).toBeVisible();

  await page.goto('/app/supervisor/reports');
  await page.getByRole('button', { name: 'معاينة الطباعة' }).click();
  await expect(page.locator('.print-header')).toBeVisible();
  await expect(page.locator('.print-footer')).toBeVisible();

  await logout(page);
  assertNoConsoleErrors(errors);
});

test('رحلة الإدارة: المستخدمون → الحلقات → التقارير → تصفية → طباعة → إعدادات → خروج', async ({
  page,
}) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');

  await expect(page.getByRole('heading', { name: 'لوحة الإدارة' })).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'إجمالي الطلاب' })).toBeVisible();

  // Users + filters
  await page.goto('/app/admin/users');
  await expect(page.getByRole('table')).toBeVisible();
  await page.getByLabel('الدور').selectOption('teacher');
  await expect(page).toHaveURL(/role=teacher/);
  const roleCells = page.locator('td[data-label="الدور"]');
  await expect(roleCells.first()).toContainText('المعلم');

  // البحث مع حالة "لا نتائج"
  await page.getByPlaceholder('ابحث...').fill('زززز');
  await expect(page.getByText('لا توجد نتائج')).toBeVisible();
  await page.getByRole('button', { name: 'إعادة تعيين' }).first().click();
  await expect(page.getByRole('table')).toBeVisible();

  // Circles
  await page.goto('/app/admin/circles');
  await expect(page.getByRole('table')).toBeVisible();

  // Reports + print preview
  await page.goto('/app/admin/reports');
  await page.getByRole('radio', { name: 'أسبوعي' }).click();
  await expect(page).toHaveURL(/period=weekly/);
  await page.getByRole('button', { name: 'معاينة الطباعة' }).click();
  await expect(page.locator('.print-header')).toBeVisible();

  // Settings
  await page.goto('/app/admin/settings');
  await page.getByLabel('اسم المنصة').fill('منصة الحلقات — تجريبي');
  await page.getByRole('button', { name: 'حفظ' }).click();
  await expect(page.getByText('تم حفظ الإعدادات').first()).toBeVisible();

  await logout(page);
  assertNoConsoleErrors(errors);
});

test('رحلة ولي الأمر: الأبناء → تفاصيل ابن → تقارير → خروج', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'parent');

  await expect(page.getByRole('heading', { name: 'متابعة الأبناء' })).toBeVisible();
  await page.getByRole('link', { name: 'عرض التفاصيل' }).first().click();
  await expect(page).toHaveURL(/\/app\/parent\/children\/student-/);

  await page.getByRole('tab', { name: 'الجلسات' }).click();
  await expect(page.getByRole('tab', { name: 'الجلسات' })).toHaveAttribute('aria-selected', 'true');

  await page.goto('/app/parent/reports');
  await expect(page.getByRole('table')).toBeVisible();

  await logout(page);
  assertNoConsoleErrors(errors);
});

test('تبديل الدور داخل وضع التجربة يغيّر التنقل والبيانات', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');

  // تنقل الطالب
  await expect(page.getByRole('link', { name: 'المصحف' }).first()).toBeVisible();

  await page.getByRole('button', { name: /الحساب/ }).click();
  await page.getByRole('button', { name: 'تجربة المعلم' }).click();

  await expect(page).toHaveURL(/\/app\/teacher/);
  await expect(page.getByRole('heading', { name: 'حلقتي اليوم' })).toBeVisible();
  // اختفى تنقل الطالب وظهر تنقل المعلم
  await expect(page.getByRole('link', { name: 'المصحف', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'الحلقة', exact: true }).first()).toBeVisible();

  // مسار دور آخر يعيد التوجيه بهدوء إلى لوحة الدور الحالي
  await page.goto('/app/student/quran');
  await expect(page).toHaveURL(/\/app\/teacher/);

  assertNoConsoleErrors(errors);
});
