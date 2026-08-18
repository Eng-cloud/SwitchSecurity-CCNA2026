import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useNotifications } from '../../context/NotificationsContext.jsx';
import useOnClickOutside from '../../hooks/useOnClickOutside.js';
import { formatRelative, formatNumber } from '../../lib/format.js';
import { IconButton } from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';

export default function NotificationsMenu() {
  const t = useT();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useOnClickOutside(wrapRef, () => setOpen(false), open);

  const preview = items.slice(0, 6);

  return (
    <div className="menu__wrap" ref={wrapRef}>
      <IconButton
        label={
          unreadCount > 0
            ? `${t('notifications.open')} — ${t('notifications.unreadCount', {
                count: formatNumber(unreadCount),
              })}`
            : `${t('notifications.open')} — ${t('notifications.noUnread')}`
        }
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <span style={{ position: 'relative' }}>
          🔔
          {unreadCount > 0 ? (
            <span
              style={{
                position: 'absolute',
                top: -4,
                insetInlineEnd: -6,
                background: 'var(--danger)',
                color: '#fff',
                borderRadius: '999px',
                fontSize: '10px',
                minWidth: '16px',
                height: '16px',
                display: 'grid',
                placeItems: 'center',
                fontWeight: 700,
              }}
            >
              {formatNumber(unreadCount)}
            </span>
          ) : null}
        </span>
      </IconButton>

      {open ? (
        <div className="menu" role="menu" aria-label={t('notifications.title')}>
          <div className="menu__header row row-between">
            <strong>{t('notifications.title')}</strong>
            {unreadCount > 0 ? (
              <button type="button" className="t-sm t-brand" onClick={markAllRead}>
                {t('notifications.markAllRead')}
              </button>
            ) : null}
          </div>

          <div className="menu__scroll">
            {preview.length === 0 ? (
              <p className="t-sm t-muted" style={{ padding: 'var(--space-4)' }}>
                {t('notifications.empty')}
              </p>
            ) : (
              preview.map((item) => (
                <Link
                  key={item.id}
                  to={item.link ?? '/app/notifications'}
                  role="menuitem"
                  className={`notification-item ${item.read ? '' : 'notification-item--unread'}`}
                  onClick={() => {
                    markRead(item.id);
                    setOpen(false);
                  }}
                >
                  {!item.read ? <span className="notification-item__dot" aria-hidden="true" /> : null}
                  <span className="grow">
                    <span className="t-sm t-medium">{t(`notifications.types.${item.typeKey}`)}</span>
                    <span className="t-xs t-muted" style={{ display: 'block' }}>
                      {formatRelative(item.createdAt, t)}
                    </span>
                  </span>
                  {!item.read ? (
                    <Badge variant="brand" icon={null}>
                      {t('notifications.unread')}
                    </Badge>
                  ) : null}
                </Link>
              ))
            )}
          </div>

          <div className="menu__divider" />
          <Link to="/app/notifications" className="menu__item" onClick={() => setOpen(false)}>
            {t('notifications.viewAll')}
          </Link>
        </div>
      ) : null}
    </div>
  );
}
