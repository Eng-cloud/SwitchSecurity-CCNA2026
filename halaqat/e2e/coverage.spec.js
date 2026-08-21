import { test, expect } from '@playwright/test';
import {
  watchConsole,
  assertNoConsoleErrors,
  loginAs,
  loginWithOtp,
  logout,
  navigate,
} from './helpers.js';

/**
 * التغطية والإنابة — «من يقود الحلقة اليوم؟»
 *
 * السلسلة تُقطع كاملةً في متصفح واحد وبثلاث جلسات، لأن قيمتها في وصلها
 * لا في أجزائها: معلمٌ يغيب، ونائبٌ يعتذر، ومشرفٌ يتولّى الحلقة بنفسه.
 */

const DEPUTY_ID = 'user-teacher-2';

test('السلسلة كاملة: غياب المعلم ← طلب إنابة ← اعتذار ← تولّي المشرف', async ({ page }) => {
  const errors = watchConsole(page);

  /* --- ١) المعلم يسجّل غيابه ويطلب نائبًا --- */
  await loginAs(page, 'teacher');

  // اليوم يبدأ بلا تغطية: الأصل أن تُثبَت لا أن تُفترض.
  const teacherAttendance = page.getByTestId('teacher-attendance');
  await expect(teacherAttendance).toHaveValue('absent');
  await expect(page.getByText('الحلقة اليوم بلا معلّم')).toBeVisible();

  await page.getByTestId('deputy-picker').selectOption(DEPUTY_ID);
  await page.getByTestId('request-deputy').click();
  await expect(page.getByText('أُرسل طلب الإنابة').first()).toBeVisible();
  await expect(page.getByText('بانتظار ردّ النائب').first()).toBeVisible();

  /* --- ٢) النائب يعتذر، فتصعد المسؤولية --- */
  await logout(page);
  await loginWithOtp(page, 'teacher2@halaqat.sa');
  await expect(page).toHaveURL(/\/app\/teacher/);

  const request = page.getByTestId('deputy-request');
  await expect(request).toBeVisible();
  await request.getByTestId('decline-deputy').click();
  await page.getByTestId('decline-reason').fill('عندي ارتباط في حلقتي');
  await page.getByTestId('confirm-decline').click();
  await expect(page.getByText('أُرسل اعتذارك إلى المشرف').first()).toBeVisible();
  // الطلب اختفى من صندوقه: لا يبقى معلّقًا بعد الردّ.
  await expect(page.getByTestId('deputy-request')).toHaveCount(0);

  /* --- ٣) المشرف يجد الحلقة في مقدمة لوحته ويتولّاها --- */
  await logout(page);
  await loginAs(page, 'supervisor');
  await navigate(page, 'تغطية اليوم', /\/app\/supervisor\/coverage/);

  await expect(page.getByText(/حلقات بلا معلّم اليوم/)).toBeVisible();

  // الصف يُلتقط بمحتواه لا بترتيبه: الجوال يطوي رأس الجدول فتتغيّر المواضع.
  const row = page.getByRole('row').filter({ hasText: 'حلقة النور' });
  await expect(row.getByText('تحتاج المشرف')).toBeVisible();
  // ومن اعتذر لا يُعرض نائبًا.
  await expect(row.getByText('بدر الأنصاري')).toHaveCount(0);

  await page.getByTestId('claim-circle-1').click();
  await expect(page.getByText('تولّيت الحلقة اليوم').first()).toBeVisible();
  await expect(row.getByText('يقودها نائب')).toBeVisible();
  await expect(row.getByText('عبدالعزيز الأنصاري')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('عودة المعلم حاضرًا تُنهي الإنابة ولا تترك سلطتين على حلقة', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'teacher');
  const attendance = page.getByTestId('teacher-attendance');

  await page.getByTestId('deputy-picker').selectOption(DEPUTY_ID);
  await page.getByTestId('request-deputy').click();
  await expect(page.getByText('بانتظار ردّ النائب').first()).toBeVisible();

  await attendance.selectOption('present');
  await expect(page.getByText('المعلم حاضر').first()).toBeVisible();
  await expect(page.getByTestId('deputy-picker')).toHaveCount(0);

  assertNoConsoleErrors(errors);
});

test('المشرف يحضّر ويغيّب طلاب حلقته من داخلها', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'supervisor');
  await page.goto('/app/supervisor/circles/circle-1');

  const student = page.getByTestId('attendance-student-1-01');
  await expect(student).toBeVisible();

  await student.selectOption('excused');
  await expect(page.getByText(/حُدِّث حضور .+: مستأذن/).first()).toBeVisible();
  await expect(student).toHaveValue('excused');

  // والتراجع متاح له كما هو متاح للمعلم.
  await student.selectOption('absent');
  await expect(page.getByText(/حُدِّث حضور .+: غائب/).first()).toBeVisible();
  await expect(student).toHaveValue('absent');

  assertNoConsoleErrors(errors);
});

test('الطالب وولي الأمر لا يريان لوحة التغطية', async ({ page }) => {
  for (const role of ['student', 'parent']) {
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await page.goto('/app/supervisor/coverage');
    // eslint-disable-next-line no-await-in-loop
    await expect(page).not.toHaveURL(/\/app\/supervisor\/coverage/);
    // eslint-disable-next-line no-await-in-loop
    await logout(page);
  }
});

test('تغطية اليوم عند المشرف وحده، والإدارة تقرأ تقرير الشهر', async ({ page }) => {
  const errors = watchConsole(page);

  // الإدارة: لا خانة تغطية في تنقّلها ولا مسار.
  await loginAs(page, 'admin');
  await expect(page.getByRole('link', { name: 'تغطية اليوم' })).toHaveCount(0);
  await page.goto('/app/admin/coverage');
  await expect(page.getByRole('heading', { name: 'الصفحة غير موجودة' })).toBeVisible();

  // وبدلًا منها تقرير الشهر: متى حضر المعلم ومتى غاب ومتى استأذن.
  await page.goto('/app/admin/reports');
  await page.getByRole('link', { name: 'حضور المعلمين' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/reports\/teachers/);
  await expect(page.getByRole('heading', { name: 'حضور المعلمين', level: 1 })).toBeVisible();

  // الأرقام لا تكفي جوابًا عن «متى؟» — فالتفصيل يُفتح بالتواريخ.
  await page.getByTestId('open-days-user-teacher-1').click();
  await expect(page.getByTestId('day-log')).toBeVisible();
  await expect(page.getByTestId('day-log').getByText(/حاضر|غائب|مستأذن/).first()).toBeVisible();
  // النافذة فيها زرّ إغلاق أيقوني وآخر نصّي — نقصد الثاني.
  await page.getByRole('dialog').getByRole('button', { name: 'إغلاق', exact: true }).last().click();
  await logout(page);

  // المشرف: لوحة اليوم باقية عنده، ومعها تقرير الشهر.
  await loginAs(page, 'supervisor');
  await expect(page.getByRole('link', { name: 'تغطية اليوم' }).first()).toBeVisible();
  await page.goto('/app/supervisor/reports/teachers');
  await expect(page.getByRole('heading', { name: 'حضور المعلمين', level: 1 })).toBeVisible();

  assertNoConsoleErrors(errors);
});
