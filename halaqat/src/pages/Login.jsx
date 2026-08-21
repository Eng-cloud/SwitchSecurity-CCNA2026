import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as authService from '../services/authService.js';
import { validateIdentifier } from '../lib/validators.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import { Button, Field, Input, Alert } from '../components/ui/index.js';
import { DEMO_ACCOUNTS } from '../mock/db.js';

/** تسجيل الدخول — يقبل البريد الإلكتروني أو رقم الجوال. */
export default function Login() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationKey = validateIdentifier(identifier);
    if (validationKey) {
      setError(t(validationKey));
      return;
    }

    setError(null);
    setStatus('loading');
    try {
      await authService.requestOtp(identifier);
      setStatus('idle');
      navigate('/login/verify');
    } catch (err) {
      setStatus('idle');
      const message = t(err?.messageKey ?? 'auth.errors.generic');
      setError(message);
      toast.error(message);
    }
  };

  return (
    <AuthLayout title={t('auth.welcome')} subtitle={t('auth.loginSubtitle')}>
      <form className="stack-5" onSubmit={handleSubmit} noValidate>
        <Field
          label={t('auth.identifierLabel')}
          hint={t('auth.identifierHint')}
          error={error}
          required
        >
          <Input
            type="text"
            inputMode="email"
            autoComplete="username"
            autoFocus
            value={identifier}
            onChange={(event) => {
              setIdentifier(event.target.value);
              if (error) setError(null);
            }}
            placeholder={t('auth.identifierPlaceholder')}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          block
          status={status}
          loadingText={t('auth.checking')}
          data-testid="login-submit"
        >
          {t('auth.continue')}
        </Button>
      </form>

      <div className="ornament-line" aria-hidden="true">
        <span className="ornament-dot">۞</span>
      </div>

      <div className="stack-3">
        <p className="t-center t-sm t-muted">
          {t('auth.noAccount')}{' '}
          <Link to="/register" className="t-medium">
            {t('auth.createAccount')}
          </Link>
        </p>

        <Button variant="secondary" block to="/demo">
          {t('auth.tryDemo')}
        </Button>

        <Alert variant="mock" title={t('demo.accountsTitle')}>
          <ul className="stack-1 t-xs" style={{ direction: 'ltr', textAlign: 'start' }}>
            {DEMO_ACCOUNTS.map((account) => (
              <li key={account.email}>
                <button
                  type="button"
                  className="t-brand"
                  onClick={() => {
                    setIdentifier(account.email);
                    setError(null);
                  }}
                >
                  {account.email}
                </button>
              </li>
            ))}
          </ul>
        </Alert>
      </div>
    </AuthLayout>
  );
}
