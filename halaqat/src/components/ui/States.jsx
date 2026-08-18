import cn from '../../lib/cn.js';
import { useT } from '../../i18n/index.jsx';
import Button from './Button.jsx';

/** حالة فارغة — لكل قائمة في المنصة. */
export function EmptyState({ title, text, icon = '◇', action, className }) {
  const t = useT();
  return (
    <div className={cn('state-block', className)}>
      <span className="state-block__icon" aria-hidden="true">
        {icon}
      </span>
      <p className="state-block__title">{title ?? t('state.emptyTitle')}</p>
      <p className="state-block__text">{text ?? t('state.emptyHint')}</p>
      {action}
    </div>
  );
}

/** حالة خطأ مع إعادة المحاولة. */
export function ErrorState({ title, text, onRetry, className, error }) {
  const t = useT();
  const message = error?.messageKey ? t(error.messageKey) : (text ?? t('state.errorHint'));

  return (
    <div className={cn('state-block', 'state-block--error', className)} role="alert">
      <span className="state-block__icon" aria-hidden="true">
        ✕
      </span>
      <p className="state-block__title">{title ?? t('state.errorTitle')}</p>
      <p className="state-block__text">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {t('common.retry')}
        </Button>
      ) : null}
    </div>
  );
}

/** حالة تحميل مرئية + معلنة لقارئ الشاشة. */
export function LoadingState({ text, className }) {
  const t = useT();
  return (
    <div className={cn('state-block', className)} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <p className="state-block__title">{t('state.loadingTitle')}</p>
      <p className="state-block__text">{text ?? t('state.loadingHint')}</p>
    </div>
  );
}

export function Spinner({ size = 'md', label }) {
  const t = useT();
  return (
    <span
      className={cn('spinner', size === 'sm' && 'spinner--sm')}
      role="status"
      aria-label={label ?? t('common.loading')}
    />
  );
}

export function Skeleton({ variant = 'text', width, height, count = 1, className }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className={cn('skeleton', `skeleton--${variant}`, className)}
          style={{ width, height }}
        />
      ))}
    </div>
  );
}

/** هيكل تحميل لصفحة كاملة (بطاقات + جدول). */
export function PageSkeleton({ cards = 4 }) {
  const t = useT();
  return (
    <div className="stack-6" role="status" aria-live="polite" aria-label={t('common.loading')}>
      <Skeleton variant="title" />
      <div className="grid grid-4">
        {Array.from({ length: cards }, (_, index) => (
          <Skeleton key={index} variant="card" />
        ))}
      </div>
      <Skeleton variant="card" height={260} />
    </div>
  );
}

/**
 * مبدّل حالات موحّد لكل صفحة:
 * Loading → Error → Empty → Content
 */
export function DataState({
  loading,
  error,
  isEmpty,
  onRetry,
  loadingFallback,
  emptyTitle,
  emptyText,
  emptyAction,
  children,
}) {
  if (loading) return loadingFallback ?? <LoadingState />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (isEmpty) return <EmptyState title={emptyTitle} text={emptyText} action={emptyAction} />;
  return children;
}
