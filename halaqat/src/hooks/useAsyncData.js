import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Hook موحّد لجلب البيانات من طبقة الخدمات.
 * يمنح كل صفحة حالات: loading / error / data / refetch
 * ويتجاهل النتائج القديمة عند تغير الطلب (race conditions).
 */
export default function useAsyncData(fetcher, deps = [], { enabled = true } = {}) {
  const [state, setState] = useState({ data: null, loading: enabled, error: null });
  const requestId = useRef(0);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(() => {
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      return undefined;
    }
    const id = ++requestId.current;
    setState((prev) => ({ data: prev.data, loading: true, error: null }));

    Promise.resolve()
      .then(() => fetcherRef.current())
      .then((data) => {
        if (!mounted.current || id !== requestId.current) return;
        setState({ data, loading: false, error: null });
      })
      .catch((error) => {
        if (!mounted.current || id !== requestId.current) return;
        setState({ data: null, loading: false, error: error ?? new Error('unknown') });
      });
    return undefined;
  }, [enabled]);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run, ...deps]);

  return { ...state, refetch: run };
}

/**
 * تنفيذ إجراء (mutation) مع حالات الزر: idle / loading / success / error
 */
export function useAction(action, { onSuccess, onError, resetAfter = 2000 } = {}) {
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const mounted = useRef(true);
  const timer = useRef(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const execute = useCallback(
    async (...args) => {
      setStatus('loading');
      setError(null);
      try {
        const result = await action(...args);
        if (!mounted.current) return result;
        setStatus('success');
        onSuccess?.(result);
        if (resetAfter) {
          timer.current = setTimeout(() => {
            if (mounted.current) setStatus('idle');
          }, resetAfter);
        }
        return result;
      } catch (err) {
        if (!mounted.current) throw err;
        setStatus('error');
        setError(err);
        onError?.(err);
        return null;
      }
    },
    [action, onSuccess, onError, resetAfter],
  );

  return { execute, status, error, isLoading: status === 'loading' };
}
