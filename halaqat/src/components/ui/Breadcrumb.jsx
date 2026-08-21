import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';

/**
 * مسار التنقل — كل مستوى قابل للضغط عدا الحالي.
 * items: [{ label, to }]
 */
export default function Breadcrumb({ items = [], className }) {
  const t = useT();
  if (items.length === 0) return null;

  return (
    <nav className={className ? `breadcrumb ${className}` : 'breadcrumb'} aria-label={t('nav.breadcrumb')}>
      <ol className="breadcrumb__list">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li className="breadcrumb__item" key={`${item.label}-${index}`}>
              {isLast || !item.to ? (
                <span className="breadcrumb__current" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link className="breadcrumb__link" to={item.to}>
                  {item.label}
                </Link>
              )}
              {!isLast ? (
                <span className="breadcrumb__sep" aria-hidden="true">
                  /
                </span>
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
