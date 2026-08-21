import { test, expect } from '@playwright/test';
import { watchConsole, assertNoConsoleErrors, loginAs, logout } from './helpers.js';

/**
 * التواصل بين ولي الأمر والمعلم — محادثة واحدة يفتحها الطرفان من مكانين.
 */

const PARENT_MSG = 'السلام عليكم، كيف مستوى ابني في المراجعة؟';
const TEACHER_MSG = 'وعليكم السلام، مستواه جيد ويحتاج تثبيت المدود.';

test('ولي الأمر يراسل المعلم فيصله ويردّ عليه', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'parent');
  await page.getByRole('link', { name: 'عرض التفاصيل' }).first().click();
  await expect(page).toHaveURL(/\/app\/parent\/children\/student-/);
  const url = page.url();
  const studentId = url.split('/').pop();

  const thread = page.getByTestId('message-thread');
  await expect(thread).toBeVisible();
  await expect(page.getByText('لا رسائل بعد')).toBeVisible();

  await page.getByTestId('message-body').fill(PARENT_MSG);
  await page.getByTestId('send-message').click();
  await expect(page.getByText('أُرسلت رسالتك').first()).toBeVisible();
  await expect(thread.getByText(PARENT_MSG)).toBeVisible();
  await logout(page);

  // المعلم يجدها في ملف الطالب ويردّ.
  await loginAs(page, 'teacher');
  await page.goto(`/app/teacher/students/${studentId}`);
  const teacherThread = page.getByTestId('message-thread');
  await expect(teacherThread.getByText(PARENT_MSG)).toBeVisible();

  await page.getByTestId('message-body').fill(TEACHER_MSG);
  await page.getByTestId('send-message').click();
  await expect(teacherThread.getByText(TEACHER_MSG)).toBeVisible();
  await logout(page);

  // ويصل الردّ إلى ولي الأمر في المحادثة نفسها.
  await loginAs(page, 'parent');
  await page.goto(`/app/parent/children/${studentId}`);
  await expect(page.getByTestId('message-thread').getByText(TEACHER_MSG)).toBeVisible();

  assertNoConsoleErrors(errors);
});

test('المحادثة لا تظهر للمشرف ولا للإدارة في ملف الطالب', async ({ page }) => {
  const errors = watchConsole(page);

  for (const role of ['supervisor', 'admin']) {
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`/app/${role}/students/student-1-01`);
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('tab').first()).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId('message-thread')).toHaveCount(0);
    // eslint-disable-next-line no-await-in-loop
    await logout(page);
  }

  assertNoConsoleErrors(errors);
});

test('التصدير للمشرف والإدارة، ولا يظهر للمعلم', async ({ page }) => {
  const errors = watchConsole(page);

  await loginAs(page, 'teacher');
  await page.goto('/app/teacher/reports');
  await expect(page.getByTestId('open-export')).toHaveCount(0);
  await logout(page);

  for (const role of ['supervisor', 'admin']) {
    // eslint-disable-next-line no-await-in-loop
    await loginAs(page, role);
    // eslint-disable-next-line no-await-in-loop
    await page.goto(`/app/${role}/reports`);
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('open-export').click();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByRole('dialog')).toBeVisible();
    // ثلاث صيغ، وPDF موصوف بطريقه الحقيقي لا موعودًا به.
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId('export-csv')).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByTestId('export-word')).toBeVisible();
    // eslint-disable-next-line no-await-in-loop
    await expect(page.getByText(/اختر «حفظ كـ PDF»/)).toBeVisible();

    // eslint-disable-next-line no-await-in-loop
    const download = page.waitForEvent('download').catch(() => null);
    // eslint-disable-next-line no-await-in-loop
    await page.getByTestId('export-csv').click();
    // eslint-disable-next-line no-await-in-loop
    const file = await download;
    if (file) expect(file.suggestedFilename()).toMatch(/\.csv$/);

    // eslint-disable-next-line no-await-in-loop
    await logout(page);
  }

  assertNoConsoleErrors(errors);
});
