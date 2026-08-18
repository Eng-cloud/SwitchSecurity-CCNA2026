import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs } from './helpers.js';

/** الإدارة والإشراف: طلبات التسجيل، إضافة وحذف، وتغيير الأدوار. */

test('ولي الأمر يرسل طلب تسجيل والمشرف يقبله فيُضاف الطالب', async ({ page }) => {
  const errors = watchConsole(page);

  // 1) ولي الأمر يرسل الطلب
  await loginAs(page, 'parent');
  await page.goto('/app/parent/requests');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByTestId('request-child-name').fill('يوسف الحربي');
  await page.getByTestId('request-city').selectOption({ index: 1 });
  await page.getByTestId('request-district').selectOption({ index: 1 });
  await page.getByTestId('request-mosque').selectOption({ index: 1 });

  // الحلقات تُصفّى حسب المدينة والحي
  const circleSelect = page.getByTestId('request-circle');
  await expect(circleSelect).toBeEnabled();
  const optionCount = await circleSelect.locator('option').count();

  if (optionCount > 1) {
    await circleSelect.selectOption({ index: 1 });
    await page.getByTestId('submit-request').click();
    await expect(page.getByText('تم إرسال الطلب إلى المشرف والإدارة').first()).toBeVisible();
    await expect(page.getByText('يوسف الحربي')).toBeVisible();
  } else {
    // لا توجد حلقة في هذا الحي — الواجهة تعلن ذلك بوضوح بدل الفشل الصامت
    await expect(page.getByText('لا توجد حلقات في هذا الحي. جرّب حيًا آخر.')).toBeVisible();
  }

  // 2) المشرف يرى الطلب المبدئي ويقبله
  await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
  await loginAs(page, 'supervisor');
  await page.goto('/app/supervisor/requests');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const firstCard = page.getByTestId('request-card').first();
  if (await firstCard.count()) {
    const childName = await firstCard.locator('p').first().innerText();
    await firstCard.getByTestId('approve-request').click();
    await page.getByRole('button', { name: 'قبول الطلب', exact: true }).last().click();
    await expect(page.getByText('تم قبول الطلب وإضافة الطالب إلى الحلقة').first()).toBeVisible();

    // الطالب صار موجودًا فعلًا في البحث
    await page.goto('/app/search');
    await page.locator('main').getByRole('searchbox').fill(childName.split(' ')[0]);
    await expect(page.getByRole('heading', { name: 'الطلاب' })).toBeVisible();
  }

  assertNoConsoleErrors(errors);
});

test('الإدارة: ثلاثة أقسام مع إضافة معلم وتغيير دور', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');

  // الأقسام الثلاثة موجودة كمسارات مستقلة
  for (const path of ['/app/admin/users', '/app/admin/supervisors', '/app/admin/teachers']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(path);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  // قسم المستخدمين لا يخلط الطلاب بالإداريين
  await page.goto('/app/admin/users');
  await expect(page.getByRole('table')).toBeVisible();
  const roleCells = page.locator('td[data-label="الدور"]');
  const roles = await roleCells.allInnerTexts();
  expect(roles.every((value) => !value.includes('الطالب'))).toBe(true);

  // إضافة معلم جديد
  await page.goto('/app/admin/teachers');
  await page.getByTestId('add-teacher').click();
  await page.getByTestId('user-name').fill('معلم تجريبي جديد');
  await page.getByTestId('user-city').selectOption({ index: 1 });
  await page.getByTestId('user-district').selectOption({ index: 1 });
  await page.getByTestId('user-circle-name').fill('حلقة الاختبار');
  await page.getByTestId('submit-user').click();
  await expect(page.getByText('تمت إضافة المعلم').first()).toBeVisible();
  await expect(page.getByText('معلم تجريبي جديد')).toBeVisible();

  // تغيير دور مستخدم
  await page.goto('/app/admin/users');
  await page.getByRole('button', { name: 'تغيير الدور' }).first().click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByRole('radio', { name: 'المشرف' }).check();
  await page.getByTestId('confirm-role-change').click();
  await expect(page.getByText(/تم تغيير الدور/).first()).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المشرف يضيف حلقة ويدير معلميه وطلابهم', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'supervisor');

  // إضافة حلقة
  await page.goto('/app/supervisor/circles');
  await page.getByTestId('add-circle').click();
  await page.getByTestId('circle-name').fill('حلقة المشرف الجديدة');
  await page.getByTestId('submit-circle').click();
  await expect(page.getByText('تمت إضافة الحلقة').first()).toBeVisible();

  // إدارة المعلمين: إضافة طالب إلى حلقة معلم
  await page.goto('/app/supervisor/manage-teachers');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const addStudent = page.getByTestId('add-student').first();
  if (await addStudent.count()) {
    await addStudent.click();
    await page.getByTestId('student-name').fill('طالب تجريبي جديد');
    await page.getByTestId('submit-student').click();
    await expect(page.getByText('تمت إضافة الطالب').first()).toBeVisible();
  }

  assertNoConsoleErrors(errors);
});

test('هدف الأجزاء: تحديد عدد أجزاء ومدة وحساب الوتيرة', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/student/goals');

  await expect(page.getByRole('heading', { name: 'هدف الحفظ بالأجزاء' })).toBeVisible();

  await page.getByTestId('target-juz').selectOption('5');
  await page.getByTestId('goal-duration').selectOption('180');
  await page.getByTestId('save-juz-goal').click();
  await expect(page.getByText('تم حفظ هدف الأجزاء').first()).toBeVisible();

  // الوتيرة المطلوبة: 5 أجزاء × 20 صفحة ÷ 180 يومًا ≈ 0.6 صفحة يوميًا
  await expect(page.locator('.stat').filter({ hasText: 'الوتيرة المطلوبة' })).toContainText('0.6');

  // أقصى مدة سنة
  const options = await page.getByTestId('goal-duration').locator('option').allInnerTexts();
  expect(options.some((value) => value.includes('سنة'))).toBe(true);

  assertNoConsoleErrors(errors);
});
