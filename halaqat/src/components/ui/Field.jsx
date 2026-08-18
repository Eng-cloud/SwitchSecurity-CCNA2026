import { cloneElement, useId } from 'react';
import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';

/**
 * غلاف الحقل: Label دائم (لا نستخدم Placeholder بديلًا عن Label)،
 * تلميح، ورسالة خطأ مرتبطة بـ aria-describedby.
 */
export default function Field({
  label,
  hint,
  error,
  required = false,
  optional = false,
  children,
  className,
  htmlFor,
}) {
  const generatedId = useId();
  const id = htmlFor ?? `field-${generatedId}`;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const t = useT();

  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  const control =
    typeof children === 'function'
      ? children({ id, describedBy, invalid: Boolean(error) })
      : cloneElement(children, {
          id,
          'aria-describedby': describedBy,
          'aria-invalid': error ? 'true' : undefined,
          'aria-required': required || undefined,
        });

  return (
    <div className={cn('field', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
        {required ? (
          <span className="field__required" aria-hidden="true">
            *
          </span>
        ) : null}
        {optional ? <span className="field__optional">({t('common.optional')})</span> : null}
      </label>
      {control}
      {hint ? (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p className="field__error" id={errorId}>
          <span aria-hidden="true">✕</span>
          {error}
        </p>
      ) : null}
    </div>
  );
}
