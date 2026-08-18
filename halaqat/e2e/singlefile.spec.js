import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors } from './helpers.js';

/** التحقق من نسخة الملف الواحد (توجيه بالـhash، بلا أصول خارجية). */
const APP = 'http://127.0.0.1:4180/halaqat-app.html';

test.use({ viewport: { width: 390, height: 844 } });

test('نسخة الملف الواحد تعمل على الجوال', async ({ page }) => {
  const errors = watchConsole(page);

  await page.goto(APP);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

  // دخول تجريبي عبر التوجيه بالـhash
  await page.getByRole('link', { name: 'تجربة المنصة' }).first().click();
  await expect(page).toHaveURL(/#\/demo/);

  await page.getByTestId('demo-login-student').click();
  await expect(page).toHaveURL(/#\/app\/student/);
  await expect(page.locator('[data-app-bottomnav]')).toBeVisible();

  // تنقّل + رجوع المتصفح
  await page.locator('[data-app-bottomnav]').getByRole('link', { name: 'المصحف' }).click();
  await expect(page).toHaveURL(/#\/app\/quran/);
  await page.goBack();
  await expect(page).toHaveURL(/#\/app\/student$/);

  // رابط عميق مباشر
  await page.goto(`${APP}#/app/quran/1`);
  await expect(page.getByText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBeVisible();

  // لا طلبات لأصول خارجية
  const external = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:4180') && !r.url().startsWith('data:')) {
      external.push(r.url());
    }
  });
  await page.goto(`${APP}#/app/student`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(external, `طلبات خارجية: ${external.join(', ')}`).toEqual([]);

  assertNoConsoleErrors(errors);
});
