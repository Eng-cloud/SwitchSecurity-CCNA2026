import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, navigate } from './helpers.js';

/** سلوك الواجهة: حفظ حالة الصفحة، النماذج، الحالات، عدم وجود Overflow. */

test('حفظ حالة القائمة: بحث + صفحة ثم الرجوع يعيد نفس الحالة', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');
  await page.goto('/app/admin/users');

  await page.getByPlaceholder('ابحث...').fill('ا');
  await expect(page).toHaveURL(/q=/);

  // الانتقال إلى صفحة 2 إن وُجدت
  const pageTwo = page.getByRole('button', { name: 'صفحة 2' });
  if (await pageTwo.count()) {
    await pageTwo.click();
    await expect(page).toHaveURL(/page=2/);
  }

  const urlBefore = page.url();

  // فتح صفحة أخرى ثم الرجوع
  await page.goto('/app/admin/circles');
  await page.goBack();

  await expect(page).toHaveURL(urlBefore);
  await expect(page.getByPlaceholder('ابحث...')).toHaveValue('ا');
  assertNoConsoleErrors(errors);
});

test('استعادة موضع التمرير عند الرجوع', async ({ page }) => {
  await loginAs(page, 'teacher');
  await navigate(page, 'الحلقة');
  await expect(page.getByRole('table')).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 400));
  await page.waitForTimeout(300);

  // تنقّل داخل التطبيق (وليس إعادة تحميل) حتى يعمل حفظ الموضع
  await navigate(page, 'التقارير');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goBack();

  await page.waitForTimeout(400);
  const scrollY = await page.evaluate(() => window.scrollY);
  expect(scrollY).toBeGreaterThan(100);
});

test('نموذج الدخول: تحقق من الحقل الفارغ والصيغة الخاطئة والحساب غير الموجود', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/login');

  // فارغ
  await page.getByTestId('login-submit').click();
  await expect(page.getByText('أدخل البريد الإلكتروني أو رقم الجوال.')).toBeVisible();

  // صيغة خاطئة
  await page.getByRole('textbox').fill('غير صحيح');
  await page.getByTestId('login-submit').click();
  await expect(page.getByText('أدخل وسيلة دخول صحيحة.')).toBeVisible();

  // صيغة صحيحة لكن غير مسجلة
  await page.getByRole('textbox').fill('nobody@nowhere.local');
  await page.getByTestId('login-submit').click();
  await expect(page.getByText('لا يوجد حساب بهذه الوسيلة. جرّب الحسابات التجريبية.').first()).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('رمز التحقق: رمز خاطئ يعرض خطأ ثم الرمز الصحيح ينجح', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/login');
  await page.getByRole('textbox').fill('student@demo.local');
  await page.getByTestId('login-submit').click();
  await expect(page).toHaveURL(/verify/);

  // رمز خاطئ
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId(`otp-digit-${i}`).fill('9');
  }
  await expect(page.getByText('الرمز غير صحيح. تحقق منه وحاول مرة أخرى.').first()).toBeVisible();

  // الرمز الصحيح
  const code = '123456';
  for (let i = 0; i < 6; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId(`otp-digit-${i}`).fill(code[i]);
  }
  await expect(page).toHaveURL(/\/app\/student/);
  assertNoConsoleErrors(errors);
});

test('التسجيل: خطوتان مع تحقق ثم رمز التحقق', async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto('/register');

  await page.getByRole('button', { name: 'التالي' }).click();
  await expect(page.getByText('أدخل الاسم الكامل.')).toBeVisible();

  await page.getByRole('textbox').first().fill('مستخدم تجريبي جديد');
  await page.getByRole('textbox').nth(1).fill('new.teacher@demo.local');
  await page.getByRole('button', { name: 'التالي' }).click();

  await expect(page.getByText('اختيار الدور')).toBeVisible();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page.getByText('يجب الموافقة على الشروط للمتابعة.')).toBeVisible();

  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click();
  await expect(page).toHaveURL(/verify/);

  assertNoConsoleErrors(errors);
});

test('البحث: حالة التلميح ثم النتائج ثم الحالة الفارغة', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'supervisor');
  await page.goto('/app/search');

  await expect(page.getByText('اكتب حرفين على الأقل لبدء البحث.')).toBeVisible();

  await page.locator('main').getByRole('searchbox').fill('حلقة');
  await expect(page.getByText(/نتائج البحث عن/)).toBeVisible();

  await page.locator('main').getByRole('searchbox').fill('ززززز');
  await expect(page.getByText('لا توجد نتائج مطابقة.')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المصحف: تحميل دون اتصال ثم محاكاة القطع تُبقي المحتوى متاحًا', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/quran/1');

  await page.getByRole('button', { name: 'تحميل للقراءة دون اتصال' }).click();
  await expect(page.getByText('متاح دون اتصال')).toBeVisible({ timeout: 15000 });

  await page.getByRole('button', { name: 'محاكاة انقطاع الاتصال' }).click();
  await expect(page.getByText('أنت دون اتصال — تعرض المنصة المحتوى المحفوظ.')).toBeVisible();

  // السورة المحمّلة ما زالت تُقرأ دون اتصال
  await page.reload();
  await expect(page.getByText('الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('الإشعارات: تعليم كمقروء يحدّث العداد', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/notifications');

  const markAll = page.getByRole('button', { name: 'تعليم الكل كمقروء' });
  if (await markAll.count()) {
    await markAll.click();
    await expect(page.getByText('لا توجد إشعارات غير مقروءة')).toBeVisible();
  }
  assertNoConsoleErrors(errors);
});

test('لا يوجد تجاوز أفقي في الصفحات الأساسية', async ({ page }) => {
  await loginAs(page, 'teacher');

  for (const path of ['/app/teacher', '/app/teacher/circle', '/app/teacher/reports']) {
    await page.goto(path);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `تجاوز أفقي في ${path}`).toBeLessThanOrEqual(1);
  }
});
