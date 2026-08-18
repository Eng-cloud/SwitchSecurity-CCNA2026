import { useEffect } from 'react';

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * هل العنصر ظاهر فعلًا؟
 * لا نعتمد على offsetParent لأنه يتطلب تخطيطًا حقيقيًا (غير متوفر في بيئة الاختبار)،
 * بل نستبعد ما أُخفي صراحةً — وهذا يغطي لوحات الـAccordion المخفية بـhidden.
 */
function isVisible(el) {
  if (el.hasAttribute('hidden') || el.closest('[hidden]')) return false;
  if (el.getAttribute('aria-hidden') === 'true') return false;
  if (el.style?.display === 'none' || el.style?.visibility === 'hidden') return false;
  return true;
}

export function getFocusable(container) {
  if (!container) return [];
  return Array.from(container.querySelectorAll(FOCUSABLE)).filter(isVisible);
}

/**
 * يحصر التركيز داخل عنصر (Modal / Drawer / Command Palette)
 * ويعيد التركيز إلى العنصر السابق عند الإغلاق.
 */
export default function useFocusTrap(containerRef, { active = true, onEscape, initialFocusRef } = {}) {
  useEffect(() => {
    if (!active) return undefined;
    const container = containerRef.current;
    if (!container) return undefined;

    const previouslyFocused = document.activeElement;

    const focusFirst = () => {
      const target =
        initialFocusRef?.current ??
        getFocusable(container)[0] ??
        container;
      if (target && typeof target.focus === 'function') {
        target.focus({ preventScroll: true });
      }
    };

    // ننتظر إطارًا حتى يكتمل الرسم قبل نقل التركيز.
    const raf = requestAnimationFrame(focusFirst);

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== 'Tab') return;

      const focusables = getFocusable(container);
      if (focusables.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement;

      if (event.shiftKey && (activeEl === first || !container.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener('keydown', handleKeyDown, true);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus({ preventScroll: true });
      }
    };
  }, [active, containerRef, onEscape, initialFocusRef]);
}

/** يمنع تمرير الخلفية أثناء فتح طبقة علوية. */
export function useScrollLock(active) {
  useEffect(() => {
    if (!active || typeof document === 'undefined') return undefined;
    const { body } = document;
    const previousOverflow = body.style.overflow;
    const previousPadding = body.style.paddingInlineEnd;
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    body.style.overflow = 'hidden';
    if (scrollbar > 0) body.style.paddingInlineEnd = `${scrollbar}px`;
    return () => {
      body.style.overflow = previousOverflow;
      body.style.paddingInlineEnd = previousPadding;
    };
  }, [active]);
}
