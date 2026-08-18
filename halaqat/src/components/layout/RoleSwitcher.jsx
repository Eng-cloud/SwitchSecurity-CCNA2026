import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { ROLE_HOME } from '../../config/navigation.js';
import Button from '../ui/Button.jsx';
import { ROLE_ORDER as ROLES } from '../../config/permissions.js';

/**
 * تبديل الدور — لاستعراض المنصة من منظور كل دور.
 */
export default function RoleSwitcher({ onDone, compact = true }) {
  const t = useT();
  const navigate = useNavigate();
  const { role, switchRole } = useAuth();
  const toast = useToast();
  const [pending, setPending] = useState(null);

  const handleSwitch = async (nextRole) => {
    if (nextRole === role || pending) return;
    setPending(nextRole);
    try {
      await switchRole(nextRole);
      toast.success(t('demo.switched', { role: t(`roles.${nextRole}`) }));
      navigate(ROLE_HOME[nextRole], { replace: true });
      onDone?.();
    } catch {
      toast.error(t('auth.errors.generic'));
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="stack-2">
      <p className="t-xs t-muted">
        {t('demo.currentAccount')} <strong>{t(`roles.${role}`)}</strong>
      </p>
      <div className={compact ? 'stack-1' : 'grid grid-2'}>
        {ROLES.filter((item) => item !== role).map((item) => (
          <Button
            key={item}
            variant="secondary"
            size="sm"
            block
            status={pending === item ? 'loading' : 'idle'}
            loadingText={t('demo.switching')}
            onClick={() => handleSwitch(item)}
          >
            {t('demo.switchTo', { role: t(`roles.${item}`) })}
          </Button>
        ))}
      </div>
      <p className="t-xs t-muted">{t('demo.notice')}</p>
    </div>
  );
}
