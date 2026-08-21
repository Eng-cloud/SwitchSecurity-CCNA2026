import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs } from './helpers.js';

/**
 * ما يملكه المشرف والإدارة فعلًا: مراجعة الطلبات، وإدارة الحلقة من داخلها،
 * ورجوعٌ يعيدهم من حيث أتوا.
 */

async function freshSession(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('halaqat.session');
    window.localStorage.removeItem('halaqat.db');
  });
}

for (const role of ['supervisor', 'admin']) {
  test(`${role}: طلب ولي الأمر يصل ويُقبل فيصير الابن طالبًا`, async ({ page }) => {
    const errors = watchConsole(page);
    await freshSession(page);

    // ولي الأمر يرسل طلبًا جديدًا لحلقة قائمة بعينها.
    await loginAs(page, 'parent');
    await page.goto('/app/parent/requests');

    // القوائم متتالية (المدينة ← الحي ← المسجد ← الحلقة)، فنختار قيم حلقة حقيقية.
    const target = await page.evaluate(() => {
      const db = JSON.parse(localStorage.getItem('halaqat.db'));
      const circle = db.circles[0];
      return {
        city: circle.city,
        district: circle.district,
        mosque: circle.mosque,
        id: circle.id,
      };
    });

    await page.getByTestId('request-child-name').fill('عبدالرحمن السالم');
    await page.getByTestId('request-city').selectOption(target.city);
    await page.getByTestId('request-district').selectOption(target.district);
    await page.getByTestId('request-mosque').selectOption(target.mosque);
    await page.getByTestId('request-circle').selectOption(target.id);
    await page.getByTestId('submit-request').click();
    await expect(page.locator('.toast__message', { hasText: /تم إرسال الطلب/ })).toBeVisible();

    // ثم يراه المراجع ويقبله.
    await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
    await loginAs(page, role);
    await page.goto(`/app/${role}/requests`);

    const card = page.getByTestId('request-card').first();
    await expect(card).toBeVisible();
    await card.getByTestId('approve-request').click();
    // زر التأكيد في الحوار يحمل نص «قبول الطلب» نفسه.
    await page.getByRole('dialog').getByRole('button', { name: 'قبول الطلب' }).click();
    await expect(page.locator('.toast__message', { hasText: /تم قبول الطلب/ })).toBeVisible();

    assertNoConsoleErrors(errors);
  });

  test(`${role}: يدير الحلقة من داخلها — إضافة طالب وحذفه وإيقاف المعلم`, async ({ page }) => {
    const errors = watchConsole(page);
    await freshSession(page);
    await loginAs(page, role);

    await page.goto(`/app/${role}/circles`);
    await page.getByRole('link', { name: 'فتح الحلقة' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${role}/circles/circle-`));

    // الصفحة فيها جدولان (بيانات الرسم البياني وجدول الطلاب)، فنحصر القياس
    // بجدول الطلاب وحده عبر أزرار الصف.
    const studentRows = page.getByTestId('remove-student');
    await expect(studentRows.first()).toBeVisible();
    const rowsBefore = await studentRows.count();

    // إضافة طالب
    await page.getByTestId('add-student').click();
    await page.getByTestId('student-name').fill('سالم عبدالله القحطاني');
    await page.getByTestId('submit-student').click();
    await expect(page.getByText('تمت إضافة الطالب')).toBeVisible();
    await expect(studentRows).toHaveCount(rowsBefore + 1);

    // حذف طالب
    await studentRows.last().click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByText('تم حذف الطالب')).toBeVisible();
    await expect(studentRows).toHaveCount(rowsBefore);

    // إيقاف المعلم ثم إعادة تفعيله
    await page.getByTestId('toggle-teacher').click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByText('تم إيقاف المعلم')).toBeVisible();
    await expect(page.getByText('موقوف')).toBeVisible();

    await page.getByTestId('toggle-teacher').click();
    await page.getByRole('button', { name: 'تأكيد' }).click();
    await expect(page.getByText('تمت إعادة تفعيل المعلم')).toBeVisible();

    assertNoConsoleErrors(errors);
  });

  test(`${role}: الرجوع من ملف الطالب يعيده إلى الحلقة لا إلى الرئيسية`, async ({ page }) => {
    const errors = watchConsole(page);
    await freshSession(page);
    await loginAs(page, role);

    await page.goto(`/app/${role}/circles`);
    await page.getByRole('link', { name: 'فتح الحلقة' }).first().click();
    const circleUrl = page.url();
    expect(circleUrl).toContain('/circles/circle-');

    await page.getByRole('link', { name: 'عرض الطالب' }).first().click();
    await expect(page).toHaveURL(new RegExp(`/app/${role}/students/student-`));

    await page.getByRole('button', { name: 'رجوع' }).click();
    // يعود إلى الحلقة نفسها، لا إلى لوحة الدور.
    await expect(page).toHaveURL(circleUrl);

    assertNoConsoleErrors(errors);
  });
}

test('المعلم لا يوقف نفسه ولا يفتح إدارة الحلقة', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');

  // مسار تفاصيل الحلقة الإشرافي محجوب عنه.
  await page.goto('/app/supervisor/circles/circle-1');
  await expect(page).toHaveURL(/\/app\/teacher/);

  assertNoConsoleErrors(errors);
});
