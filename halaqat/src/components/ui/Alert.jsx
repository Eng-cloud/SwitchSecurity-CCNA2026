import cn from '../../lib/cn.js';

const ICONS = {
  info: 'i',
  success: '✓',
  warning: '!',
  danger: '✕',
  mock: '◇',
};

/** تنبيه ثابت داخل الصفحة (ليس Toast) للمعلومات التي يجب أن تبقى مرئية. */
export default function Alert({ children, title, variant = 'info', className, role, ...rest }) {
  return (
    <div
      className={cn('alert', `alert--${variant}`, className)}
      role={role ?? (variant === 'danger' ? 'alert' : 'note')}
      {...rest}
    >
      <span className="alert__icon" aria-hidden="true">
        {ICONS[variant]}
      </span>
      <div>
        {title ? <p className="alert__title">{title}</p> : null}
        <div>{children}</div>
      </div>
    </div>
  );
}
