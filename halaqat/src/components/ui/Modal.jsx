import { useCallback, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';
import useFocusTrap, { useScrollLock } from '../../hooks/useFocusTrap.js';
import Button, { IconButton } from './Button.jsx';

/**
 * نافذة حوارية: Escape، إغلاق بالنقر خارجها، حصر التركيز،
 * إعادة التركيز للعنصر السابق، وتكيّف إلى Sheet على الجوال.
 */
export default function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  initialFocusRef,
  closeOnOverlay = true,
}) {
  const t = useT();
  const dialogRef = useRef(null);
  const titleId = useId();
  const descId = useId();

  const handleEscape = useCallback(() => onClose?.(), [onClose]);

  useFocusTrap(dialogRef, { active: open, onEscape: handleEscape, initialFocusRef });
  useScrollLock(open);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="overlay"
      onMouseDown={(event) => {
        if (closeOnOverlay && event.target === event.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        className={cn('modal', size !== 'md' && `modal--${size}`)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
      >
        <div className="modal__header">
          <div>
            <h2 className="modal__title" id={titleId}>
              {title}
            </h2>
            {description ? (
              <p className="modal__description" id={descId}>
                {description}
              </p>
            ) : null}
          </div>
          <IconButton label={t('common.close')} onClick={onClose}>
            ✕
          </IconButton>
        </div>
        <div className="modal__body">{children}</div>
        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  );
}

/** حوار تأكيد جاهز (تسجيل خروج، حذف، إنهاء اختبار...). */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'primary',
  status = 'idle',
}) {
  const t = useT();
  const confirmRef = useRef(null);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      initialFocusRef={confirmRef}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelLabel ?? t('common.cancel')}
          </Button>
          <Button ref={confirmRef} variant={variant} onClick={onConfirm} status={status}>
            {confirmLabel ?? t('common.confirm')}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
