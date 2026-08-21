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
  await page.getByRole('link', { name: 'استعراض الأدوار' }).first().click();
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

/**
 * لا يوجد رابط داخلي بوسم <a> عادي.
 *
 * في نسخة الملف الواحد يبني React Router روابطه بصيغة `#/app/...`، فأي رابط
 * يبدأ بـ`/app` معناه وسم `<a href>` مكتوب يدويًا — وهذا يخرج المتصفح من
 * التطبيق إلى مسار غير موجود على المضيف فتظهر صفحة فارغة.
 */
test('كل الروابط الداخلية تمر بالموجّه لا بوسم <a> عادي', async ({ page }) => {
  const errors = watchConsole(page);

  await page.goto(`${APP}#/demo`);
  await page.getByTestId('demo-login-teacher').click();
  await expect(page).toHaveURL(/#\/app\/teacher/);

  const pages = [
    '#/app/teacher',
    '#/app/teacher/circle',
    '#/app/teacher/students',
    '#/app/teacher/assistant',
    '#/app/teacher/sessions',
    '#/app/teacher/reports',
    '#/app/quran',
    '#/app/settings',
    '#/app/notifications',
  ];

  for (const path of pages) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`${APP}${path}`);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    const raw = await page.locator('a[href^="/app"]').evaluateAll((nodes) =>
      nodes.map((node) => `${node.getAttribute('href')} (${node.textContent?.trim()})`),
    );
    expect(raw, `روابط خارج الموجّه في ${path}: ${raw.join(' | ')}`).toEqual([]);
  }

  // والنقر على اسم الطالب يفتح ملفه داخل التطبيق فعليًا.
  await page.goto(`${APP}#/app/teacher/circle`);
  await expect(page.getByRole('table')).toBeVisible();
  await page.locator('table').getByRole('link').first().click();
  await expect(page).toHaveURL(/#\/app\/teacher\/students\/student-/);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  assertNoConsoleErrors(errors);
});
