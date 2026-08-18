import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import cn from '../../lib/cn.js';

/**
 * زر بكل الحالات المطلوبة:
 * Default / Hover / Focus / Pressed / Loading / Success / Error / Disabled
 * - أثناء التحميل يبقى الزر مرئيًا مع نص بديل و aria-busy.
 * - يمكن استخدامه كرابط داخلي (to) أو خارجي (href).
 */
const Button = forwardRef(function Button(
  {
    children,
    variant = 'primary',
    size = 'md',
    type = 'button',
    status = 'idle', // idle | loading | success | error
    loadingText,
    successText,
    icon = null,
    iconEnd = null,
    block = false,
    disabled = false,
    className,
    to,
    href,
    ...rest
  },
  ref,
) {
  const isLoading = status === 'loading';
  const isSuccess = status === 'success';
  const isDisabled = disabled || isLoading;

  const classes = cn(
    'btn',
    `btn--${variant}`,
    size !== 'md' && `btn--${size}`,
    block && 'btn--block',
    isSuccess && 'btn--success-state',
    className,
  );

  const content = (
    <>
      {isLoading ? <span className="btn__spinner" aria-hidden="true" /> : null}
      {!isLoading && icon ? (
        <span className="btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span>
        {isLoading && loadingText ? loadingText : isSuccess && successText ? successText : children}
      </span>
      {!isLoading && iconEnd ? (
        <span className="btn__icon" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
    </>
  );

  if (to && !isDisabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }

  if (href && !isDisabled) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-busy={isLoading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;

/** زر أيقونة — يشترط aria-label دائمًا. */
export const IconButton = forwardRef(function IconButton(
  { children, label, active = false, bordered = false, className, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(
        'icon-btn',
        bordered && 'icon-btn--bordered',
        active && 'icon-btn--active',
        className,
      )}
      aria-label={label}
      title={label}
      {...rest}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  );
});
