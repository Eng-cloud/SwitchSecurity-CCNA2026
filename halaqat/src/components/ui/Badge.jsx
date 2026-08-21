import cn from '../../lib/cn.js';

const ICONS = {
  success: '✓',
  warning: '!',
  danger: '✕',
  info: 'i',
  brand: '●',
  neutral: '·',
};

/**
 * شارة حالة: أيقونة + نص + لون معًا،
 * فلا تعتمد المعلومة على اللون وحده.
 */
export default function Badge({ children, variant = 'neutral', icon, className, ...rest }) {
  const symbol = icon === null ? null : (icon ?? ICONS[variant]);
  return (
    <span className={cn('badge', `badge--${variant}`, className)} {...rest}>
      {symbol ? (
        <span className="badge__icon" aria-hidden="true">
          {symbol}
        </span>
      ) : null}
      {children}
    </span>
  );
}
