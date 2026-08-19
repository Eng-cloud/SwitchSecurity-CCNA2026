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
  await loginWithOtp(page, 'student@halaqat.sa');

  // Dashboard
  await expect(page).toHaveURL(/\/app\/student/);
  // اللوحة تبدأ بالإنسان لا بالأرقام: تحية، ثم وردُ اليوم بفعله الواحد.
  await expect(page.getByText(/صباح الخير|مساء الخير/)).toBeVisible();
  await expect(page.getByTestId('ward')).toBeVisible();
  await expect(page.getByTestId('ward-start')).toBeVisible();
  // ثم رحلة الأسبوع بثلاثة أرقام.
  await expect(page.getByRole('heading', { name: 'رحلتك هذا الأسبوع' })).toBeVisible();

  // الطالب لا تقارير له ولا صفحة تقدّم: مسؤوليته التوثيق، والتقارير
  // للمعلم فما فوق. المسارات المحذوفة لم تعد موجودة أصلًا.
  for (const gone of ['/app/student/reports', '/app/student/progress']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(gone);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible();
  }

  // Quran: library → surah reader
  await page.goto('/app/quran');
  await expect(page.getByRole('heading', { name: 'المصحف' })).toBeVisible();
  await page.getByRole('link', { name: /فتح سورة الفاتحة/ }).click();
  await expect(page).toHaveURL(/\/app\/quran\/1/);
  await expect(page.getByText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBeVisible();

  // الحفظ الجديد: بابٌ مستقل يزيد الرصيد
  await page.goto('/app/student/recitation');
  await expect(page.getByRole('heading', { name: 'الحفظ الجديد', level: 1 })).toBeVisible();
  await page.getByTestId('start-recitation').click();
  await expect(page.getByText('جارٍ التسجيل')).toBeVisible();
  await page.getByTestId('stop-recitation').click();
  await expect(page.getByTestId('recitation-result')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('تم تحليل التسميع')).toBeVisible();
  // لا يُقدَّم التحليل على أنه ذكاء اصطناعي حقيقي
  // القراءة الآلية مُعلَّمة صراحةً بأنها ليست تقييمًا نهائيًا ولا ذكاءً اصطناعيًا.
  await expect(page.getByText(/ليست تقييمًا بالذكاء الاصطناعي/)).toBeVisible();
  await page.getByTestId('save-session').click();
  await expect(page.getByText('تم حفظ الجلسة').first()).toBeVisible();

  // المراجعة: بابها الخاص بالتسميع — لا يُخلط بالحفظ الجديد
  await page.goto('/app/student/review');
  await page.getByTestId('start-review-recitation').click();
  await expect(page).toHaveURL(/\/app\/student\/review\/recite/);
  await expect(page.getByRole('heading', { name: 'تسميع المراجعة', level: 1 })).toBeVisible();
  await page.getByTestId('start-recitation').click();
  await page.getByTestId('stop-recitation').click();
  await expect(page.getByTestId('recitation-result')).toBeVisible({ timeout: 15000 });
  await page.getByTestId('save-session').click();
  await expect(page.getByText('تم حفظ الجلسة').first()).toBeVisible();

  // ويظهر كلٌّ في بابه من سجل المراجعة
  await page.goto('/app/student/review');
  await page.getByRole('tab', { name: 'حفظ جديد' }).click();
  await expect(page.getByRole('tab', { name: 'حفظ جديد' })).toHaveAttribute(
    'aria-selected',
    'true',
  );

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
