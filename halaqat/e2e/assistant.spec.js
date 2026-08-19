import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, navigate, sidebarVisible } from './helpers.js';

/**
 * مسار «الطالب المتميز ← مساعد المعلم ← توكيل بالمراجعة ← انتهاء التوكيل».
 * الأهم في هذه الاختبارات: أن التوكيل مؤقت ولا يمنح رتبة معلم.
 */

/** يبدأ من قاعدة بيانات نظيفة حتى لا تتسرب توكيلات بين الاختبارات. */
async function freshSession(page) {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.removeItem('halaqat.session');
    window.localStorage.removeItem('halaqat.db');
  });
}

/** رابط التنقل موجود؟ (الشريط الجانبي على سطح المكتب، الدرج على الجوال) */
async function navLinkCount(page, name) {
  const sidebar = page.locator('[data-app-sidebar]');
  if (await sidebarVisible(page)) {
    return sidebar.getByRole('link', { name, exact: true }).count();
  }
  await page.getByRole('button', { name: 'فتح القائمة الرئيسية' }).click();
  const drawer = page.getByRole('dialog');
  const count = await drawer.getByRole('link', { name, exact: true }).count();
  await page.keyboard.press('Escape');
  return count;
}


/**
 * يزرع نشاطًا معلومًا داخل الشهر الجاري لطلاب حلقة، فلا تعتمد الاختبارات على
 * موضع اليوم من الشهر (أول الشهر قد يخلو من نشاط كافٍ بطبيعته).
 */
async function seedMonthlyStars(page, circleId = 'circle-1', count = 3) {
  await page.evaluate(
    ({ circleId, count }) => {
      const db = JSON.parse(localStorage.getItem('halaqat.db'));
      const now = new Date();
      const day = (i) => new Date(now.getFullYear(), now.getMonth(), 1 + i, 12).toISOString();
      const members = db.students.filter((s) => s.circleId === circleId).slice(0, count);

      members.forEach((student, index) => {
        db.sessions = db.sessions.filter((x) => x.studentId !== student.id);
        db.attendance = db.attendance.filter((x) => x.studentId !== student.id);
        for (let i = 0; i < 5; i += 1) {
          db.sessions.push({
            id: `seed-s-${student.id}-${i}`,
            studentId: student.id,
            circleId,
            teacherId: student.teacherId,
            type: 'review',
            mastery: 97 - index,
            grade: 'excellent',
            createdAt: day(i),
          });
          db.attendance.push({
            id: `seed-a-${student.id}-${i}`,
            studentId: student.id,
            circleId,
            date: day(i),
            status: 'present',
          });
        }
      });
      localStorage.setItem('halaqat.db', JSON.stringify(db));
    },
    { circleId, count },
  );
}

test('المعلم يعيّن مساعدًا ويوكّله بالمراجعة من قسم مستقل', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');

  await navigate(page, 'المساعد', /\/app\/teacher\/assistant/);

  // حدود الدور معروضة صراحةً لا مضمرة.
  await expect(page.getByText('المساعد يبقى طالبًا')).toBeVisible();
  await expect(page.getByText(/لا يمنح الطالب رتبة معلم/)).toBeVisible();

  // مساعد الحلقة التجريبي موجود مع توكيله المبذور.
  await expect(page.getByTestId('assistant-card').first()).toBeVisible();
  const delegationsBefore = await page.getByTestId('delegation-card').count();

  // تعيين متميز جديد مساعدًا.
  await expect(page.getByTestId('eligible-card').first()).toBeVisible();
  const assistantsBefore = await page.getByTestId('assistant-card').count();
  await page.getByTestId('assign-assistant').first().click();
  await expect(page.getByTestId('assistant-card')).toHaveCount(assistantsBefore + 1);

  // ثم توكيله بسماع مراجعة زميلين.
  await page.getByTestId('delegate-open').last().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText(/التوكيل للمراجعة فقط/)).toBeVisible();
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await page.getByTestId('delegate-submit').click();

  await expect(page.getByTestId('delegation-card')).toHaveCount(delegationsBefore + 1);
  await expect(page.getByTestId('delegation-card').first().getByText('مراجعة فقط')).toBeVisible();
  await expect(page.getByTestId('delegation-card').first().getByText('0 من 2')).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المعلم لا يضيف طالبًا ولا يحذفه — هذه للمشرف والإدارة', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');

  await navigate(page, 'الحلقة', /\/app\/teacher\/circle/);
  await expect(page.getByRole('button', { name: 'إضافة طالب' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'حذف الطالب' })).toHaveCount(0);

  // ولا تظهر له أقسام المشرف في التنقل.
  expect(await navLinkCount(page, 'المعلمون')).toBe(0);
  expect(await navLinkCount(page, 'طلبات التسجيل')).toBe(0);

  assertNoConsoleErrors(errors);
});

test('الطالب المساعد يرى مهمته المؤقتة ثم تختفي بانتهائها', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'student');

  // لافتة المهمة على اللوحة، ورابط مؤقت في التنقل.
  await expect(page.getByTestId('duty-banner-cta')).toBeVisible();
  expect(await navLinkCount(page, 'مهمة التسميع')).toBe(1);

  await page.getByTestId('duty-banner-cta').click();
  await expect(page).toHaveURL(/\/app\/student\/assistant/);
  await expect(page.getByText('حدود التوكيل')).toBeVisible();
  await expect(page.getByText(/لست معلمًا ولا تملك صلاحياته/)).toBeVisible();

  // يسمّع من بقي من الزملاء حتى تنتهي الأسماء.
  let remaining = await page.getByTestId('record-review').count();
  expect(remaining).toBeGreaterThan(0);

  while (remaining > 0) {
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('record-review').first().click();
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('record-submit').click();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId('record-submit')).toHaveCount(0);
    // eslint-disable-next-line no-await-in-loop
    remaining = await page.getByTestId('record-review').count();
  }

  // انتهت المهمة: عاد الطالب لوضعه الطبيعي والرابط المؤقت اختفى.
  await expect(page.getByText('لا توجد مهمة موكَّلة إليك الآن')).toBeVisible();
  expect(await navLinkCount(page, 'مهمة التسميع')).toBe(0);

  await navigate(page, 'الرئيسية', /\/app\/student/);
  await expect(page.getByTestId('duty-banner-cta')).toHaveCount(0);

  assertNoConsoleErrors(errors);
});

test('المساعد يبقى طالبًا فلا تظهر له صفحات المعلم', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'student');

  // صفحات المعلم محجوبة عنه رغم كونه مساعدًا موكَّلًا.
  for (const path of ['/app/teacher/circle', '/app/teacher/assistant', '/app/teacher/students']) {
    // eslint-disable-next-line no-await-in-loop
    await page.goto(path);
    // eslint-disable-next-line no-await-in-loop
    await expect(page).toHaveURL(/\/app\/student/);
  }

  assertNoConsoleErrors(errors);
});


/* ===============================================================
   متميزو الشهر
   =============================================================== */

test('المعلم يرى متميزي الشهر في حلقته ويعيّن منهم مساعدًا', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'teacher');
  await seedMonthlyStars(page);
  await page.goto('/app/teacher/assistant');

  await expect(page.getByRole('heading', { name: 'متميزو الشهر' })).toBeVisible();
  // المعايير معلنة لا خفية.
  await expect(page.getByText(/يُحتسب من نشاط الشهر نفسه/)).toBeVisible();

  const rows = page.getByTestId('distinguished-row');
  await expect(rows.first()).toBeVisible();

  // كل صف يعرض معاييره الثلاثة فيُفهم سبب الترتيب.
  await expect(rows.first()).toContainText('إتقان الشهر');
  await expect(rows.first()).toContainText('حضور الشهر');
  await expect(rows.first()).toContainText('جلسات الشهر');

  // ومن هذه القائمة يعيَّن المساعد مباشرة — لا يُعرض اسم ثم يُرفض تعيينه.
  await page.getByTestId('assign-from-monthly').first().click();
  await expect(page.getByText('تم تعيين الطالب مساعدًا للمعلم')).toBeVisible();

  // تبديل المدة يعمل بلا خطأ.
  await page.getByTestId('month-select').selectOption('previous');
  await expect(page.getByRole('heading', { name: 'متميزو الشهر' })).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المشرف يرى متميزي الشهر في حلقاته', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'supervisor');
  await seedMonthlyStars(page);

  await navigate(page, 'المتميزون', /\/app\/supervisor\/distinguished/);
  await expect(page.getByRole('heading', { name: 'متميزو الشهر', level: 1 })).toBeVisible();
  await expect(page.getByText(/يُحتسب من نشاط الشهر نفسه/)).toBeVisible();

  // المشرف يرى متميزي حلقاته فعلًا — لا حالة فارغة.
  await expect(page.getByTestId('distinguished-row').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'الأعلى على مستوى حلقاتك' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'حسب الحلقة' })).toBeVisible();
  // واسم الحلقة يظهر في الترتيب الموحّد ليعرف أين الطالب.
  await expect(page.getByTestId('distinguished-row').first()).toContainText('حلقة');

  await page.getByTestId('month-select').selectOption('previous');
  await expect(page.getByRole('heading', { name: 'متميزو الشهر', level: 1 })).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المتميزون محجوبون عن الطالب وولي الأمر', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);
  await loginAs(page, 'student');
  expect(await navLinkCount(page, 'المتميزون')).toBe(0);
  await page.goto('/app/supervisor/distinguished');
  await expect(page).toHaveURL(/\/app\/student/);

  assertNoConsoleErrors(errors);
});

/* ===============================================================
   المساعد يختار زملاءه بنفسه
   =============================================================== */

test('المعلم يفوّض الاختيار للمساعد فيختار زملاءه ويسمّع لهم', async ({ page }) => {
  const errors = watchConsole(page);
  await freshSession(page);

  // 1) المعلم: ينهي التوكيل المبذور ثم يوكّل بوضع «المساعد يختار».
  await loginAs(page, 'teacher');
  await page.goto('/app/teacher/assistant');

  await page.getByRole('button', { name: 'إنهاء التوكيل' }).first().click();
  await page.getByRole('button', { name: 'تأكيد' }).click();
  await expect(page.getByText('تم إنهاء التوكيل')).toBeVisible();

  await page.getByTestId('delegate-open').first().click();
  await page.getByRole('radio', { name: 'المساعد يختار بنفسه' }).check();
  await page.getByTestId('delegate-quota').fill('2');
  await page.getByTestId('delegate-submit').click();
  await expect(page.getByText('تم توكيل المساعد بالطلاب المحددين')).toBeVisible();

  // المعلم يرى أن التوكيل بانتظار اختيار المساعد.
  await expect(page.getByText('بانتظار اختيار المساعد').first()).toBeVisible();

  // 2) الطالب المساعد: يختار زميلين ثم يسمّع لهما.
  await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
  await loginAs(page, 'student');
  await page.goto('/app/student/assistant');

  await page.getByTestId('choose-open').click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('checkbox').nth(0).check();
  await dialog.getByRole('checkbox').nth(1).check();
  await page.getByTestId('choose-submit').click();
  await expect(page.getByText('تم تسجيل اختيارك')).toBeVisible();

  // اختفى نداء الاختيار وظهر الاسمان.
  await expect(page.getByTestId('choose-open')).toHaveCount(0);
  await expect(page.getByTestId('duty-item')).toHaveCount(2);

  await page.getByTestId('record-review').first().click();
  await page.getByTestId('record-submit').click();
  await expect(page.getByTestId('record-submit')).toHaveCount(0);
  await page.getByTestId('record-review').first().click();
  await page.getByTestId('record-submit').click();

  // اكتملت الحصة اختيارًا وسماعًا ⇒ انتهى التوكيل.
  await expect(page.getByText('لا توجد مهمة موكَّلة إليك الآن')).toBeVisible();

  // 3) المعلم يرى أن الأسماء اختارها المساعد.
  await page.evaluate(() => window.localStorage.removeItem('halaqat.session'));
  await loginAs(page, 'teacher');
  await page.goto('/app/teacher/assistant');
  await expect(page.getByText('اختاره المساعد').first()).toBeVisible();

  assertNoConsoleErrors(errors);
});
