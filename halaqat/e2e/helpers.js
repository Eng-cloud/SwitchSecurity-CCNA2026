import { expect } from '@playwright/test';

/**
 * أدوات مشتركة لاختبارات E2E.
 * أهمها: مراقبة أخطاء Console في كل اختبار.
 */

/** يبدأ مراقبة أخطاء الـConsole وأخطاء الصفحة. */
export function watchConsole(page) {
  const errors = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    const text = message.text();
    // تجاهل طلب أيقونة الموقع التلقائي من المتصفح (يُقدَّمها المضيف لا التطبيق).
    const source = message.location?.().url ?? '';
    if (text.includes('favicon') || source.includes('favicon')) return;
    errors.push(text);
  });

  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`);
  });

  return errors;
}

export function assertNoConsoleErrors(errors) {
  expect(errors, `أخطاء Console: ${errors.join(' | ')}`).toEqual([]);
}

/** الدخول التجريبي بدور محدد مباشرة من صفحة التجربة. */
export async function loginAs(page, role) {
  await page.goto('/demo');
  await page.getByTestId(`demo-login-${role}`).click();
  await expect(page).toHaveURL(new RegExp(`/app/${role}`));
}

/** رحلة الدخول الكاملة عبر البريد + رمز التحقق. */
export async function loginWithOtp(page, email = 'student@halaqat.sa') {
  await page.goto('/login');
  await page.getByLabel(/البريد الإلكتروني أو رقم الجوال/).fill(email);
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/\/login\/verify/);

  await page.getByTestId('otp-digit-0').fill('1');
  await page.getByTestId('otp-digit-1').fill('2');
  await page.getByTestId('otp-digit-2').fill('3');
  await page.getByTestId('otp-digit-3').fill('4');
  await page.getByTestId('otp-digit-4').fill('5');
  await page.getByTestId('otp-digit-5').fill('6');
}

/** تسجيل الخروج من قائمة المستخدم. */
export async function logout(page) {
  await page.getByRole('button', { name: /الحساب/ }).click();
  await page.getByRole('menuitem', { name: 'تسجيل الخروج' }).click();
  await page.getByRole('button', { name: 'تسجيل الخروج', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
}

/**
 * أيّ تنقّلٍ تعرضه الشاشة الآن: الشريط الجانبي أم زرّ الدرج؟
 *
 * السؤال لا يُطرح قبل أن يستقرّ أحدهما على الشاشة. سؤالٌ سابقٌ لأوانه —
 * أثناء انتقال المسار مثلًا — يقرأ «لا شريط» فيمضي إلى فرع الجوال
 * وينتظر زرًّا لن يظهر على سطح المكتب أبدًا.
 */
export async function sidebarVisible(page) {
  const sidebar = page.locator('[data-app-sidebar]');
  const menuButton = page.getByRole('button', { name: 'فتح القائمة الرئيسية' });

  // ننتظر أن يستقرّ أحدهما — أيّهما كان — قبل أن نقرأ أيّ تخطيطٍ نحن فيه.
  await expect(async () => {
    const ready = (await sidebar.isVisible()) || (await menuButton.isVisible());
    expect(ready, 'لم يظهر الشريط الجانبي ولا زر الدرج').toBe(true);
  }).toPass({ timeout: 10_000 });

  return sidebar.isVisible();
}

/**
 * تنقّل داخل التطبيق يعمل على كل المقاسات:
 * سطح المكتب من القائمة الجانبية، والجوال من قائمة الدرج.
 */
export async function navigate(page, linkName, expectedUrl) {
  const sidebar = page.locator('[data-app-sidebar]');
  if (await sidebarVisible(page)) {
    await sidebar.getByRole('link', { name: linkName, exact: true }).click();
  } else {
    await page.getByRole('button', { name: 'فتح القائمة الرئيسية' }).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('link', { name: linkName, exact: true }).click();
  }
  if (expectedUrl) await expect(page).toHaveURL(expectedUrl);
}
