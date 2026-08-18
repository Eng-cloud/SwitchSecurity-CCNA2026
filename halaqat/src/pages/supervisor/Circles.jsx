import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as supervisorService from '../../services/supervisorService.js';
import * as managementService from '../../services/managementService.js';
import { CITY_LIST, DISTRICT_LIST, MOSQUE_LIST } from '../../mock/db.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Table,
  Pagination,
  Button,
  Badge,
  Modal,
  ConfirmDialog,
  Field,
  Input,
  Select,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';
import { useToast } from '../../context/ToastContext.jsx';
import { useState } from 'react';

/** قائمة الحلقات التابعة للمشرف. */
export default function SupervisorCircles() {
  const t = useT();
  const { user, role } = useAuth();
  const toast = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState('idle');
  const [form, setForm] = useState({ name: '', city: '', district: '', mosque: '', level: 'beginner' });
  const { values, setValue } = useListState({ defaults: { q: '', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const fetcher = useCallback(
    () =>
      supervisorService.getCircles(user.userId, {
        query: debouncedQuery,
        page: values.page,
        perPage: 6,
      }),
    [user.userId, debouncedQuery, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    user.userId,
    debouncedQuery,
    values.page,
  ]);

  const run = async (action, successKey) => {
    setStatus('loading');
    try {
      await action();
      toast.success(t(successKey));
      refetch();
      return true;
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
      return false;
    } finally {
      setStatus('idle');
    }
  };

  const columns = [
    { key: 'name', header: t('supervisor.tableCircle') },
    { key: 'teacherName', header: t('supervisor.tableTeacher') },
    {
      key: 'studentsCount',
      header: t('supervisor.tableStudents'),
      render: (row) => formatNumber(row.studentsCount),
    },
    {
      key: 'attendanceRate',
      header: t('supervisor.tableAttendance'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'performance',
      header: t('supervisor.tablePerformance'),
      render: (row) => (
        <Badge variant={row.performance >= 85 ? 'success' : row.performance >= 70 ? 'info' : 'warning'}>
          {formatPercent(row.performance)}
        </Badge>
      ),
    },
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <div className="table__actions">
          <Button size="sm" variant="secondary" to={`/app/supervisor/circles/${row.id}`}>
            {t('supervisor.openCircle')}
          </Button>
          <Button size="sm" variant="ghost" className="t-danger" onClick={() => setDeleting(row)}>
            {t('common.delete')}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('supervisor.circlesTitle')}
        subtitle={t('circles.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/supervisor' }, { label: t('nav.circles') }]}
        actions={
          <Button onClick={() => setAddOpen(true)} data-testid="add-circle">
            {t('supervisor.addCircle')}
          </Button>
        }
      />

      <SearchInput
        value={values.q}
        onChange={(value) => setValue('q', value)}
        placeholder={t('common.searchPlaceholder')}
        label={t('search.label')}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.items?.length === 0}
        emptyTitle={t('state.emptySearchTitle')}
        emptyText={t('state.emptySearchHint')}
        loadingFallback={<Skeleton variant="card" count={4} height={64} />}
      >
        {data ? (
          <>
            <Table
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              caption={t('supervisor.circlesTitle')}
            />
            <Pagination
              page={data.page}
              totalPages={data.totalPages}
              total={data.total}
              from={data.from}
              to={data.to}
              onChange={(page) => setValue('page', page, { resetPage: false })}
            />
          </>
        ) : null}
      </DataState>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('supervisor.addCircleTitle')}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAddOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              status={status}
              data-testid="submit-circle"
              onClick={async () => {
                const ok = await run(
                  () =>
                    managementService.createCircle({
                      role,
                      actorId: user.userId,
                      payload: form,
                    }),
                  'supervisor.circleCreated',
                );
                if (ok) {
                  setAddOpen(false);
                  setForm({ name: '', city: '', district: '', mosque: '', level: 'beginner' });
                }
              }}
            >
              {t('common.save')}
            </Button>
          </>
        }
      >
        <div className="stack-4">
          <Field label={t('admin.form.circleName')} required>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              data-testid="circle-name"
            />
          </Field>
          <div className="grid grid-2 stagger">
            <Field label={t('admin.form.city')}>
              <Select
                value={form.city}
                onChange={(event) => setForm((prev) => ({ ...prev, city: event.target.value }))}
              >
                <option value="">{t('admin.form.selectCity')}</option>
                {CITY_LIST.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('admin.form.district')}>
              <Select
                value={form.district}
                onChange={(event) => setForm((prev) => ({ ...prev, district: event.target.value }))}
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
          <Field label={t('admin.form.mosque')}>
            <Select
              value={form.mosque}
              onChange={(event) => setForm((prev) => ({ ...prev, mosque: event.target.value }))}
            >
              <option value="">{t('admin.form.selectMosque')}</option>
              {MOSQUE_LIST.map((mosque) => (
                <option key={mosque} value={mosque}>
                  {mosque}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          const ok = await run(
            () => managementService.deleteCircle({ role, circleId: deleting.id }),
            'supervisor.circleDeleted',
          );
          if (ok) setDeleting(null);
        }}
        title={t('supervisor.deleteCircleTitle', { name: deleting?.name ?? '' })}
        message={t('supervisor.deleteCircleConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        status={status}
      />
    </>
  );
}
