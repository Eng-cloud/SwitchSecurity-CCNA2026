import { Link } from 'react-router-dom';
import cn from '../../lib/cn.js';

export default function Card({
  children,
  variant = 'default',
  as: Component = 'div',
  className,
  ...rest
}) {
  return (
    <Component
      className={cn('card', variant !== 'default' && `card--${variant}`, className)}
      {...rest}
    >
      {children}
    </Component>
  );
}

export function CardHeader({ title, subtitle, actions, titleAs: TitleTag = 'h3', id }) {
  return (
    <div className="card__header">
      <div>
        <TitleTag className="card__title" id={id}>
          {title}
        </TitleTag>
        {subtitle ? <p className="card__subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="row row-2">{actions}</div> : null}
    </div>
  );
}

export function CardFooter({ children, className }) {
  return <div className={cn('card__footer', className)}>{children}</div>;
}

/** بطاقة قابلة للنقر تنقل إلى صفحة تفاصيل. */
export function LinkCard({ to, children, className, ...rest }) {
  return (
    <Link to={to} className={cn('card', 'card--interactive', className)} {...rest}>
      {children}
    </Link>
  );
}
