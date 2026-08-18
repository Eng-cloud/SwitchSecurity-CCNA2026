import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useOnClickOutside from '../../hooks/useOnClickOutside.js';
import Avatar from '../ui/Avatar.jsx';
import Badge from '../ui/Badge.jsx';
import { ConfirmDialog } from '../ui/Modal.jsx';
import RoleSwitcher from './RoleSwitcher.jsx';

export default function UserMenu() {
  const t = useT();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const wrapRef = useRef(null);

  useOnClickOutside(wrapRef, () => setOpen(false), open);

  if (!user) return null;

  const handleLogout = async () => {
    setStatus('loading');
    await signOut();
    setStatus('idle');
    setConfirmOpen(false);
    toast.success(t('auth.logout.done'));
    navigate('/login', { replace: true });
  };

  return (
    <>
      <div className="menu__wrap" ref={wrapRef}>
        <button
          type="button"
          className="icon-btn"
          style={{ width: 'auto', padding: '0 var(--space-2)', gap: 'var(--space-2)' }}
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={`${t('nav.account')} — ${user.name}`}
        >
          <Avatar name={user.name} size="sm" />
          <span className="hide-mobile t-sm t-medium">{user.name}</span>
        </button>

        {open ? (
          <div className="menu" role="menu" aria-label={t('nav.account')}>
            <div className="menu__header stack-2">
              <div className="row row-2">
                <Avatar name={user.name} />
                <div className="grow">
                  <p className="t-sm t-semibold">{user.name}</p>
                  <p className="t-xs t-muted">{user.email}</p>
                </div>
              </div>
              <div className="row row-2 row-wrap">
                <Badge variant="brand">{t(`roles.${user.role}`)}</Badge>
                <Badge variant="warning" icon="◇">
                </Badge>
              </div>
            </div>

            <Link to="/app/profile" role="menuitem" className="menu__item" onClick={() => setOpen(false)}>
              <span aria-hidden="true">👤</span>
              {t('nav.profile')}
            </Link>
            <Link
              to="/app/settings"
              role="menuitem"
              className="menu__item"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">⚙️</span>
              {t('nav.settings')}
            </Link>
            <Link
              to="/app/settings/accessibility"
              role="menuitem"
              className="menu__item"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden="true">♿</span>
              {t('settings.accessibility')}
            </Link>

            <div className="menu__divider" />
            <div style={{ padding: 'var(--space-2)' }}>
              <RoleSwitcher onDone={() => setOpen(false)} />
            </div>
            <div className="menu__divider" />

            <button
              type="button"
              role="menuitem"
              className="menu__item t-danger"
              onClick={() => {
                setOpen(false);
                setConfirmOpen(true);
              }}
            >
              <span aria-hidden="true">↩</span>
              {t('nav.logout')}
            </button>
          </div>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={handleLogout}
        title={t('auth.logout.title')}
        message={`${t('auth.logout.question')} ${t('auth.logout.hint')}`}
        confirmLabel={t('auth.logout.confirm')}
        variant="danger"
        status={status}
      />
    </>
  );
}
