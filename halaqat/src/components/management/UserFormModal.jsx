import { useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { CITY_LIST, DISTRICT_LIST, MOSQUE_LIST } from '../../mock/db.js';
import { Modal, Button, Field, Input, Select } from '../ui/index.js';

/**
 * نموذج إضافة مشرف أو معلم أو إداري.
 * المعلم يمكن إنشاء حلقته مباشرة (اسم الحلقة + المسجد) حتى لا يبقى بلا حلقة.
 * والإداري يُسأل عن مستواه صراحةً، فالفارق بين العليا والمحدود ليس تفصيلًا.
 */
export default function UserFormModal({
  open,
  onClose,
  onSubmit,
  targetRole,
  supervisors = [],
  status = 'idle',
  mayCreateCircle = true,
}) {
  const t = useT();
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    district: '',
    mosque: '',
    circleName: '',
    supervisorId: '',
    level: 'beginner',
    adminLevel: 'limited',
  });
  const [error, setError] = useState(null);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (form.name.trim().length < 3) {
      setError(t('auth.errors.nameShort'));
      return;
    }
    await onSubmit({ ...form, role: targetRole });
    setForm({
      name: '',
      email: '',
      phone: '',
      city: '',
      district: '',
      mosque: '',
      circleName: '',
      supervisorId: '',
      level: 'beginner',
      adminLevel: 'limited',
    });
  };

  const title =
    targetRole === 'admin'
      ? t('admin.users.addTitle')
      : targetRole === 'supervisor'
        ? t('admin.supervisors.addTitle')
        : t('admin.teachers.addTitle');

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button onClick={handleSubmit} status={status} data-testid="submit-user">
            {t('common.save')}
          </Button>
        </>
      }
    >
      <form className="stack-4" onSubmit={handleSubmit} noValidate>
        <Field label={t('admin.form.name')} error={error} required>
          <Input
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            data-testid="user-name"
          />
        </Field>

        <div className="grid grid-2">
          <Field label={t('admin.form.email')} optional>
            <Input
              type="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
            />
          </Field>
          <Field label={t('admin.form.phone')} optional>
            <Input
              type="tel"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
            />
          </Field>
        </div>

        <div className="grid grid-2">
          <Field label={t('admin.form.city')} required>
            <Select
              value={form.city}
              onChange={(event) => update('city', event.target.value)}
              data-testid="user-city"
            >
              <option value="">{t('admin.form.selectCity')}</option>
              {CITY_LIST.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </Select>
          </Field>

          <Field label={t('admin.form.district')} required>
            <Select
              value={form.district}
              onChange={(event) => update('district', event.target.value)}
              data-testid="user-district"
            >
              <option value="">{t('admin.form.selectDistrict')}</option>
              {DISTRICT_LIST.map((district) => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {targetRole === 'admin' ? (
          <Field label={t('admin.users.level')} hint={t('admin.users.levelHint')} required>
            <Select
              value={form.adminLevel}
              data-testid="admin-level"
              onChange={(event) => update('adminLevel', event.target.value)}
            >
              <option value="limited">{t('admin.users.levels.limited')}</option>
              <option value="super">{t('admin.users.levels.super')}</option>
            </Select>
          </Field>
        ) : null}

        {/* إنشاء حلقةٍ مع المعلم إذنٌ مستقل: من لا يملكه لا يُسأل عنها،
            فحقلٌ يُملأ ثم يُهمَل أسوأ من حقلٍ لا يظهر. */}
        {targetRole === 'teacher' && mayCreateCircle ? (
          <>
            <Field label={t('admin.form.circleName')} hint={t('admin.form.optionalCircle')} optional>
              <Input
                value={form.circleName}
                onChange={(event) => update('circleName', event.target.value)}
                data-testid="user-circle-name"
              />
            </Field>

            <div className="grid grid-2">
              <Field label={t('admin.form.mosque')} optional>
                <Select value={form.mosque} onChange={(event) => update('mosque', event.target.value)}>
                  <option value="">{t('admin.form.selectMosque')}</option>
                  {MOSQUE_LIST.map((mosque) => (
                    <option key={mosque} value={mosque}>
                      {mosque}
                    </option>
                  ))}
                </Select>
              </Field>

              {supervisors.length > 0 ? (
                <Field label={t('admin.form.supervisor')} optional>
                  <Select
                    value={form.supervisorId}
                    onChange={(event) => update('supervisorId', event.target.value)}
                  >
                    <option value="">{t('admin.form.selectSupervisor')}</option>
                    {supervisors.map((supervisor) => (
                      <option key={supervisor.id} value={supervisor.id}>
                        {supervisor.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
            </div>
          </>
        ) : null}
      </form>
    </Modal>
  );
}
