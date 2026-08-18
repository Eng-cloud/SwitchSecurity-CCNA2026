import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginWithOtp, logout } from './helpers.js';

/**
 * رحلة الطالب الكاملة (المواصفات §80):
 * Landing → Login → OTP → Dashboard → Quran → Review → Recitation →
 * Mock AI Result → Save → Weekly Test → Monthly Test → Reports → Settings → Logout
 */
test('رحلة الطالب من البداية إلى النهاية', async ({ page }) => {
  const errors = watchConsole(page);

  // Landing
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  // الدخول (زر الدخول في الترويسة يظهر على سطح المكتب، ونستخدم المسار مباشرة
  // حتى تعمل الرحلة نفسها على الجوال أيضًا)
  await page.goto('/login');
  await expect(page).toHaveURL(/\/login/);
  await loginWithOtp(page, 'student@demo.local');

  // Dashboard
  await expect(page).toHaveURL(/\/app\/student/);
  await expect(page.getByText(/مرحبًا/)).toBeVisible();
  await expect(page.locator('.stat').filter({ hasText: 'هدف اليوم' })).toBeVisible();

  // Quran: library → surah reader
  await page.goto('/app/student/quran');
  await expect(page.getByRole('heading', { name: 'المصحف' })).toBeVisible();
  await page.getByRole('link', { name: /فتح سورة الفاتحة/ }).click();
  await expect(page).toHaveURL(/\/app\/student\/quran\/1/);
  await expect(page.getByText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBeVisible();

  // Review
  await page.goto('/app/student/review');
  await expect(page.getByRole('heading', { name: 'المراجعة' })).toBeVisible();

  // Recitation → Mock AI → Save
  await page.goto('/app/student/recitation');
  await page.getByTestId('start-recitation').click();
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible();
  await page.getByTestId('stop-recitation').click();
  await expect(page.getByTestId('recitation-result')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('تم تحليل التسميع')).toBeVisible();
  // لا يُقدَّم التحليل على أنه ذكاء اصطناعي حقيقي
  await expect(page.getByText(/تحليل تجريبي \(Mock\)/)).toBeVisible();
  await page.getByTestId('save-session').click();
  await expect(page.getByText('تم حفظ الجلسة').first()).toBeVisible();

  // Weekly test: instructions → start → answer → submit → result
  await page.goto('/app/student/tests');
  await page.getByTestId('start-weekly').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('confirm-start-test').click();
  await expect(page).toHaveURL(/\/tests\/test-weekly-1\/run/);

  for (let i = 0; i < 5; i += 1) {
    await page.locator('.answer-option').first().click();
    const next = page.getByRole('button', { name: 'التالي' });
    if (await next.isVisible()) await next.click();
  }
  await page.getByTestId('submit-test').click();
  await expect(page).toHaveURL(/\/tests\/test-weekly-1\/result/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'نتيجة الاختبار' })).toBeVisible();

  // Monthly test
  await page.goto('/app/student/tests');
  await page.getByTestId('start-monthly').click();
  await page.getByTestId('confirm-start-test').click();
  await expect(page).toHaveURL(/\/tests\/test-monthly-1\/run/);
  for (let i = 0; i < 8; i += 1) {
    await page.locator('.answer-option').first().click();
    const next = page.getByRole('button', { name: 'التالي' });
    if (await next.isVisible()) await next.click();
  }
  await page.getByTestId('submit-test').click();
  await expect(page).toHaveURL(/\/tests\/test-monthly-1\/result/, { timeout: 15000 });

  // Reports
  await page.goto('/app/student/reports');
  await expect(page.getByRole('heading', { name: 'التقارير' })).toBeVisible();
  await page.getByRole('tab', { name: 'الاختبارات' }).click();
  await expect(page.getByRole('tab', { name: 'الاختبارات' })).toHaveAttribute('aria-selected', 'true');

  // Settings
  await page.goto('/app/settings');
  await expect(page.getByRole('heading', { name: 'الإعدادات' })).toBeVisible();

  // Logout
  await logout(page);

  // لا يُسمح بالعودة إلى صفحة محمية عبر زر الرجوع بعد الخروج
  await page.goBack();
  await expect(page).toHaveURL(/\/login/);

  assertNoConsoleErrors(errors);
});
