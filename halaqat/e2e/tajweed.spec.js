import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, logout, navigate } from './helpers.js';

/**
 * التجويد — يُقرأ من الطالب والمعلم، ويُضاف من الإدارة العليا وحدها.
 */

test('الإدارة تضيف مقطعًا فيراه الطالب والمعلم', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'admin');
  await navigate(page, 'التجويد', /\/app\/tajweed/);
  await expect(page.getByRole('heading', { name: 'التجويد', level: 1 })).toBeVisible();

  const before = await page.getByTestId('tajweed-item').count();

  await page.getByTestId('add-tajweed').click();
  await page.getByTestId('tajweed-rule').selectOption('iqlab');
  await page.getByTestId('tajweed-kind').selectOption('link');
  await page.getByTestId('tajweed-title').fill('الإقلاب — شرح مصوّر');
  await page.getByTestId('tajweed-url').fill('https://example.org/tajweed/iqlab');
  await page.getByTestId('save-tajweed').click();

  await expect(page.getByText('أُضيف إلى مكتبة التجويد').first()).toBeVisible();
  await expect(page.getByTestId('tajweed-item')).toHaveCount(before + 1);
  await logout(page);

  // الطالب يراه ولا يملك إضافته.
  await loginAs(page, 'student');
  await navigate(page, 'التجويد', /\/app\/tajweed/);
  await expect(page.getByText('الإقلاب — شرح مصوّر')).toBeVisible();
  await expect(page.getByTestId('add-tajweed')).toHaveCount(0);
  await expect(page.getByTestId('remove-tajweed')).toHaveCount(0);
  await logout(page);

  // والمعلم كذلك.
  await loginAs(page, 'teacher');
  await page.goto('/app/tajweed');
  await expect(page.getByText('الإقلاب — شرح مصوّر')).toBeVisible();
  await expect(page.getByTestId('add-tajweed')).toHaveCount(0);

  assertNoConsoleErrors(errors);
});

test('التجويد محجوب عن المشرف وولي الأمر', async ({ page }) => {
  for (const role of ['supervisor', 'parent']) {
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await page.goto('/app/tajweed');
    // eslint-disable-next-line no-await-in-loop
    await expect(page).toHaveURL(new RegExp(`/app/${role}`));
    // eslint-disable-next-line no-await-in-loop
    await logout(page);
  }
});

test('الأحكام تُعرض وتُصفّى بالباب', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/tajweed');

  await expect(page.getByText('الإخفاء الحقيقي — شرح وتطبيق')).toBeVisible();

  await page.getByTestId('tajweed-category').selectOption('qalqalah');
  await expect(page.getByTestId('tajweed-item')).toHaveCount(1);
  await expect(page.getByText('القلقلة الكبرى عند الوقف')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('اختبار التجويد متاح للطالب ويُصحَّح', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/student/tests');

  await expect(page.getByText('اختبار التجويد')).toBeVisible();
  await page.getByTestId('start-tajweed').click();
  await page.getByTestId('confirm-start-test').click();
  await expect(page).toHaveURL(/\/tests\/test-tajweed-1\/run/);

  // الأسئلة من الأحكام نفسها التي يعرضها القسم — لا من نصّ السور.
  await expect(page.getByText('أيُّ حكمٍ ينطبق عليه هذا التعريف؟')).toBeVisible();

  for (let index = 0; index < 6; index += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.locator('.answer-option').first().click();
    const next = page.getByRole('button', { name: 'التالي' });
    // eslint-disable-next-line no-await-in-loop
    if (await next.isVisible()) await next.click();
  }
  await page.getByTestId('submit-test').click();
  await expect(page).toHaveURL(/\/tests\/test-tajweed-1\/result/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible();

  assertNoConsoleErrors(errors);
});
