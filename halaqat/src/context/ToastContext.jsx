import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../i18n/index.jsx';
import cn from '../lib/cn.js';

const ToastContext = createContext(null);

let counter = 0;

/**
 * Toasts + منطقة إعلان لقارئ الشاشة.
 * ملاحظة: الـToast ليس الوسيلة الوحيدة لإيصال المعلومة المهمة —
 * كل إجراء مهم يترك أثرًا مرئيًا في الصفحة نفسها أيضًا.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [announcement, setAnnouncement] = useState('');
  const timers = useRef(new Map());

  useEffect(() => {
    const map = timers.current;
    return () => {
      map.forEach((id) => clearTimeout(id));
      map.clear();
    };
  }, []);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const show = useCallback(
    (message, { variant = 'info', duration = 4500, description } = {}) => {
      if (!message) return null;
      const id = `toast-${++counter}`;
      setToasts((prev) => [...prev.slice(-3), { id, message, description, variant }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
        timers.current.delete(id);
      }, duration);
      timers.current.set(id, timer);
      return id;
    },
    [],
  );

  /** إعلان نصي لقارئ الشاشة دون إظهار Toast. */
  const announce = useCallback((message) => {
    setAnnouncement('');
    // إعادة الضبط ثم التعيين تضمن إعادة القراءة حتى لو تكرر النص.
    requestAnimationFrame(() => setAnnouncement(String(message ?? '')));
  }, []);

  const api = useMemo(
    () => ({
      show,
      success: (message, options) => show(message, { ...options, variant: 'success' }),
      error: (message, options) => show(message, { ...options, variant: 'error' }),
      info: (message, options) => show(message, { ...options, variant: 'info' }),
      warning: (message, options) => show(message, { ...options, variant: 'warning' }),
      dismiss,
      announce,
      toasts,
    }),
    [show, dismiss, announce, toasts],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
      <LiveAnnouncer message={announcement} />
    </ToastContext.Provider>
  );
}

const VARIANT_ICON = {
  success: '✓',
  error: '✕',
  warning: '!',
  info: 'i',
};

function ToastRegion({ toasts, onDismiss }) {
  const t = useT();
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="toast-region"
      data-toast-region=""
      role="region"
      aria-label={t('toast.region')}
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn('toast', `toast--${toast.variant}`)}
          role={toast.variant === 'error' ? 'alert' : 'status'}
        >
          <span className="toast__icon" aria-hidden="true">
            {VARIANT_ICON[toast.variant] ?? 'i'}
          </span>
          <div className="toast__body">
            <p className="toast__message">{toast.message}</p>
            {toast.description ? <p className="toast__description">{toast.description}</p> : null}
          </div>
          <button
            type="button"
            className="toast__close"
            onClick={() => onDismiss(toast.id)}
            aria-label={t('toast.dismiss')}
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ))}
    </div>,
    document.body,
  );
}

function LiveAnnouncer({ message }) {
  return (
    <div className="visually-hidden" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast يجب استخدامه داخل ToastProvider');
  return ctx;
}
