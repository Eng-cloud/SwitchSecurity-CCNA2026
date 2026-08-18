import { useCallback, useMemo, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as managementService from '../../services/managementService.js';
import { CITY_LIST, DISTRICT_LIST, MOSQUE_LIST } from '../../mock/db.js';
import { formatNumber, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Card,
  Button,
  Field,
  Input,
  Select,
  Textarea,
  Badge,
  Alert,
  DataState,
  EmptyState,
  Skeleton,
} from '../../components/ui/index.js';

const STATUS_VARIANT = { pending: 'warning', approved: 'success', rejected: 'danger' };

/**
 * ولي الأمر يرسل طلب تسجيل لابنه محددًا المدينة والحي والمسجد والحلقة،
 * ويصل الطلب إلى المشرف والإدارة لاعتماده.
 */
export default function ParentRequests() {
  const t = useT();
  const { user, role } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    childName: '',
    age: '',
    city: '',
    district: '',
    mosque: '',
    circleId: '',
    note: '',
  });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState('idle');

  const requestsFetcher = useCallback(
    () => managementService.listEnrollmentRequests({ role, userId: user.userId }),
    [role, user.userId],
  );
  const { data: requests, loading, error, refetch } = useAsyncData(requestsFetcher, [user.userId]);

  const circlesFetcher = useCallback(
    () => managementService.listCircleOptions({ city: form.city, district: form.district }),
    [form.city, form.district],
  );
  const { data: circleOptions } = useAsyncData(circlesFetcher, [form.city, form.district], {
    enabled: Boolean(form.city && form.district),
  });

  const availableCircles = useMemo(() => circleOptions ?? [], [circleOptions]);

  const update = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      // تغيير المدينة أو الحي يُعيد اختيار الحلقة لأن القائمة تتغير.
      ...(key === 'city' || key === 'district' ? { circleId: '' } : {}),
    }));
    setErrors((prev) => ({ ...prev, [key]: null }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const next = {};
    if (form.childName.trim().length < 3) next.childName = t('auth.errors.nameShort');
    if (!form.city) next.city = t('parent.requests.errors.city');
    if (!form.district) next.district = t('parent.requests.errors.district');
    if (!form.mosque) next.mosque = t('parent.requests.errors.mosque');
    if (!form.circleId) next.circleId = t('parent.requests.errors.circle');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setStatus('loading');
    try {
      await managementService.createEnrollmentRequest({
        role,
        parentId: user.userId,
        parentName: user.name,
        payload: form,
      });
      setStatus('success');
      toast.success(t('parent.requests.sent'));
      setForm({ childName: '', age: '', city: '', district: '', mosque: '', circleId: '', note: '' });
      refetch();
    } catch (err) {
      setStatus('idle');
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    }
  };

  return (
    <>
      <PageHeader
        title={t('parent.requests.title')}
        subtitle={t('parent.requests.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/parent' },
          { label: t('parent.requests.title') },
        ]}
      />

      <div className="grid grid-2">
        {/* النموذج */}
        <Card className="stack-5">
          <h2 className="t-lg t-semibold">{t('parent.requests.formTitle')}</h2>

          <form className="stack-4" onSubmit={handleSubmit} noValidate>
            <Field label={t('parent.requests.childName')} error={errors.childName} required>
              <Input
                value={form.childName}
                onChange={(event) => update('childName', event.target.value)}
                data-testid="request-child-name"
              />
            </Field>

            <Field label={t('parent.requests.age')} optional>
              <Select value={form.age} onChange={(event) => update('age', event.target.value)}>
                <option value="">—</option>
                {Array.from({ length: 12 }, (_, index) => index + 6).map((age) => (
                  <option key={age} value={age}>
                    {formatNumber(age)}
                  </option>
                ))}
              </Select>
            </Field>

            <div className="grid grid-2">
              <Field label={t('parent.requests.city')} error={errors.city} required>
                <Select
                  value={form.city}
                  onChange={(event) => update('city', event.target.value)}
                  data-testid="request-city"
                >
                  <option value="">{t('admin.form.selectCity')}</option>
                  {CITY_LIST.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label={t('parent.requests.district')} error={errors.district} required>
                <Select
                  value={form.district}
                  onChange={(event) => update('district', event.target.value)}
                  data-testid="request-district"
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

            <Field label={t('parent.requests.mosque')} error={errors.mosque} required>
              <Select
                value={form.mosque}
                onChange={(event) => update('mosque', event.target.value)}
                data-testid="request-mosque"
              >
                <option value="">{t('admin.form.selectMosque')}</option>
                {MOSQUE_LIST.map((mosque) => (
                  <option key={mosque} value={mosque}>
                    {mosque}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t('parent.requests.circle')}
              hint={!form.city || !form.district ? t('parent.requests.filterHint') : undefined}
              error={errors.circleId}
              required
            >
              <Select
                value={form.circleId}
                onChange={(event) => update('circleId', event.target.value)}
                disabled={!form.city || !form.district}
                data-testid="request-circle"
              >
                <option value="">{t('admin.form.selectCircle')}</option>
                {availableCircles.map((circle) => (
                  <option key={circle.id} value={circle.id}>
                    {circle.name} — {circle.mosque}
                  </option>
                ))}
              </Select>
            </Field>

            {form.city && form.district && availableCircles.length === 0 ? (
              <Alert variant="warning">{t('parent.requests.noCircles')}</Alert>
            ) : null}

            <Field label={t('parent.requests.note')} optional>
              <Textarea
                rows={3}
                value={form.note}
                placeholder={t('parent.requests.notePlaceholder')}
                onChange={(event) => update('note', event.target.value)}
              />
            </Field>

            <Button
              type="submit"
              size="lg"
              status={status}
              loadingText={t('parent.requests.submitting')}
              successText={t('parent.requests.sent')}
              data-testid="submit-request"
            >
              {t('parent.requests.submit')}
            </Button>
          </form>
        </Card>

        {/* الطلبات السابقة */}
        <Section title={t('parent.requests.myRequests')} id="my-requests">
          <DataState
            loading={loading}
            error={error}
            onRetry={refetch}
            isEmpty={(requests ?? []).length === 0}
            emptyTitle={t('parent.requests.myRequests')}
            emptyText={t('parent.requests.empty')}
            loadingFallback={<Skeleton variant="card" count={2} height={110} />}
          >
            <ul className="stack-3">
              {(requests ?? []).map((item) => (
                <li key={item.id}>
                  <Card variant="flat" className="stack-3">
                    <div className="row row-between row-wrap">
                      <div>
                        <p className="t-medium">{item.childName}</p>
                        <p className="t-xs t-muted">
                          {item.circleName} · {item.district} · {item.mosque}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[item.status]}>
                        {t(`parent.requests.status.${item.status}`)}
                      </Badge>
                    </div>

                    <p className="t-xs t-muted">
                      {t('parent.requests.sentAt', { date: formatRelative(item.createdAt, t) })}
                      {item.decidedByName
                        ? ` · ${t('parent.requests.decidedBy', { name: item.decidedByName })}`
                        : ''}
                    </p>

                    {item.status === 'rejected' && item.rejectionReason ? (
                      <Alert variant="danger">{item.rejectionReason}</Alert>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </DataState>
        </Section>
      </div>
    </>
  );
}
