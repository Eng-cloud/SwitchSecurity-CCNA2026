import { Link } from 'react-router-dom';
import cn from '../../lib/cn.js';

/**
 * بطاقة مؤشر: الرقم أولًا، ثم تفصيل صغير، ثم رابط "عرض التفاصيل" عند الحاجة.
 * الاتجاه (trend) لا يُفهم من اللون وحده: هناك رمز ونص أيضًا.
 */
export default function Stat({
  label,
  value,
  meta,
  icon,
  trend, // { direction: 'up'|'down'|'flat', label: string }
  accent = false,
  href,
  linkLabel,
  className,
  children,
}) {
  const trendIcon = trend?.direction === 'up' ? '▲' : trend?.direction === 'down' ? '▼' : '■';

  return (
    <div className={cn('stat', accent && 'stat--accent', className)}>
      <p className="stat__label">
        {icon ? <span aria-hidden="true">{icon}</span> : null}
        {label}
      </p>
      <p className="stat__value">{value}</p>
      {trend ? (
        <p className={cn('stat__trend', `stat__trend--${trend.direction}`)}>
          <span aria-hidden="true">{trendIcon}</span>
          <span>{trend.label}</span>
        </p>
      ) : null}
      {meta ? <p className="stat__meta">{meta}</p> : null}
      {children}
      {href ? (
        <Link to={href} className="stat__meta t-brand t-medium">
          {linkLabel} ←
        </Link>
      ) : null}
    </div>
  );
}
