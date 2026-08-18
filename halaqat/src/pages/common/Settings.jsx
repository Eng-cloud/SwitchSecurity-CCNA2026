import { useState } from 'react';
import { NavLink, useParams, useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useA11y } from '../../context/A11yContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as authService from '../../services/authService.js';
import * as notificationService from '../../services/notificationService.js';
import { resetDb } from '../../mock/db.js';
import { formatDateTime } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Field,
  Input,
  Switch,
  SegmentedControl,
  Alert,
  Badge,
  Accordion,
  ConfirmDialog,
} from '../../components/ui/index.js';
import RoleSwitcher from '../../components/layout/RoleSwitcher.jsx';

const SECTIONS = [
  { key: 'account', icon: '👤' },
  { key: 'appearance', icon: '🌗' },
  { key: 'notifications', icon: '🔔' },
  { key: 'accessibility', icon: '♿' },
  { key: 'sessions', icon: '💻' },
  { key: 'help', icon: '❓' },
];

/** الإعدادات بأقسامها — كل قسم مسار مستقل يعمل مع Deep Link والرجوع. */
export default function Settings() {
  const t = useT();
  const { section = 'account' } = useParams();
  const active = SECTIONS.some((item) => item.key === section) ? section : 'account';

  return (
    <>
      <PageHeader
        title={t('settings.title')}
        subtitle={t('settings.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app' }, { label: t('settings.title') }]}
      />

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.title')}>
          {SECTIONS.map((item) => (
            <NavLink
              key={item.key}
              to={`/app/settings/${item.key}`}
              className={({ isActive }) =>
                `nav-item${isActive || (item.key === 'account' && active === 'account') ? ' is-active' : ''}`
              }
            >
              <span className="nav-item__icon" aria-hidden="true">
                {item.icon}
              </span>
              {t(`settings.${item.key}`)}
            </NavLink>
          ))}
        </nav>

        <div>
          {active === 'account' ? <AccountSection /> : null}
          {active === 'appearance' ? <AppearanceSection /> : null}
          {active === 'notifications' ? <NotificationsSection /> : null}
          {active === 'accessibility' ? <AccessibilitySection /> : null}
          {active === 'sessions' ? <SessionsSection /> : null}
          {active === 'help' ? <HelpSection /> : null}
        </div>
      </div>
    </>
  );
}

/* ---------------- الحساب ---------------- */
function AccountSection() {
  const t = useT();
  const { user, updateSession } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    city: user?.city ?? '',
  });
  const [status, setStatus] = useState('idle');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus('loading');
    try {
      await authService.updateProfile(user.userId, form);
      updateSession(form);
      setStatus('success');
      toast.success(t('settings.saved'));
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  return (
    <Card className="stack-5">
      <h2 className="t-lg t-semibold">{t('settings.account')}</h2>
      <form className="stack-4" onSubmit={handleSubmit}>
        <Field label={t('settings.accountName')} required>
          <Input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
          />
        </Field>

        <Field label={t('settings.accountEmail')}>
          <Input
            type="email"
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
          />
        </Field>

        <Field label={t('settings.accountPhone')} optional>
          <Input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
          />
        </Field>

        <Field label={t('settings.accountCity')} optional>
          <Input
            value={form.city}
            onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
          />
        </Field>

        <div className="row row-3 row-wrap">
          <Badge variant="brand">{t(`roles.${user?.role}`)}</Badge>
          <Badge variant="warning" icon="◇">
            {t('demo.demoOnly')}
          </Badge>
        </div>

        <Button
          type="submit"
          status={status}
          loadingText={t('common.saving')}
          successText={t('common.saved')}
        >
          {t('settings.save')}
        </Button>
      </form>
    </Card>
  );
}

/* ---------------- المظهر ---------------- */
function AppearanceSection() {
  const t = useT();
  const { mode, setMode } = useTheme();
  const { announce } = useToast();

  return (
    <Card className="stack-5">
      <h2 className="t-lg t-semibold">{t('settings.appearance')}</h2>

      <div className="stack-2">
        <span className="field__label">{t('theme.label')}</span>
        <SegmentedControl
          label={t('theme.label')}
          value={mode}
          onChange={(next) => {
            setMode(next);
            announce(t('theme.changed', { mode: t(`theme.${next}`) }));
          }}
          options={[
            { value: 'light', label: t('theme.light'), icon: '☀' },
            { value: 'dark', label: t('theme.dark'), icon: '🌙' },
            { value: 'system', label: t('theme.system'), icon: '🖥' },
          ]}
        />
      </div>

      <p className="t-sm t-muted">{t('settings.appearanceHint')}</p>
      <Alert variant="info">{t('a11y.savedNote')}</Alert>
    </Card>
  );
}

/* ---------------- الإشعارات ---------------- */
function NotificationsSection() {
  const t = useT();
  const toast = useToast();
  const [prefs, setPrefs] = useState(() => notificationService.getPreferences());

  const update = (key, value) => {
    const next = notificationService.savePreferences({ [key]: value });
    setPrefs(next);
    toast.success(t('settings.saved'));
  };

  return (
    <Card className="stack-5">
      <h2 className="t-lg t-semibold">{t('settings.notifications')}</h2>
      <p className="t-sm t-muted">{t('settings.notificationsHint')}</p>

      <div className="stack-3">
        <Switch
          label={t('settings.notify.sessions')}
          checked={prefs.sessions}
          onChange={(value) => update('sessions', value)}
        />
        <Switch
          label={t('settings.notify.tests')}
          checked={prefs.tests}
          onChange={(value) => update('tests', value)}
        />
        <Switch
          label={t('settings.notify.reports')}
          checked={prefs.reports}
          onChange={(value) => update('reports', value)}
        />
        <Switch
          label={t('settings.notify.goals')}
          checked={prefs.goals}
          onChange={(value) => update('goals', value)}
        />
        <Switch
          label={t('settings.notify.sound')}
          hint={t('settings.notify.soundHint')}
          checked={prefs.sound}
          onChange={(value) => update('sound', value)}
        />
      </div>
    </Card>
  );
}

/* ---------------- إمكانية الوصول ---------------- */
function AccessibilitySection() {
  const t = useT();
  const { settings, setSetting, reset, systemReducedMotion } = useA11y();
  const { mode, setMode } = useTheme();
  const toast = useToast();

  return (
    <div className="stack-5">
      <Card className="stack-5">
        <div>
          <h2 className="t-lg t-semibold">{t('a11y.title')}</h2>
          <p className="t-sm t-muted">{t('a11y.subtitle')}</p>
        </div>

        <div className="stack-2">
          <span className="field__label">{t('a11y.fontSize')}</span>
          <SegmentedControl
            label={t('a11y.fontSize')}
            value={settings.fontScale}
            onChange={(value) => setSetting('fontScale', value)}
            options={[
              { value: 'normal', label: t('a11y.fontNormal') },
              { value: 'large', label: t('a11y.fontLarge') },
              { value: 'xlarge', label: t('a11y.fontXLarge') },
            ]}
          />
        </div>

        <div className="stack-2">
          <span className="field__label">{t('a11y.contrast')}</span>
          <SegmentedControl
            label={t('a11y.contrast')}
            value={settings.contrast}
            onChange={(value) => setSetting('contrast', value)}
            options={[
              { value: 'normal', label: t('a11y.contrastNormal') },
              { value: 'high', label: t('a11y.contrastHigh') },
            ]}
          />
        </div>

        <div className="stack-2">
          <span className="field__label">{t('a11y.motion')}</span>
          <SegmentedControl
            label={t('a11y.motion')}
            value={settings.motion === 'system' ? 'system' : settings.motion}
            onChange={(value) => setSetting('motion', value)}
            options={[
              { value: 'system', label: t('theme.system') },
              { value: 'normal', label: t('a11y.motionNormal') },
              { value: 'reduced', label: t('a11y.motionReduced') },
            ]}
          />
          {systemReducedMotion ? (
            <p className="t-sm t-muted">{t('a11y.systemMotionNote')}</p>
          ) : null}
        </div>

        <div className="stack-2">
          <span className="field__label">{t('a11y.appearance')}</span>
          <SegmentedControl
            label={t('a11y.appearance')}
            value={mode}
            onChange={setMode}
            options={[
              { value: 'light', label: t('theme.light'), icon: '☀' },
              { value: 'dark', label: t('theme.dark'), icon: '🌙' },
              { value: 'system', label: t('theme.system'), icon: '🖥' },
            ]}
          />
        </div>

        <Button
          variant="secondary"
          onClick={() => {
            reset();
            toast.success(t('a11y.resetDone'));
          }}
        >
          {t('a11y.resetAll')}
        </Button>

        <Alert variant="info">{t('a11y.savedNote')}</Alert>
      </Card>

      <Card className="stack-3" variant="quiet">
        <h3 className="t-md t-semibold">{t('a11y.preview')}</h3>
        <p>{t('a11y.previewText')}</p>
        <div className="row row-3 row-wrap">
          <Button>{t('common.save')}</Button>
          <Button variant="secondary">{t('common.cancel')}</Button>
          <Badge variant="success">{t('common.saved')}</Badge>
        </div>
      </Card>
    </div>
  );
}

/* ---------------- الجلسات ---------------- */
function SessionsSection() {
  const t = useT();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Card className="stack-5">
        <h2 className="t-lg t-semibold">{t('settings.sessions')}</h2>
        <p className="t-sm t-muted">{t('settings.sessionsHint')}</p>

        <Card variant="quiet" className="row row-between row-wrap">
          <div>
            <p className="t-medium">{t('settings.currentSession')}</p>
            <p className="t-xs t-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
              {user?.device}
            </p>
            <p className="t-xs t-muted">{formatDateTime(user?.startedAt)}</p>
          </div>
          <Button variant="danger" onClick={() => setConfirmOpen(true)}>
            {t('settings.endSession')}
          </Button>
        </Card>

        <div className="stack-2">
          <h3 className="t-md t-semibold">{t('demo.switchTitle')}</h3>
          <RoleSwitcher compact={false} />
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={async () => {
          await signOut();
          toast.success(t('settings.sessionEnded'));
          navigate('/login', { replace: true });
        }}
        title={t('auth.logout.title')}
        message={t('auth.logout.question')}
        confirmLabel={t('auth.logout.confirm')}
        variant="danger"
      />
    </>
  );
}

/* ---------------- المساعدة ---------------- */
function HelpSection() {
  const t = useT();
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Card className="stack-5">
        <h2 className="t-lg t-semibold">{t('settings.helpTitle')}</h2>

        <Accordion
          defaultOpen={['q1']}
          items={[
            { id: 'q1', title: t('settings.helpQ1'), content: <p>{t('settings.helpA1')}</p> },
            { id: 'q2', title: t('settings.helpQ2'), content: <p>{t('settings.helpA2')}</p> },
            { id: 'q3', title: t('settings.helpQ3'), content: <p>{t('settings.helpA3')}</p> },
          ]}
        />

        <Button variant="danger" onClick={() => setConfirmOpen(true)}>
          {t('settings.resetDemo')}
        </Button>

        <Alert variant="mock">{t('app.mockNotice')}</Alert>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => {
          resetDb();
          setConfirmOpen(false);
          toast.success(t('settings.resetDemoDone'));
          window.location.reload();
        }}
        title={t('settings.resetDemo')}
        message={t('settings.resetDemoConfirm')}
        confirmLabel={t('common.confirm')}
        variant="danger"
      />
    </>
  );
}
