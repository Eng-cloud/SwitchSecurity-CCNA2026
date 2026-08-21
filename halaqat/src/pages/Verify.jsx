import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as authService from '../services/authService.js';
import { validateOtp } from '../lib/validators.js';
import { formatDuration } from '../lib/format.js';
import { ROLE_HOME } from '../config/navigation.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import OtpInput from '../components/ui/OtpInput.jsx';
import { Button, Alert } from '../components/ui/index.js';

/** شاشة رمز التحقق مع مؤقّت انتهاء ومؤقّت إعادة إرسال. */
export default function Verify() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn } = useAuth();

  const [challenge, setChallenge] = useState(() => authService.getChallenge());
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [status, setStatus] = useState('idle');
  const [now, setNow] = useState(Date.now());
  const submittingRef = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const expiresIn = challenge ? Math.max(0, Math.round((challenge.expiresAt - now) / 1000)) : 0;
  const resendIn = challenge
    ? Math.max(0, Math.round((challenge.resendAvailableAt - now) / 1000))
    : 0;

  const handleVerify = useCallback(
    async (submitted) => {
      const value = submitted ?? code;
      const validationKey = validateOtp(value);
      if (validationKey) {
        setError(t(validationKey));
        return;
      }
      if (submittingRef.current) return;

      submittingRef.current = true;
      setStatus('loading');
      setError(null);
      try {
        const session = await authService.verifyOtp(value);
        signIn(session);
        setStatus('success');
        toast.success(t('auth.otp.success'));
        navigate(ROLE_HOME[session.role] ?? '/app', { replace: true });
      } catch (err) {
        setStatus('idle');
        const message = t(err?.messageKey ?? 'auth.errors.generic');
        setError(message);
        toast.error(message);
        setCode('');
      } finally {
        submittingRef.current = false;
      }
    },
    [code, navigate, signIn, t, toast],
  );

  const handleResend = async () => {
    try {
      const next = await authService.resendOtp();
      setChallenge(next);
      setCode('');
      setError(null);
      toast.success(t('auth.otp.resent'));
    } catch {
      toast.error(t('auth.errors.generic'));
    }
  };

  if (!challenge) {
    return <Navigate to="/login" replace />;
  }

  const isExpired = expiresIn === 0;

  return (
    <AuthLayout title={t('auth.otp.title')}>
      <div className="stack-5">
        <p className="t-center t-sm t-secondary">
          {t('auth.otp.sentTo')}
          <br />
          <strong style={{ direction: 'ltr', display: 'inline-block' }}>{challenge.masked}</strong>
        </p>

        <OtpInput
          value={code}
          onChange={(value) => {
            setCode(value);
            if (error) setError(null);
          }}
          onComplete={(value) => handleVerify(value)}
          invalid={Boolean(error)}
          disabled={status === 'loading'}
        />

        {error ? (
          <p className="field__error t-center" role="alert" style={{ justifyContent: 'center' }}>
            <span aria-hidden="true">✕</span>
            {error}
          </p>
        ) : null}

        <p className="t-center t-sm t-muted" aria-live="polite">
          {isExpired
            ? t('auth.otp.expired')
            : t('auth.otp.expiresIn', { time: formatDuration(expiresIn) })}
        </p>

        <Button
          size="lg"
          block
          status={status}
          loadingText={t('auth.otp.verifying')}
          successText={t('auth.otp.success')}
          onClick={() => handleVerify()}
          disabled={isExpired}
          data-testid="otp-submit"
        >
          {t('auth.otp.verify')}
        </Button>

        <div className="row row-center">
          {resendIn > 0 && !isExpired ? (
            <p className="t-sm t-muted" aria-live="polite">
              {t('auth.otp.resendIn', { time: formatDuration(resendIn) })}
            </p>
          ) : (
            <Button variant="ghost" onClick={handleResend}>
              {t('auth.otp.resend')}
            </Button>
          )}
        </div>

        <Alert variant="mock" title={t('auth.otp.demoHint', { code: challenge.demoCode })}>
          {t('auth.otp.demoNote')} {t('auth.otp.pasteHint')}
        </Alert>

        <p className="t-center">
          <Link to="/login" className="t-sm">
            ← {t('auth.otp.changeMethod')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
