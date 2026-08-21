import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import ar from './ar.js';

/**
 * طبقة i18n بسيطة ومستقلة عن المكونات.
 * الإصدار الحالي عربي فقط (Arabic First) لكن البنية تسمح بإضافة لغات لاحقًا
 * عبر إضافة قاموس جديد إلى `dictionaries` دون تعديل أي Component.
 */

export const dictionaries = { ar };

export const localeConfig = {
  ar: { dir: 'rtl', name: 'العربية', numbering: 'arab' },
};

const I18nContext = createContext(null);

/** يقرأ مفتاحًا منقّطًا من كائن متداخل. */
function lookup(dict, key) {
  return key.split('.').reduce((acc, part) => (acc == null ? undefined : acc[part]), dict);
}

/** يستبدل {name} بالقيم الممرّرة. */
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

export function I18nProvider({ children, locale: initialLocale = 'ar' }) {
  const [locale, setLocale] = useState(initialLocale);

  const t = useCallback(
    (key, params) => {
      const dict = dictionaries[locale] ?? dictionaries.ar;
      const value = lookup(dict, key);
      if (typeof value === 'string') return interpolate(value, params);
      if (import.meta.env?.DEV && value === undefined) {
        // مفتاح ناقص: نعيد المفتاح نفسه بدل الانهيار.
        console.warn(`[i18n] مفتاح غير معرّف: ${key}`);
      }
      return typeof value === 'string' ? value : key;
    },
    [locale],
  );

  const value = useMemo(
    () => ({
      locale,
      dir: localeConfig[locale]?.dir ?? 'rtl',
      setLocale,
      t,
    }),
    [locale, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n يجب استخدامه داخل I18nProvider');
  return ctx;
}

/** اختصار شائع الاستخدام داخل المكونات. */
export function useT() {
  return useI18n().t;
}

/** ترجمة خارج React (للخدمات وبيانات Mock). */
export function translate(key, params, locale = 'ar') {
  const value = lookup(dictionaries[locale] ?? dictionaries.ar, key);
  return typeof value === 'string' ? interpolate(value, params) : key;
}
