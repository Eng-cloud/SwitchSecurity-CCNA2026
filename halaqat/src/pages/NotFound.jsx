import { useT } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { ROLE_HOME } from '../config/navigation.js';
import { Button } from '../components/ui/index.js';
import useDocumentTitle from '../hooks/useDocumentTitle.js';
import Logo from '../components/layout/Logo.jsx';

export default function NotFound() {
  const t = useT();
  const { isAuthenticated, role } = useAuth();
  useDocumentTitle(t('state.notFoundTitle'));

  const home = isAuthenticated ? (ROLE_HOME[role] ?? '/app') : '/';

  return (
    <main
      id="main-content"
      style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center', padding: 'var(--space-7)' }}
    >
      <div className="stack-5 t-center" style={{ maxWidth: '460px' }}>
        <div style={{ display: 'grid', placeItems: 'center' }}>
          <Logo size={56} />
        </div>
        <h1 className="t-3xl t-bold">404</h1>
        <h2 className="t-xl t-semibold">{t('state.notFoundTitle')}</h2>
        <p className="t-secondary">{t('state.notFoundHint')}</p>
        <div className="row row-center">
          <Button to={home} size="lg">
            {t('state.goHome')}
          </Button>
        </div>
      </div>
    </main>
  );
}
