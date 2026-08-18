import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * يحفظ حالة القائمة (بحث/صفحة/تصفية/ترتيب) داخل عنوان الصفحة نفسه،
 * فيعمل Deep Link ويعود المستخدم لنفس الحالة عند الرجوع بالمتصفح.
 */
export default function useListState({ defaults = {}, replaceKeys = ['q'] } = {}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const values = useMemo(() => {
    const result = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = searchParams.get(key);
      if (raw == null) continue;
      result[key] = typeof defaults[key] === 'number' ? Number(raw) || defaults[key] : raw;
    }
    return result;
  }, [searchParams, defaults]);

  const setValue = useCallback(
    (key, value, { resetPage = true } = {}) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          const isDefault = value === defaults[key] || value === '' || value == null;
          if (isDefault) next.delete(key);
          else next.set(key, String(value));
          if (resetPage && key !== 'page' && next.has('page')) next.delete('page');
          return next;
        },
        { replace: replaceKeys.includes(key) },
      );
    },
    [setSearchParams, defaults, replaceKeys],
  );

  const resetAll = useCallback(() => {
    setSearchParams(new URLSearchParams(), { replace: false });
  }, [setSearchParams]);

  const isFiltered = useMemo(
    () => Object.keys(defaults).some((key) => values[key] !== defaults[key] && key !== 'page'),
    [values, defaults],
  );

  return { values, setValue, resetAll, isFiltered };
}
