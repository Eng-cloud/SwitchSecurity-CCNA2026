import { useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../i18n/index.jsx';
import useFocusTrap, { useScrollLock } from '../../hooks/useFocusTrap.js';
import { IconButton } from './Button.jsx';

/** لوح جانبي (قائمة الجوال، التفاصيل السريعة). */
export default function Drawer({ open, onClose, title, children, footer }) {
  const t = useT();
  const panelRef = useRef(null);
  const titleId = useId();

  const handleEscape = useCallback(() => onClose?.(), [onClose]);
  useFocusTrap(panelRef, { active: open, onEscape: handleEscape });
  useScrollLock(open);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="overlay"
      style={{ padding: 0, alignItems: 'stretch', justifyContent: 'flex-start' }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={panelRef}
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="drawer__header">
          <h2 className="modal__title" id={titleId}>
            {title}
          </h2>
          <IconButton label={t('nav.closeMenu')} onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="drawer__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}
