/**
 * خدمة التجويد — مكتبة الأحكام ومقاطعها.
 *
 * قاعدة واحدة تحكم القسم كلّه: **الإضافة من الإدارة العليا وحدها**،
 * وسائر الأدوار مشاهدون. سبب الحصر أن المحتوى هنا مرجعٌ يُقاس عليه
 * الأداء ويُبنى عليه الاختبار، فمصدره واحد لا يتعدّد.
 *
 * والحصر بمستوى الإداري لا بدوره: «إداري» صفةٌ تتّسع، فمنهم العليا
 * الذي يملك كل شيء، ومنهم المحدود الذي يُسنَد إليه بعضه. المستوى
 * بيانات على المستخدم لا صلاحية في المصفوفة، كسلطة النائب سواءً بسواء.
 *
 * تنبيه: نسخة تجريبية بلا خادم — هذه قواعد واجهة لا تفويض أمني.
 */

import { request, ApiError } from '../mock/api.js';
import { getDb, mutateDb } from '../mock/db.js';
import { can, ACTIONS } from '../config/permissions.js';
import { TAJWEED_CATEGORIES, TAJWEED_RULES, getRule, getCategory } from '../mock/tajweed.js';

export const ITEM_KINDS = ['clip', 'link'];

const MAX_TITLE = 90;
const MAX_DESCRIPTION = 240;

function items(db) {
  if (!Array.isArray(db.tajweedItems)) db.tajweedItems = [];
  return db.tajweedItems;
}

/** الإدارة العليا وحدها تُضيف وتحذف. */
export function maySeed(db, { role, userId }) {
  if (!can(role, ACTIONS.TAJWEED_MANAGE)) return false;
  const user = db.users.find((item) => item.id === userId);
  return user?.adminLevel === 'super';
}

function requireSeeder(db, actor) {
  if (!maySeed(db, actor)) throw new ApiError('forbidden', 'tajweed.errors.superOnly');
}

/**
 * رابط معقول لا أكثر: نسخة الواجهة لا تتحقق من وجود الملف، لكنها ترفض
 * ما ليس رابطًا أصلًا حتى لا تدخل المكتبة مدخلاتٌ لا تفتح.
 */
function normalizeUrl(value) {
  const url = String(value ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new ApiError('validation', 'tajweed.errors.invalidUrl');
  }
  return url;
}

function shape(item) {
  const rule = getRule(item.ruleId);
  return {
    ...item,
    ruleName: rule?.name ?? '',
    categoryId: rule?.categoryId ?? null,
    categoryName: rule ? (getCategory(rule.categoryId)?.name ?? '') : '',
  };
}

/* ---------------------------------------------------------------
   القراءة — لكل من يملك المشاهدة
   --------------------------------------------------------------- */

export async function getLibrary({ role, userId, categoryId = 'all', query = '' } = {}) {
  return request(() => {
    if (!can(role, ACTIONS.TAJWEED_VIEW)) {
      throw new ApiError('forbidden', 'state.forbiddenHint');
    }
    const db = getDb();
    const needle = String(query ?? '').trim();

    let rows = items(db).map(shape);
    if (categoryId !== 'all') rows = rows.filter((row) => row.categoryId === categoryId);
    if (needle) {
      rows = rows.filter(
        (row) => row.title.includes(needle) || row.ruleName.includes(needle),
      );
    }

    return {
      categories: TAJWEED_CATEGORIES,
      rules: TAJWEED_RULES.map((rule) => ({
        ...rule,
        categoryName: getCategory(rule.categoryId)?.name ?? '',
        itemCount: items(db).filter((item) => item.ruleId === rule.id).length,
      })),
      items: rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      mayManage: maySeed(db, { role, userId }),
    };
  });
}

/* ---------------------------------------------------------------
   الكتابة — للإدارة العليا وحدها
   --------------------------------------------------------------- */

export async function addItem({ role, userId, userName, ruleId, kind, title, url, description }) {
  return request(() =>
    mutateDb((db) => {
      requireSeeder(db, { role, userId });

      if (!getRule(ruleId)) throw new ApiError('validation', 'tajweed.errors.invalidRule');
      if (!ITEM_KINDS.includes(kind)) throw new ApiError('validation', 'tajweed.errors.invalidKind');

      const cleanTitle = String(title ?? '').trim();
      if (cleanTitle.length < 3) throw new ApiError('validation', 'tajweed.errors.shortTitle');

      const now = new Date().toISOString();
      const item = {
        id: `tajweed-${Date.now()}`,
        ruleId,
        kind,
        title: cleanTitle.slice(0, MAX_TITLE),
        url: normalizeUrl(url),
        description: String(description ?? '').trim().slice(0, MAX_DESCRIPTION),
        durationLabel: null,
        addedBy: userId,
        addedByName: userName ?? db.users.find((item2) => item2.id === userId)?.name ?? '',
        createdAt: now,
        updatedAt: now,
      };

      items(db).unshift(item);
      db.notifications.unshift({
        id: `notif-tajweed-${Date.now()}`,
        typeKey: 'tajweed',
        createdAt: now,
        read: false,
        link: '/app/tajweed',
        roles: ['student', 'teacher'],
      });

      return shape(item);
    }),
  );
}

export async function updateItem({ role, userId, itemId, title, url, description, ruleId }) {
  return request(() =>
    mutateDb((db) => {
      requireSeeder(db, { role, userId });

      const item = items(db).find((row) => row.id === itemId);
      if (!item) throw new ApiError('notFound', 'state.notFoundHint');

      if (ruleId !== undefined) {
        if (!getRule(ruleId)) throw new ApiError('validation', 'tajweed.errors.invalidRule');
        item.ruleId = ruleId;
      }
      if (title !== undefined) {
        const cleanTitle = String(title).trim();
        if (cleanTitle.length < 3) throw new ApiError('validation', 'tajweed.errors.shortTitle');
        item.title = cleanTitle.slice(0, MAX_TITLE);
      }
      if (url !== undefined) item.url = normalizeUrl(url);
      if (description !== undefined) {
        item.description = String(description).trim().slice(0, MAX_DESCRIPTION);
      }
      item.updatedAt = new Date().toISOString();

      return shape(item);
    }),
  );
}

export async function removeItem({ role, userId, itemId }) {
  return request(() =>
    mutateDb((db) => {
      requireSeeder(db, { role, userId });

      const index = items(db).findIndex((row) => row.id === itemId);
      if (index < 0) throw new ApiError('notFound', 'state.notFoundHint');
      const [removed] = items(db).splice(index, 1);
      return { id: removed.id };
    }),
  );
}
