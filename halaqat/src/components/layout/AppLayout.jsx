import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { getNavigation, getBottomNavigation, getCommonNavigation } from '../../config/navigation.js';
import { subscribeOffline, isOffline } from '../../mock/api.js';
import useMediaQuery, { BREAKPOINTS } from '../../hooks/useMediaQuery.js';
import { IconButton } from '../ui/Button.jsx';
import Badge from '../ui/Badge.jsx';
import Drawer from '../ui/Drawer.jsx';
import { LoadingState } from '../ui/States.jsx';
import { BrandMark } from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import NotificationsMenu from './NotificationsMenu.jsx';
import UserMenu from './UserMenu.jsx';
import CommandPalette from './CommandPalette.jsx';
import GlobalSearch from './GlobalSearch.jsx';
import { useNotifications } from '../../context/NotificationsContext.jsx';

function NavList({ items, onNavigate, unreadCount }) {
  const t = useT();
  return (
    <ul className="sidebar__nav">
      {items.map((item) => (
        <li key={item.to}>
          <NavLink
            to={item.to}
            end={item.end}
            className={({ isActive }) => `nav-item${isActive ? ' is-active' : ''}`}
            onClick={onNavigate}
          >
            <span className="nav-item__icon" aria-hidden="true">
              {item.icon}
            </span>
            <span className="grow">{t(item.labelKey)}</span>
            {item.labelKey === 'nav.notifications' && unreadCount > 0 ? (
              <Badge variant="danger" icon={null} className="nav-item__badge">
                {unreadCount}
              </Badge>
            ) : null}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** الهيكل العام بعد تسجيل الدخول. */
export default function AppLayout() {
  const t = useT();
  const location = useLocation();
  const { role, user } = useAuth();
  const { unreadCount } = useNotifications();
  const [menuOpen, setMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [offline, setOfflineState] = useState(isOffline());
  const isDesktop = useMediaQuery(BREAKPOINTS.desktopUp);
  const mainRef = useRef(null);

  const navItems = getNavigation(role);
  const bottomItems = getBottomNavigation(role);
  const commonItems = getCommonNavigation(role);

  useEffect(() => subscribeOffline(setOfflineState), []);

  // اختصار لوحة الأوامر (Ctrl/Cmd + K).
  useEffect(() => {
    const handler = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // إغلاق قائمة الجوال عند تغير الصفحة.
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>

      <nav className="sidebar" data-app-sidebar="" aria-label={t('nav.main')}>
        <NavLink to="/" className="sidebar__brand">
          <BrandMark subtitle={t(`roles.${role}`)} />
        </NavLink>

        <NavList items={navItems} unreadCount={unreadCount} />

        <div className="sidebar__footer">
          <NavList items={commonItems} unreadCount={unreadCount} />
        </div>

        <p className="sidebar__note">{t('app.mockNotice')}</p>
      </nav>

      <header className="topbar" data-app-topbar="">
        {!isDesktop ? (
          <IconButton label={t('nav.openMenu')} onClick={() => setMenuOpen(true)}>
            ☰
          </IconButton>
        ) : null}

        <span className="topbar__title">{user?.name}</span>

        <div className="topbar__actions">
          <div className="topbar__search">
            <GlobalSearch />
          </div>
          <IconButton
            label={t('palette.open')}
            onClick={() => setPaletteOpen(true)}
            className="hide-mobile"
          >
            ⌘
          </IconButton>
          <ThemeToggle />
          <NotificationsMenu />
          <UserMenu />
        </div>
      </header>

      <main
        className="app-main"
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
      >
        {offline ? (
          <p className="offline-banner" role="status">
            <span aria-hidden="true">⚠</span>
            {t('state.offlineBanner')}
          </p>
        ) : null}
        <div className="app-main__inner route-fade" key={location.pathname}>
          {/* حالة تحميل الصفحة أثناء جلب حزمتها (Code Splitting) */}
          <Suspense fallback={<LoadingState />}>
            <Outlet />
          </Suspense>
        </div>
      </main>

      <nav className="bottom-nav" data-app-bottomnav="" aria-label={t('nav.bottom')}>
        <ul className="bottom-nav__list">
          {bottomItems.map((item) => (
            <li key={item.to} style={{ flex: 1 }}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) => `bottom-nav__item${isActive ? ' is-active' : ''}`}
              >
                <span className="bottom-nav__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span>{t(item.labelKey)}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      <Drawer open={menuOpen} onClose={closeMenu} title={t('nav.menu')}>
        <NavList items={navItems} onNavigate={closeMenu} unreadCount={unreadCount} />
        <div className="menu__divider" />
        <NavList items={commonItems} onNavigate={closeMenu} unreadCount={unreadCount} />
      </Drawer>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
