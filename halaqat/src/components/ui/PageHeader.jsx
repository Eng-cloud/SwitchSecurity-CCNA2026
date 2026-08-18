import cn from '../../lib/cn.js';
import Breadcrumb from './Breadcrumb.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';

/**
 * ترويسة الصفحة: مسار + عنوان + سطر واحد يوضح "أين أنا" + الإجراء الأساسي.
 * تضبط عنوان المستند تلقائيًا.
 */
export default function PageHeader({
  title,
  subtitle,
  breadcrumb,
  actions,
  documentTitle,
  className,
  children,
}) {
  useDocumentTitle(documentTitle ?? title);

  return (
    <header className={cn('stack-3', className)}>
      {breadcrumb?.length ? <Breadcrumb items={breadcrumb} /> : null}
      <div className="page-header">
        <div className="page-header__titles">
          <h1 className="page-header__title">{title}</h1>
          {subtitle ? <p className="page-header__subtitle">{subtitle}</p> : null}
        </div>
        {actions ? <div className="page-header__actions">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

/** قسم داخل الصفحة بعنوان ثانوي ورابط "عرض الكل". */
export function Section({ title, hint, actions, children, className, titleAs: Tag = 'h2', id }) {
  return (
    <section className={cn('section', className)} aria-labelledby={id}>
      {title ? (
        <div className="section__head">
          <div>
            <Tag className="section__title" id={id}>
              {title}
            </Tag>
            {hint ? <p className="section__hint">{hint}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}
