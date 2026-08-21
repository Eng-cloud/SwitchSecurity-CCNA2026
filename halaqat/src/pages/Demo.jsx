import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as authService from '../services/authService.js';
import { ROLE_HOME } from '../config/navigation.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import { Button, Alert, Badge } from '../components/ui/index.js';
import { DEMO_ACCOUNTS, DEMO_OTP } from '../mock/db.js';

const ROLE_ICONS = {
  student: '🧑‍🎓',
  teacher: '🧑‍🏫',
  supervisor: '🧭',
  admin: '🛠',
  parent: '👨‍👦',
};

const ROLE_HINTS = {
  student: 'المصحف، الحفظ، التسميع، الاختبارات، التقدم',
  teacher: 'الحلقة، الحضور، الجلسات، الملاحظات، التقارير',
  supervisor: 'الحلقات التابعة، المعلمون، الأداء، التقارير',
  admin: 'المستخدمون، الحلقات، الإحصائيات، الإعدادات',
  parent: 'متابعة الأبناء، التقدم، التقارير',
};

/** دخول تجريبي مباشر بدور مختار. */
export default function Demo() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();
  const { signIn } = useAuth();
  const [pending, setPending] = useState(null);

  const enterAs = async (role) => {
    setPending(role);
    try {
      const session = await authService.loginDemo(role);
      signIn(session);
      toast.success(t('demo.switched', { role: t(`roles.${role}`) }));
      navigate(ROLE_HOME[role], { replace: true });
    } catch {
      toast.error(t('auth.errors.generic'));
    } finally {
      setPending(null);
    }
  };

  return (
    <AuthLayout title={t('demo.title')} subtitle={t('demo.subtitle')}>
      <div className="stack-4">
        {DEMO_ACCOUNTS.map((account) => (
          <div key={account.role} className="card stack-3">
            <div className="row row-3">
              <span aria-hidden="true" style={{ fontSize: '1.6rem' }}>
                {ROLE_ICONS[account.role]}
              </span>
              <div className="grow">
                <p className="t-semibold">{t(`roles.${account.role}`)}</p>
                <p className="t-xs t-muted">{ROLE_HINTS[account.role]}</p>
              </div>
            </div>

            <p className="t-xs t-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
              {account.email}
            </p>

            <Button
              block
              status={pending === account.role ? 'loading' : 'idle'}
              loadingText={t('demo.entering')}
              onClick={() => enterAs(account.role)}
              data-testid={`demo-login-${account.role}`}
            >
              {t('demo.enter')}
            </Button>
          </div>
        ))}

        <Alert variant="info">
          {t('demo.otpNotice', { code: DEMO_OTP })}
        </Alert>

        <p className="t-center t-sm">
          <Link to="/login">← {t('auth.backToLogin')}</Link>
        </p>
      </div>
    </AuthLayout>
  );
}
