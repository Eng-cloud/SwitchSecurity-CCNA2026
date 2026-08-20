import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, logout } from './helpers.js';

/** الإدارة والإشراف: طلبات التسجيل، إضافة وحذف، وتغيير الأدوار. */

test('ولي الأمر يرسل طلب تسجيل والمشرف يقبله فيُضاف الطالب', async ({ page }) => {
  const errors = watchConsole(page);

  // 1) ولي الأمر يرسل الطلب
  await loginAs(page, 'parent');
  await page.goto('/app/parent/requests');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  await page.getByTestId('request-child-name').fill('يوسف الحربي');
  await page.getByTestId('request-city').selectOption({ index: 1 });
  await page.getByTestId('request-district').selectOption({ index: 1 });
  await page.getByTestId('request-mosque').selectOption({ index: 1 });

  // الحلقات تُصفّى حسب المدينة والحي
  const circleSelect = page.getByTestId('request-circle');
  await expect(circleSelect).toBeEnabled();
  const optionCount = await circleSelect.locator('option').count();

  if (optionCount > 1) {
    await circleSelect.selectOption({ index: 1 });
    await page.getByTestId('submit-request').click();
    await expect(page.getByText('تم إرسال الطلب إلى المشرف والإدارة').first()).toBeVisible();
    await expect(page.getByText('يوسف الحربي')).toBeVisible();
  } else {
    // لا توجد حلقة في هذا الحي — الواجهة تعلن ذلك بوضوح بدل الفشل الصامت
    await expect(page.getByText('لا توجد حلقات في هذا الحي. جرّب حيًا آخر.')).toBeVisible();
  }

  // 2) المشرف يرى الطلب المبدئي ويقبله
  await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
  await loginAs(page, 'supervisor');
  await page.goto('/app/supervisor/requests');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const firstCard = page.getByTestId('request-card').first();
  if (await firstCard.count()) {
    const childName = await firstCard.locator('p').first().innerText();
    await firstCard.getByTestId('approve-request').click();
    await page.getByRole('button', { name: 'قبول الطلب', exact: true }).last().click();
    await expect(page.getByText('تم قبول الطلب وإضافة الطالب إلى الحلقة').first()).toBeVisible();

    // الطالب صار موجودًا فعلًا في البحث
    await page.goto('/app/search');
    await page.locator('main').getByRole('searchbox').fill(childName.split(' ')[0]);
    await expect(page.getByRole('heading', { name: 'الطلاب' })).toBeVisible();
  }

  assertNoConsoleErrors(errors);
});

test('الإدارة: ثلاثة أقسام مع إضافة معلم وتغيير دور', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');

  // الأقسام الثلاثة موجودة كمسارات مستقلة
  for (const path of ['/app/admin/users', '/app/admin/supervisors', '/app/admin/teachers']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(path);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }

  // قسم المستخدمين لا يخلط الطلاب بالإداريين
  await page.goto('/app/admin/users');
  await expect(page.getByRole('table')).toBeVisible();
  const roleCells = page.locator('td[data-label="الدور"]');
  const roles = await roleCells.allInnerTexts();
  expect(roles.every((value) => !value.includes('الطالب'))).toBe(true);

  // إضافة معلم جديد
  await page.goto('/app/admin/teachers');
  await page.getByTestId('add-teacher').click();
  await page.getByTestId('user-name').fill('معلم جديد للاختبار');
  await page.getByTestId('user-city').selectOption({ index: 1 });
  await page.getByTestId('user-district').selectOption({ index: 1 });
  await page.getByTestId('user-circle-name').fill('حلقة الاختبار');
  await page.getByTestId('submit-user').click();
  await expect(page.getByText('تمت إضافة المعلم').first()).toBeVisible();
  await expect(page.getByText('معلم جديد للاختبار')).toBeVisible();

  // «المستخدمون» صارت حسابات الإدارة وحدها: للمعلم قسمه وللمشرف قسمه،
  // فلا يُعاد سردهم هنا. والإضافة من هنا تُنشئ إداريًّا بمستوى صريح.
  await page.goto('/app/admin/users');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByText('معلم جديد للاختبار')).toHaveCount(0);

  await page.getByTestId('add-user').click();
  await page.getByTestId('user-name').fill('إداري للاختبار');
  await page.getByTestId('admin-level').selectOption('limited');
  await page.getByTestId('submit-user').click();
  await expect(page.getByText('إداري للاختبار')).toBeVisible();
  await expect(page.getByText('إداري محدود').first()).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المشرف يدير معلميه وطلابهم ولا يُنشئ حلقة ولا يحذفها', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'supervisor');

  // الحلقة كيانٌ في هيكل المنصة: بناؤه وهدمه قرارٌ إداري لا إشرافي.
  await page.goto('/app/supervisor/circles');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByTestId('add-circle')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'حذف' })).toHaveCount(0);

  // ولا يُسأل عن اسم حلقةٍ عند إضافة معلم، لأنها لن تُنشأ.
  await page.goto('/app/supervisor/manage-teachers');
  await page.getByTestId('add-teacher').click();
  await expect(page.getByTestId('user-circle-name')).toHaveCount(0);
  await page.getByRole('button', { name: 'إلغاء' }).click();

  // إدارة المعلمين: إضافة طالب إلى حلقة معلم
  await page.goto('/app/supervisor/manage-teachers');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

  const addStudent = page.getByTestId('add-student').first();
  if (await addStudent.count()) {
    await addStudent.click();
    await page.getByTestId('student-name').fill('طالب جديد للاختبار');
    await page.getByTestId('submit-student').click();
    await expect(page.getByText('تمت إضافة الطالب').first()).toBeVisible();
  }

  assertNoConsoleErrors(errors);
});

test('هدف الأجزاء: تحديد عدد أجزاء ومدة وحساب الوتيرة', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'student');
  await page.goto('/app/student/goals');

  await expect(page.getByRole('heading', { name: 'هدف الحفظ بالأجزاء' })).toBeVisible();

  await page.getByTestId('target-juz').selectOption('5');
  await page.getByTestId('goal-duration').selectOption('180');
  await page.getByTestId('save-juz-goal').click();
  await expect(page.getByText('تم حفظ هدف الأجزاء').first()).toBeVisible();

  // الوتيرة المطلوبة: 5 أجزاء × 20 صفحة ÷ 180 يومًا ≈ 0.6 صفحة يوميًا
  await expect(page.locator('.stat').filter({ hasText: 'الوتيرة المطلوبة' })).toContainText('0.6');

  // أقصى مدة سنة
  const options = await page.getByTestId('goal-duration').locator('option').allInnerTexts();
  expect(options.some((value) => value.includes('سنة'))).toBe(true);

  assertNoConsoleErrors(errors);
});

test('الإدارة تُنشئ حلقة وتعيّن لها معلمًا ثم تُلغي التعيين', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');

  // معلمٌ بلا حلقة أولًا، وإلا لم يبقَ من يُسنَد.
  await page.goto('/app/admin/teachers');
  await page.getByTestId('add-teacher').click();
  await page.getByTestId('user-name').fill('معلم بلا حلقة');
  await page.getByTestId('submit-user').click();
  await expect(page.getByText('معلم بلا حلقة')).toBeVisible();

  await page.goto('/app/admin/circles');
  await page.getByTestId('create-circle').click();
  await page.getByTestId('circle-name').fill('حلقة الفجر الجديدة');
  await page.getByTestId('circle-city').selectOption({ index: 1 });
  // موعدٌ صريح: حلقةٌ بلا وقتٍ موعدٌ لا يُحضَر.
  await page.getByTestId('circle-days').selectOption('السبت – الأربعاء');
  await page.getByTestId('circle-start').fill('16:00');
  await page.getByTestId('circle-end').fill('17:30');
  await page.getByTestId('submit-circle').click();
  await expect(page.getByText('أُنشئت الحلقة').first()).toBeVisible();

  // الحلقة تولد بلا تعيين، وهي حالة مشروعة لا خطأ.
  const row = page.getByRole('row').filter({ hasText: 'حلقة الفجر الجديدة' });
  await expect(row.getByText('بلا تعيين').first()).toBeVisible();

  await row.getByRole('button', { name: 'بلا تعيين' }).first().click();
  await page.getByTestId('assignee-select').selectOption({ label: 'معلم بلا حلقة' });
  await page.getByTestId('submit-assign').click();
  await expect(page.getByText('تم التعيين').first()).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'حلقة الفجر الجديدة' }).getByText('معلم بلا حلقة'),
  ).toBeVisible();

  // وإلغاء التعيين يُفرغ الخانة.
  await page
    .getByRole('row')
    .filter({ hasText: 'حلقة الفجر الجديدة' })
    .getByRole('button', { name: 'معلم بلا حلقة' })
    .click();
  await page.getByTestId('assignee-select').selectOption('');
  await page.getByTestId('submit-assign').click();
  await expect(page.getByText('أُلغي التعيين').first()).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('تقرير الإدارة بنطاقين: حسب الحلقات وحسب المدن', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');
  await page.goto('/app/admin/reports');

  // الخلايا تُلتقط بوسمها لا برأس الجدول: الجوال يطوي الرأس داخل الخلايا.
  await expect(page.locator('td[data-label="المعلم"]').first()).toBeVisible();

  // «حسب المدن» زرٌّ بدور radio لا مربّع اختيار، فيُنقر ويُفحص بـaria-checked.
  await page.getByRole('radio', { name: 'حسب المدن' }).click();
  await expect(page.getByRole('radio', { name: 'حسب المدن' })).toHaveAttribute(
    'aria-checked',
    'true',
  );

  // أعمدة أخرى لسؤال آخر: المدينة تُقاس بعدد حلقاتها لا بمعلّمها.
  await expect(page.locator('td[data-label="الحلقات"]').first()).toBeVisible();
  await expect(page.locator('td[data-label="المعلم"]')).toHaveCount(0);

  assertNoConsoleErrors(errors);
});

test('تقرير تغطية اليوم يُفتح من التقارير ويُصفّى بالموقع', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'supervisor');

  await page.goto('/app/supervisor/reports');
  await page.getByRole('link', { name: 'تقرير التغطية' }).click();
  await expect(page).toHaveURL(/\/app\/supervisor\/reports\/coverage/);
  await expect(page.getByRole('heading', { name: 'تقرير تغطية اليوم' })).toBeVisible();

  const before = await page.getByRole('row').count();
  await page.getByTestId('report-city').selectOption({ index: 1 });
  await expect(page.getByRole('row')).not.toHaveCount(before);

  // ويُصدَّر كغيره من التقارير.
  await expect(page.getByTestId('open-export')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('موعد الحلقة يُعرض ويُعدَّل، ولا يُقبل منتهيًا قبل بدايته', async ({ page }) => {
  const errors = watchConsole(page);
  await loginAs(page, 'admin');
  await page.goto('/app/admin/circles');

  // كل حلقة تُظهر موعدها في عمود مستقل.
  const first = page.getByTestId(/^edit-schedule-/).first();
  await expect(first).toBeVisible();
  await expect(first).not.toHaveText('بلا موعد');

  await first.click();
  await page.getByTestId('schedule-start').fill('20:00');
  await page.getByTestId('schedule-end').fill('18:00');
  await page.getByTestId('submit-schedule').click();
  await expect(page.getByText('وقت النهاية يجب أن يكون بعد البداية.').first()).toBeVisible();

  await page.getByTestId('schedule-end').fill('21:30');
  await page.getByTestId('submit-schedule').click();
  await expect(page.getByText('حُدِّث موعد الحلقة').first()).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('الإدارة لا ترى لوحة تغطية اليوم داخل الحلقة، والمشرف يراها', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'admin');
  await page.goto('/app/admin/circles/circle-1');
  await expect(page.getByRole('table').first()).toBeVisible();
  // لا لوحة ولا أزرار تصرّف: التصرّف نفسه سقط عنها لا شكله فقط.
  await expect(page.getByTestId('teacher-attendance')).toHaveCount(0);
  await expect(page.getByTestId('claim-coverage')).toHaveCount(0);
  await logout(page);

  await loginAs(page, 'supervisor');
  await page.goto('/app/supervisor/circles/circle-1');
  await expect(page.getByTestId('teacher-attendance')).toBeVisible();

  assertNoConsoleErrors(errors);
});
