import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs } from './helpers.js';

/** اختبارات الوصول: الكيبورد، التركيز، قارئ الشاشة، الحركة، التباين، التكبير. */

test('التنقل بالكيبورد يصل إلى رابط التخطي ثم إلى المحتوى', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');

  await page.keyboard.press('Tab');
  const skip = page.getByRole('link', { name: 'تخطَّ إلى المحتوى' });
  await expect(skip).toBeFocused();

  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/#main-content/);
  assertNoConsoleErrors(errors);
});

test('مؤشر التركيز ظاهر ولم يُلغَ outline بلا بديل', async ({ page }) => {
  await loginAs(page, 'student');
  await page.keyboard.press('Tab');

  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    const style = getComputedStyle(el);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });

  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
});

test('النافذة الحوارية: حصر التركيز وEscape وإرجاع التركيز', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'teacher');
  await page.goto('/app/teacher/students');
  await page.locator('.card a').first().click();

  const trigger = page.getByTestId('open-note');
  await trigger.click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // التركيز انتقل إلى داخل النافذة
  const focusInside = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]');
    return dialogEl?.contains(document.activeElement) ?? false;
  });
  expect(focusInside).toBe(true);

  // Tab يبقى محصورًا داخل النافذة
  for (let i = 0; i < 12; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await page.keyboard.press('Tab');
  }
  const stillInside = await page.evaluate(() => {
    const dialogEl = document.querySelector('[role="dialog"]');
    return dialogEl?.contains(document.activeElement) ?? false;
  });
  expect(stillInside).toBe(true);

  // Escape يغلق ويعيد التركيز إلى الزر الذي فتحها
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();

  assertNoConsoleErrors(errors);
});

test('لوحة الأوامر تفتح بـCtrl+K وتُغلق بـEscape وتعمل بالأسهم', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');

  await page.keyboard.press('Control+k');
  const palette = page.getByRole('dialog', { name: 'لوحة الأوامر' });
  await expect(palette).toBeVisible();

  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Escape');
  await expect(palette).toHaveCount(0);

  // أمر فعلي: فتح المصحف
  await page.keyboard.press('Control+k');
  await page.getByRole('option', { name: /افتح المصحف/ }).click();
  await expect(page).toHaveURL(/\/app\/student\/quran/);

  assertNoConsoleErrors(errors);
});

test('التبويبات تعمل بالأسهم وتعلن التحديد', async ({ page }) => {
  await loginAs(page, 'student');
  await page.goto('/app/student/reports');

  const first = page.getByRole('tab').first();
  await first.click();
  await expect(first).toHaveAttribute('aria-selected', 'true');

  // في RTL السهم الأيسر يتقدم للتبويب التالي
  await page.keyboard.press('ArrowLeft');
  const second = page.getByRole('tab').nth(1);
  await expect(second).toHaveAttribute('aria-selected', 'true');
  await expect(second).toBeFocused();
});

test('إعدادات الوصول: حجم الخط والتباين وتقليل الحركة تُطبَّق وتُحفظ', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/settings/accessibility');

  await page.getByRole('radio', { name: 'أكبر' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-font-scale', 'xlarge');

  await page.getByRole('radio', { name: 'مرتفع' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');

  await page.getByRole('radio', { name: 'تقليل الحركة' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduced');

  // الحفظ بعد إعادة التحميل
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-font-scale', 'xlarge');
  await expect(page.locator('html')).toHaveAttribute('data-contrast', 'high');

  // لا يوجد تجاوز أفقي بعد تكبير الخط
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  // إعادة الضبط
  await page.getByRole('button', { name: 'إعادة الضبط الافتراضي' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-font-scale', 'normal');

  assertNoConsoleErrors(errors);
});

test('المظهر: فاتح وداكن والنظام مع الحفظ بعد إعادة الفتح', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');

  await page.goto('/app/settings/appearance');
  await page.getByRole('radio', { name: 'داكن' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.getByRole('radio', { name: 'فاتح' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');

  assertNoConsoleErrors(errors);
});

test('وضع النظام يتبع تفضيل نظام التشغيل ويستجيب لتغيّره', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await loginAs(page, 'student');
  await page.goto('/app/settings/appearance');
  await page.getByRole('radio', { name: 'النظام' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  // تغيّر تفضيل النظام أثناء فتح الموقع
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('الرسوم البيانية لها بديل نصي (جدول بيانات)', async ({ page }) => {
  await loginAs(page, 'admin');
  await page.goto('/app/admin');
  const toggle = page.getByRole('button', { name: 'عرض البيانات كجدول' }).first();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'إخفاء الجدول' }).first()).toBeVisible();
});

test('الصفحة تحمل معالم دلالية وعنوانًا واحدًا من المستوى الأول', async ({ page }) => {
  await loginAs(page, 'student');

  await expect(page.locator('main#main-content')).toHaveCount(1);
  // تنقّل رئيسي واحد ظاهر حسب المقاس، ولكل معلم تنقّل اسم مميز
  await expect(page.locator('nav[aria-label="التنقل الرئيسي"], nav[aria-label="التنقل السريع"]').filter({ visible: true })).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
});
