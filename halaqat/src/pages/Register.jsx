import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useT } from '../i18n/index.jsx';
import { useToast } from '../context/ToastContext.jsx';
import * as authService from '../services/authService.js';
import { validateIdentifier, validateName } from '../lib/validators.js';
import AuthLayout from '../components/layout/AuthLayout.jsx';
import { Button, Field, Input, Select, Checkbox, RadioGroup, ProgressBar } from '../components/ui/index.js';

const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'أبها', 'بريدة'];
import { sortRoles } from '../config/permissions.js';

const ROLES = sortRoles(['student', 'teacher', 'parent']);

/** إنشاء حساب على خطوتين قصيرتين ثم رمز التحقق. */
export default function Register() {
  const t = useT();
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState(1);
  const [values, setValues] = useState({
    name: '',
    identifier: '',
    city: '',
    role: 'student',
    terms: false,
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');

  const update = (key, value) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const validateStep1 = () => {
    const next = {};
    const nameKey = validateName(values.name);
    if (nameKey) next.name = t(nameKey);
    const identifierKey = validateIdentifier(values.identifier);
    if (identifierKey) next.identifier = t(identifierKey);
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleNext = (event) => {
    event.preventDefault();
    if (validateStep1()) setStep(2);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!values.terms) {
      setErrors({ terms: t('auth.errors.termsRequired') });
      return;
    }

    setStatus('loading');
    try {
      await authService.register(values);
      setStatus('idle');
      toast.success(t('auth.otp.resent'));
      navigate('/login/verify');
    } catch (err) {
      setStatus('idle');
      const message = t(err?.messageKey ?? 'auth.errors.generic');
      toast.error(message);
      setErrors({ identifier: message });
      setStep(1);
    }
  };

  return (
    <AuthLayout title={t('auth.register.title')} subtitle={t('auth.register.subtitle')}>
      <div className="stack-5">
        <ProgressBar
          value={step}
          max={2}
          label={t('auth.register.stepOf', { current: step, total: 2 })}
          valueText={`${step}/2`}
        />

        {step === 1 ? (
          <form className="stack-5" onSubmit={handleNext} noValidate>
            <h2 className="t-lg t-semibold">{t('auth.register.step1')}</h2>

            <Field label={t('auth.register.nameLabel')} error={errors.name} required>
              <Input
                value={values.name}
                autoComplete="name"
                autoFocus
                placeholder={t('auth.register.namePlaceholder')}
                onChange={(event) => update('name', event.target.value)}
              />
            </Field>

            <Field
              label={t('auth.register.identifierLabel')}
              hint={t('auth.identifierHint')}
              error={errors.identifier}
              required
            >
              <Input
                value={values.identifier}
                autoComplete="username"
                placeholder={t('auth.identifierPlaceholder')}
                onChange={(event) => update('identifier', event.target.value)}
              />
            </Field>

            <Field label={t('auth.register.cityLabel')} optional>
              <Select value={values.city} onChange={(event) => update('city', event.target.value)}>
                <option value="">{t('auth.register.cityPlaceholder')}</option>
                {CITIES.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>

            <Button type="submit" size="lg" block>
              {t('common.next')}
            </Button>
          </form>
        ) : (
          <form className="stack-5" onSubmit={handleSubmit} noValidate>
            <h2 className="t-lg t-semibold">{t('auth.register.step2')}</h2>

            <RadioGroup
              legend={t('auth.register.roleLabel')}
              name="role"
              value={values.role}
              onChange={(value) => update('role', value)}
              options={ROLES.map((role) => ({
                value: role,
                label: t(`roles.${role}`),
              }))}
            />
            <p className="t-sm t-muted">{t('auth.register.roleHint')}</p>

            <Checkbox
              label={t('auth.register.terms')}
              checked={values.terms}
              onChange={(checked) => update('terms', checked)}
            />
            {errors.terms ? (
              <p className="field__error" role="alert">
                <span aria-hidden="true">✕</span>
                {errors.terms}
              </p>
            ) : null}

            <div className="row row-2">
              <Button variant="ghost" onClick={() => setStep(1)} type="button">
                {t('common.back')}
              </Button>
              <Button
                type="submit"
                size="lg"
                className="grow"
                status={status}
                loadingText={t('auth.register.submitting')}
              >
                {t('auth.register.submit')}
              </Button>
            </div>
          </form>
        )}

        <p className="t-center t-sm t-muted">
          {t('auth.haveAccount')}{' '}
          <Link to="/login" className="t-medium">
            {t('auth.loginTitle')}
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
