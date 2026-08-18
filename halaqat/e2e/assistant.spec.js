import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, navigate } from './helpers.js';

/**
 * مسار «الطالب المتميز ← مساعد المعلم ← توكيل بالمراجعة ← انتهاء التوكيل».
 * الأهم في هذه الاختبارات: أن التوكيل مؤقت ولا يمنح رتبة معلم.
 */

/** يبدأ من قاعدة بيانات نظيفة حتى لا تتسرب توكيلات بين الاختبارات. */
async function freshSession(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('halaqat.session');
    window.localStorage.removeItem('halaqat.db');
  });
}

/** رابط التنقل موجود؟ (الشريط الجانبي على سطح المكتب، الدرج على الجوال) */
async function navLinkCount(page, name) {
  const sidebar = page.locator('[data-app-sidebar]');
  if (await sidebar.isVisible()) {
    return sidebar.getByRole('link', { name, exact: true }).count();
  }
  await page.getByRole('button', { name: 'فتح القائمة الرئيسية' }).click();
  const drawer = page.getByRole('dialog');
  const count = await drawer.getByRole('link', { name, exact: true }).count();
  await page.keyboard.press('Escape');
  return count;
}

test('المعلم يعيّن مساعدًا ويوكّله بالمراجعة من قسم مستقل', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');

  await navigate(page, 'المساعد', /\/app\/teacher\/assistant/);

  // حدود الدور معروضة صراحةً لا مضمرة.
  await expect(page.getByText('المساعد يبقى طالبًا')).toBeVisible();
  await expect(page.getByText(/لا يمنح الطالب رتبة معلم/)).toBeVisible();

  // مساعد الحلقة التجريبي موجود مع توكيله المبذور.
  await expect(page.getByTestId('assistant-card').first()).toBeVisible();
  const delegationsBefore = await page.getByTestId('delegation-card').count();

  // تعيين متميز جديد مساعدًا.
  await expect(page.getByTestId('eligible-card').first()).toBeVisible();
  const assistantsBefore = await page.getByTestId('assistant-card').count();
  await page.getByTestId('assign-assistant').first().click();
  await expect(page.getByTestId('assistant-card')).toHaveCount(assistantsBefore + 1);

  // ثم توكيله بسماع مراجعة زميلين.
  await page.getByTestId('delegate-open').last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/التوكيل للمراجعة فقط/)).toBeVisible();
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await page.getByTestId('delegate-submit').click();

  await expect(page.getByTestId('delegation-card')).toHaveCount(delegationsBefore + 1);
  await expect(page.getByTestId('delegation-card').first().getByText('مراجعة فقط')).toBeVisible();
  await expect(page.getByTestId('delegation-card').first().getByText('0 من 2')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المعلم لا يضيف طالبًا ولا يحذفه — هذه للمشرف والإدارة', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');

  await navigate(page, 'الحلقة', /\/app\/teacher\/circle/);
  await expect(page.getByRole('button', { name: 'إضافة طالب' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'حذف الطالب' })).toHaveCount(0);

  // ولا تظهر له أقسام المشرف في التنقل.
  expect(await navLinkCount(page, 'المعلمون')).toBe(0);
  expect(await navLinkCount(page, 'طلبات التسجيل')).toBe(0);

  assertNoConsoleErrors(errors);
});

test('الطالب المساعد يرى مهمته المؤقتة ثم تختفي بانتهائها', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'student');

  // لافتة المهمة على اللوحة، ورابط مؤقت في التنقل.
  await expect(page.getByTestId('duty-banner-cta')).toBeVisible();
  expect(await navLinkCount(page, 'مهمة التسميع')).toBe(1);

  await page.getByTestId('duty-banner-cta').click();
  await expect(page).toHaveURL(/\/app\/student\/assistant/);
  await expect(page.getByText('حدود التوكيل')).toBeVisible();
  await expect(page.getByText(/لست معلمًا ولا تملك صلاحياته/)).toBeVisible();

  // يسمّع من بقي من الزملاء حتى تنتهي الأسماء.
  let remaining = await page.getByTestId('record-review').count();
  expect(remaining).toBeGreaterThan(0);

  while (remaining > 0) {
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('record-review').first().click();
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('record-submit').click();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId('record-submit')).toHaveCount(0);
    // eslint-disable-next-line no-await-in-loop
    remaining = await page.getByTestId('record-review').count();
  }

  // انتهت المهمة: عاد الطالب لوضعه الطبيعي والرابط المؤقت اختفى.
  await expect(page.getByText('لا توجد مهمة موكَّلة إليك الآن')).toBeVisible();
  expect(await navLinkCount(page, 'مهمة التسميع')).toBe(0);

  await navigate(page, 'الرئيسية', /\/app\/student/);
  await expect(page.getByTestId('duty-banner-cta')).toHaveCount(0);

  assertNoConsoleErrors(errors);
});

test('المساعد يبقى طالبًا فلا تظهر له صفحات المعلم', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'student');

  // صفحات المعلم محجوبة عنه رغم كونه مساعدًا موكَّلًا.
  for (const path of ['/app/teacher/circle', '/app/teacher/assistant', '/app/teacher/students']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(path);
    // eslint-disable-next-line no-await-in-loop
    await expect(page).toHaveURL(/\/app\/student/);
  }

  assertNoConsoleErrors(errors);
});
