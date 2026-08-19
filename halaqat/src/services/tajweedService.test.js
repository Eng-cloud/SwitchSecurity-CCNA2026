import { beforeEach, describe, expect, it } from 'vitest';
import * as tajweedService from './tajweedService.js';
import * as testsService from './testsService.js';
import { getDb, resetDb } from '../mock/db.js';

const SUPER = { role: 'admin', userId: 'user-admin', userName: 'سارة القحطاني' };

/** إداري موجود لكنه محدود الصلاحية — يشاهد ولا يضيف. */
function limitedAdmin() {
  const db = getDb();
  const admin = {
    id: 'user-admin-2',
    name: 'إداري محدود',
    role: 'admin',
    email: 'admin2@halaqat.sa',
    status: 'active',
    adminLevel: 'limited',
  };
  db.users.push(admin);
  return { role: 'admin', userId: admin.id };
}

const VALID = {
  ruleId: 'ikhfa',
  kind: 'clip',
  title: 'تطبيق على الإخفاء',
  url: 'https://example.org/tajweed/new.mp3',
  description: 'أمثلة من جزء عمّ.',
};

describe('مكتبة التجويد — تُقرأ من الجميع وتُكتب من العليا وحدها', () => {
  beforeEach(() => {
    resetDb();
  });

  it('الطالب والمعلم والإدارة يقرؤون، والمشرف وولي الأمر لا', async () => {
    for (const role of ['student', 'teacher', 'admin']) {
      // eslint-disable-next-line no-await-in-loop
      const library = await tajweedService.getLibrary({ role, userId: 'user-admin' });
      expect(library.items.length).toBeGreaterThan(0);
      expect(library.rules.length).toBeGreaterThan(0);
    }

    for (const role of ['supervisor', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(tajweedService.getLibrary({ role, userId: 'x' })).rejects.toMatchObject({
        messageKey: 'state.forbiddenHint',
      });
    }
  });

  it('من يقرأ فقط لا يرى زرّ الإضافة أصلًا', async () => {
    const student = await tajweedService.getLibrary({ role: 'student', userId: 'student-1-01' });
    expect(student.mayManage).toBe(false);

    const superAdmin = await tajweedService.getLibrary(SUPER);
    expect(superAdmin.mayManage).toBe(true);
  });

  it('الإدارة العليا تضيف وتعدّل وتحذف', async () => {
    const added = await tajweedService.addItem({ ...SUPER, ...VALID });
    expect(added.ruleName).toBe('الإخفاء');
    expect(added.categoryName).toBe('أحكام النون الساكنة والتنوين');
    expect(added.addedByName).toBe('سارة القحطاني');

    const updated = await tajweedService.updateItem({
      ...SUPER,
      itemId: added.id,
      title: 'الإخفاء الحقيقي — تطبيق',
    });
    expect(updated.title).toBe('الإخفاء الحقيقي — تطبيق');

    await tajweedService.removeItem({ ...SUPER, itemId: added.id });
    const library = await tajweedService.getLibrary(SUPER);
    expect(library.items.some((item) => item.id === added.id)).toBe(false);
  });

  it('الإداري المحدود يشاهد ولا يضيف — والدور وحده لا يكفي', async () => {
    const limited = limitedAdmin();

    const library = await tajweedService.getLibrary(limited);
    expect(library.items.length).toBeGreaterThan(0);
    expect(library.mayManage).toBe(false);

    await expect(tajweedService.addItem({ ...limited, ...VALID })).rejects.toMatchObject({
      messageKey: 'tajweed.errors.superOnly',
    });
    await expect(
      tajweedService.removeItem({ ...limited, itemId: getDb().tajweedItems[0].id }),
    ).rejects.toMatchObject({ messageKey: 'tajweed.errors.superOnly' });
  });

  it('لا يضيف الطالب ولا المعلم ولا المشرف', async () => {
    for (const role of ['student', 'teacher', 'supervisor', 'parent']) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        tajweedService.addItem({ role, userId: 'student-1-01', ...VALID }),
      ).rejects.toMatchObject({ messageKey: 'tajweed.errors.superOnly' });
    }
    expect(getDb().tajweedItems).toHaveLength(3);
  });

  it('المدخل غير الصالح يُرفض قبل أن يدخل المكتبة', async () => {
    const cases = [
      [{ url: 'ليس رابطًا' }, 'tajweed.errors.invalidUrl'],
      [{ url: 'ftp://example.org/a.mp3' }, 'tajweed.errors.invalidUrl'],
      [{ title: 'أب' }, 'tajweed.errors.shortTitle'],
      [{ ruleId: 'nope' }, 'tajweed.errors.invalidRule'],
      [{ kind: 'video' }, 'tajweed.errors.invalidKind'],
    ];

    for (const [override, messageKey] of cases) {
      // eslint-disable-next-line no-await-in-loop
      await expect(
        tajweedService.addItem({ ...SUPER, ...VALID, ...override }),
      ).rejects.toMatchObject({ messageKey });
    }
    expect(getDb().tajweedItems).toHaveLength(3);
  });

  it('التصفية بالباب والبحث بالعنوان', async () => {
    const byCategory = await tajweedService.getLibrary({ ...SUPER, categoryId: 'noon' });
    expect(byCategory.items.every((item) => item.categoryId === 'noon')).toBe(true);

    const byQuery = await tajweedService.getLibrary({ ...SUPER, query: 'القلقلة' });
    expect(byQuery.items).toHaveLength(1);
  });
});

describe('اختبار التجويد', () => {
  beforeEach(() => {
    resetDb();
  });

  it('يظهر ضمن اختبارات الطالب وله أسئلته من الأحكام نفسها', async () => {
    const list = await testsService.listTests('student-1-01');
    const tajweed = list.find((test) => test.scope === 'tajweed');
    expect(tajweed).toBeTruthy();

    const test = await testsService.getTest(tajweed.id);
    expect(test.questions).toHaveLength(tajweed.questionCount);
    expect(
      test.questions.every((question) => question.type.startsWith('tajweed')),
    ).toBe(true);
    // كل سؤال يحمل إجابته الصحيحة بين خياراته.
    expect(
      test.questions.every((question) => question.options.includes(question.correct)),
    ).toBe(true);
  });

  it('يُصحَّح كغيره وتُحفظ محاولته', async () => {
    const test = await testsService.getTest('test-tajweed-1');
    const answers = Object.fromEntries(
      test.questions.map((question) => [question.id, question.correct]),
    );

    const attempt = await testsService.submitTest('test-tajweed-1', 'student-1-01', answers);
    expect(attempt.score).toBe(100);
    expect(attempt.totalCount).toBe(test.questions.length);
  });
});
