import { Link } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/navigation.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import Logo from '../components/layout/Logo.jsx';
import ThemeToggle from '../components/layout/ThemeToggle.jsx';
import { Button, Card, Badge } from '../components/ui/index.js';

const FEATURES = [
  { key: 1, icon: '🕌' },
  { key: 2, icon: '📖' },
  { key: 3, icon: '🎙' },
  { key: 4, icon: '📊' },
];

import { ROLE_ORDER } from '../config/permissions.js';

const ROLES = ROLE_ORDER;

/** الصفحة التعريفية — مدخل الرحلة. */
export default function Landing() {
  const t = useT();
  const { isAuthenticated, role } = useAuth();
  useDocumentTitle(t('app.name'));

  return (
    <>
      <a className="skip-link" href="#main-content">
        {t('app.skipToContent')}
      </a>

      <header className="landing__header">
        <Link to="/" className="row row-2" style={{ textDecoration: 'none', color: 'var(--text)' }}>
          <Logo size={36} />
          <strong>{t('app.name')}</strong>
        </Link>

        <div className="row row-2 mis-auto">
          <ThemeToggle />
          {isAuthenticated ? (
            <Button to={ROLE_HOME[role] ?? '/app'} size="sm">
              {t('nav.dashboard')}
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" to="/login" className="hide-mobile">
                {t('landing.loginCta')}
              </Button>
              <Button size="sm" to="/demo">
                {t('landing.secondaryCta')}
              </Button>
            </>
          )}
        </div>
      </header>

      <main id="main-content">
        {/* Hero */}
        <section className="landing__section landing__hero">
          <div>
            <Badge variant="brand" icon="◇">
            </Badge>
            <h1 className="landing__hero-title mt-4">{t('landing.heroTitle')}</h1>
            <p className="landing__hero-text">{t('landing.heroSubtitle')}</p>
            <div className="landing__hero-actions">
              <Button size="lg" to="/register">
                {t('landing.primaryCta')}
              </Button>
              <Button size="lg" variant="secondary" to="/demo">
                {t('landing.secondaryCta')}
              </Button>
            </div>
            <p className="t-sm t-muted mt-4">{t('landing.footerNote')}</p>
          </div>

          <div className="landing__hero-art" aria-hidden="true">
            <svg viewBox="0 0 320 320" width="100%" height="100%">
              <defs>
                <linearGradient id="heroGrad" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="var(--brand-600)" />
                  <stop offset="100%" stopColor="var(--brand-800)" />
                </linearGradient>
              </defs>
              <circle cx="160" cy="160" r="150" fill="url(#heroGrad)" />
              <circle cx="160" cy="160" r="118" fill="none" stroke="var(--gold-500)" strokeWidth="1.5" opacity="0.85" />
              <circle cx="160" cy="160" r="86" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1" />
              <circle cx="160" cy="160" r="54" fill="none" stroke="var(--gold-400)" strokeWidth="1" opacity="0.7" />
              {Array.from({ length: 8 }, (_, index) => {
                const angle = (index / 8) * Math.PI * 2;
                return (
                  <circle
                    key={index}
                    cx={160 + Math.cos(angle) * 118}
                    cy={160 + Math.sin(angle) * 118}
                    r="5"
                    fill="var(--gold-500)"
                  />
                );
              })}
              <text
                x="160"
                y="172"
                textAnchor="middle"
                fill="#fff"
                fontSize="26"
                fontFamily="var(--font-serif)"
              >
                الحلقات
              </text>
            </svg>
          </div>
        </section>

        {/* Features */}
        <section className="landing__section" aria-labelledby="features-title">
          <h2 id="features-title" className="t-2xl t-semibold t-center">
            {t('landing.featuresTitle')}
          </h2>
          <div className="grid grid-4 mt-6">
            {FEATURES.map((feature) => (
              <Card key={feature.key} className="stack-2">
                <span aria-hidden="true" style={{ fontSize: '1.8rem' }}>
                  {feature.icon}
                </span>
                <h3 className="t-lg t-semibold">{t(`landing.feature${feature.key}Title`)}</h3>
                <p className="t-sm t-muted">{t(`landing.feature${feature.key}Text`)}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Roles */}
        <section className="landing__section" aria-labelledby="roles-title">
          <div className="t-center stack-2">
            <h2 id="roles-title" className="t-2xl t-semibold">
              {t('landing.rolesTitle')}
            </h2>
            <p className="t-muted">{t('landing.rolesText')}</p>
          </div>

          <div className="grid grid-4 mt-6">
            {ROLES.map((item) => (
              <Card key={item} className="stack-3 t-center">
                <h3 className="t-lg t-semibold">{t(`roles.${item}`)}</h3>
                <Button variant="secondary" block to="/demo">
                  {t('demo.switchTo', { role: t(`roles.${item}`) })}
                </Button>
              </Card>
            ))}
          </div>
        </section>

        {/* Accessibility */}
        <section className="landing__section" aria-labelledby="a11y-title">
          <Card className="stack-3 t-center" variant="quiet">
            <h2 id="a11y-title" className="t-xl t-semibold">
              {t('landing.a11yTitle')}
            </h2>
            <p className="t-secondary measure" style={{ margin: '0 auto' }}>
              {t('landing.a11yText')}
            </p>
          </Card>
        </section>
      </main>

      <footer className="landing__footer">
      </footer>
    </>
  );
}
