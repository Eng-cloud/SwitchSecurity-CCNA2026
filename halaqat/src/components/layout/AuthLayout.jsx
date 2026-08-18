import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import Logo from './Logo.jsx';
import ThemeToggle from './ThemeToggle.jsx';
import useDocumentTitle from '../../hooks/useDocumentTitle.js';

/** هيكل صفحات الدخول والتسجيل والتحقق. */
export default function AuthLayout({ title, subtitle, children, documentTitle }) {
  const t = useT();
  useDocumentTitle(documentTitle ?? title);

  return (
    <div className="auth-page">
      <aside className="auth-page__aside">
        <div>
          <Logo size={48} />
          <h2 className="auth-page__aside-title" style={{ marginTop: 'var(--space-6)' }}>
            {t('landing.heroTitle')}
          </h2>
          <p className="auth-page__aside-text">{t('landing.heroSubtitle')}</p>
        </div>

        <ul className="auth-page__aside-points">
          <li className="auth-page__aside-point">
            <span aria-hidden="true">◆</span>
            {t('landing.feature1Title')} — {t('landing.feature1Text')}
          </li>
          <li className="auth-page__aside-point">
            <span aria-hidden="true">◆</span>
            {t('landing.feature2Title')} — {t('landing.feature2Text')}
          </li>
          <li className="auth-page__aside-point">
            <span aria-hidden="true">◆</span>
            {t('landing.feature4Title')} — {t('landing.feature4Text')}
          </li>
        </ul>

        <p className="t-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
          {t('landing.footerNote')}
        </p>
      </aside>

      <main className="auth-page__main" id="main-content">
        <div className="auth-card">
          <div className="row row-between">
            <Link to="/" className="auth-card__brand">
              <Logo size={34} />
              <span className="t-semibold">{t('app.name')}</span>
            </Link>
            <ThemeToggle />
          </div>

          <div>
            <h1 className="auth-card__title">{title}</h1>
            {subtitle ? <p className="auth-card__subtitle">{subtitle}</p> : null}
          </div>

          {children}
        </div>
      </main>
    </div>
  );
}
