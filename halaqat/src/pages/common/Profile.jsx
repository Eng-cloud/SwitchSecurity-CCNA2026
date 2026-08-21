import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as authService from '../../services/authService.js';
import { validateName } from '../../lib/validators.js';
import { formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Field,
  Input,
  Avatar,
  Badge,
} from '../../components/ui/index.js';

/** الملف الشخصي — عرض ثم تعديل. */
export default function Profile() {
  const t = useT();
  const { user, updateSession } = useAuth();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: user?.name ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    city: user?.city ?? '',
  });

  const handleSave = async (event) => {
    event.preventDefault();
    const key = validateName(form.name);
    if (key) {
      setError(t(key));
      return;
    }

    setStatus('loading');
    try {
      await authService.updateProfile(user.userId, form);
      updateSession(form);
      setStatus('idle');
      setEditing(false);
      toast.success(t('profile.saved'));
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  const handleCancel = () => {
    setForm({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone ?? '',
      city: user?.city ?? '',
    });
    setError(null);
    setEditing(false);
  };

  return (
    <>
      <PageHeader
        title={t('profile.title')}
        subtitle={t('profile.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app' }, { label: t('profile.title') }]}
        actions={
          !editing ? (
            <Button onClick={() => setEditing(true)}>{t('profile.edit')}</Button>
          ) : null
        }
      />

      <Card className="profile-hero">
        <Avatar name={user?.name} size="xl" label={t('profile.avatarAlt', { name: user?.name })} />
        <div className="grow stack-2">
          <h2 className="t-xl t-semibold">{user?.name}</h2>
          <div className="row row-2 row-wrap">
            <Badge variant="brand">{t(`roles.${user?.role}`)}</Badge>
            <Badge variant="warning" icon="◇">
            </Badge>
          </div>
          <p className="t-sm t-muted">
            {t('profile.joinedOn', { date: formatShortDate(user?.startedAt) })}
          </p>
        </div>
      </Card>

      <Card className="stack-5">
        {editing ? (
          <form className="stack-4" onSubmit={handleSave}>
            <Field label={t('settings.accountName')} error={error} required>
              <Input
                value={form.name}
                autoFocus
                onChange={(event) => {
                  setForm((prev) => ({ ...prev, name: event.target.value }));
                  if (error) setError(null);
                }}
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

            <div className="row row-3">
              <Button
                type="submit"
                status={status}
                loadingText={t('common.saving')}
                successText={t('common.saved')}
              >
                {t('profile.saveChanges')}
              </Button>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                {t('profile.cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <dl className="info-list">
            {[
              { label: t('settings.accountName'), value: user?.name },
              { label: t('settings.accountEmail'), value: user?.email },
              { label: t('settings.accountPhone'), value: user?.phone || '—' },
              { label: t('settings.accountCity'), value: user?.city || '—' },
              { label: t('settings.accountRole'), value: t(`roles.${user?.role}`) },
            ].map((item) => (
              <div className="info-list__item" key={item.label}>
                <dt className="info-list__label">{item.label}</dt>
                <dd className="info-list__value">{item.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </Card>
    </>
  );
}
