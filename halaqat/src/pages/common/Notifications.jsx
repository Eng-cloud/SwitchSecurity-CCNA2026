import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import { formatRelative, formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

const ICONS = {
  session: '🎙',
  test: '📝',
  report: '📊',
  goal: '🎯',
  note: '🗒',
  attendance: '✓',
};

/** مركز الإشعارات. */
export default function NotificationsPage() {
  const t = useT();
  const { items, unreadCount, loading, error, reload, markRead, markAllRead } = useNotifications();

  return (
    <>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app' }, { label: t('notifications.title') }]}
        actions={
          unreadCount > 0 ? (
            <Button variant="secondary" onClick={markAllRead}>
              {t('notifications.markAllRead')}
            </Button>
          ) : null
        }
      />

      <p className="t-sm t-muted" aria-live="polite">
        {unreadCount > 0
          ? t('notifications.unreadCount', { count: formatNumber(unreadCount) })
          : t('notifications.noUnread')}
      </p>

      <DataState
        loading={loading}
        error={error}
        onRetry={reload}
        isEmpty={items.length === 0}
        emptyTitle={t('notifications.title')}
        emptyText={t('notifications.empty')}
        loadingFallback={<Skeleton variant="card" count={4} height={72} />}
      >
        <ul className="stack-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card variant={item.read ? 'flat' : 'default'} className="row row-3 row-wrap">
                <span aria-hidden="true" style={{ fontSize: '1.3rem' }}>
                  {ICONS[item.typeKey] ?? '🔔'}
                </span>
                <div className="grow">
                  <p className="t-medium">{t(`notifications.types.${item.typeKey}`)}</p>
                  <p className="t-xs t-muted">{formatRelative(item.createdAt, t)}</p>
                </div>

                {!item.read ? <Badge variant="brand">{t('notifications.unread')}</Badge> : null}

                <div className="row row-2">
                  {item.link ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      to={item.link}
                      onClick={() => markRead(item.id)}
                    >
                      {t('common.open')}
                    </Button>
                  ) : null}
                  {!item.read ? (
                    <Button size="sm" variant="ghost" onClick={() => markRead(item.id)}>
                      {t('notifications.markRead')}
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </DataState>

      <p className="t-sm t-muted">
        <Link to="/app/settings/notifications">{t('settings.notifications')} ←</Link>
      </p>
    </>
  );
}
