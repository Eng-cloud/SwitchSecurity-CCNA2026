import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs } from './helpers.js';

/** الاستجابة: الجوال واللوحي وسطح المكتب — إعادة تنظيم لا مجرد تصغير. */

test.describe('الجوال', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('شريط سفلي بدل القائمة الجانبية مع عدد عناصر محدود', async ({ page }) => {
    const errors = watchConsole(page);
    await loginAs(page, 'student');

    await expect(page.locator('[data-app-sidebar]')).toBeHidden();
    const bottomNav = page.locator('[data-app-bottomnav]');
    await expect(bottomNav).toBeVisible();

    const items = bottomNav.getByRole('link');
    const count = await items.count();
    expect(count).toBeGreaterThan(2);
    expect(count).toBeLessThanOrEqual(5);

    await bottomNav.getByRole('link', { name: 'المصحف' }).click();
    await expect(page).toHaveURL(/\/app\/quran/);

    assertNoConsoleErrors(errors);
  });

  test('قائمة الجوال تفتح من زر القائمة وتُغلق بـEscape', async ({ page }) => {
    await loginAs(page, 'teacher');

    await page.getByRole('button', { name: 'فتح القائمة الرئيسية' }).click();
    const drawer = page.getByRole('dialog', { name: 'القائمة' });
    await expect(drawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCount(0);
  });

  test('الجداول تتحول إلى بطاقات مكدّسة بعناوين حقول', async ({ page }) => {
    await loginAs(page, 'teacher');
    await page.goto('/app/teacher/circle');

    const table = page.getByRole('table');
    await expect(table).toBeVisible();
    // رأس الجدول مخفي والحقول موسومة داخل كل صف
    await expect(table.locator('thead')).toBeHidden();
    await expect(table.locator('td[data-label="الطالب"]').first()).toBeVisible();
  });

  test('لا يوجد تجاوز أفقي على الجوال في كل الأدوار', async ({ page }) => {
    await page.goto('/');
    for (const role of ['student', 'teacher', 'supervisor', 'admin', 'parent']) {
      // إنهاء الجلسة السابقة: صفحة التجربة لا تُعرض لمن لديه جلسة فعّالة.
      // eslint-disable-next-line no-await-in-loop
      await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
      // eslint-disable-next-line no-await-in-loop
      await loginAs(page, role);
      // eslint-disable-next-line no-await-in-loop
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      // eslint-disable-next-line no-await-in-loop
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `تجاوز أفقي في لوحة ${role}`).toBeLessThanOrEqual(1);
    }
  });

  test('أهداف اللمس بحجم مناسب في التنقل السفلي', async ({ page }) => {
    await loginAs(page, 'student');
    const link = page.locator('[data-app-bottomnav]').getByRole('link').first();
    const box = await link.boundingBox();
    expect(box.height).toBeGreaterThanOrEqual(44);
  });
});

test.describe('اللوحي', () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test('تخطيط اللوحي يعمل بلا تجاوز', async ({ page }) => {
    const errors = watchConsole(page);
    await loginAs(page, 'admin');
    await page.goto('/app/admin/reports');
    await expect(page.getByRole('table')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
    assertNoConsoleErrors(errors);
  });
});

test.describe('الشاشة الكبيرة', () => {
  test.use({ viewport: { width: 1680, height: 1050 } });

  test('القائمة الجانبية ظاهرة والمحتوى محصور بعرض مقروء', async ({ page }) => {
    await loginAs(page, 'student');
    await expect(page.locator('[data-app-sidebar]')).toBeVisible();
    await expect(page.locator('[data-app-bottomnav]')).toBeHidden();

    const width = await page.locator('.app-main__inner').evaluate((el) => el.clientWidth);
    expect(width).toBeLessThanOrEqual(1200);
  });
});

/**
 * القوائم المنسدلة لا تُقصّ عند أي عرض شاشة.
 *
 * كانت مثبَّتة من الحافة البادئة لزرّها، وأزرار الشريط مجتمعة عند الحافة
 * النهائية، فتخرج القائمة من الشاشة ويصير نصها غير مقروء — على الجوال
 * واللوحي وسطح المكتب معًا. هذا الاختبار يقيس كل قائمة عند كل عرض.
 */
test.describe('القوائم المنسدلة داخل الشاشة', () => {
  const MENUS = [/^تغيير وضع الواجهة/, /^فتح الإشعارات/, /^الحساب/];
  const SIZES = [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 640, height: 900 },
    { width: 820, height: 1180 },
    { width: 1366, height: 900 },
  ];

  for (const size of SIZES) {
    test(`عرض ${size.width}px`, async ({ page }) => {
      const errors = watchConsole(page);
      await page.setViewportSize(size);
      await loginAs(page, 'student');

      for (const name of MENUS) {
        // eslint-disable-next-line no-await-in-loop
        await page.locator('.topbar__actions').getByRole('button', { name }).click();
        // eslint-disable-next-line no-await-in-loop
        const box = await page.locator('.menu').first().boundingBox();
        expect(box, `القائمة ${name} لم تُفتح`).not.toBeNull();
        expect(box.x, `القائمة ${name} مقصوصة من البداية عند ${size.width}px`).toBeGreaterThanOrEqual(-0.5);
        expect(
          box.x + box.width,
          `القائمة ${name} مقصوصة من النهاية عند ${size.width}px`,
        ).toBeLessThanOrEqual(size.width + 0.5);

        // eslint-disable-next-line no-await-in-loop
        await page.keyboard.press('Escape');
        // eslint-disable-next-line no-await-in-loop
        await expect(page.locator('.menu')).toHaveCount(0);
      }

      assertNoConsoleErrors(errors);
    });
  }
});
