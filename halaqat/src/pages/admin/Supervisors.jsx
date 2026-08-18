import { useCallback, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as managementService from '../../services/managementService.js';
import { CITY_LIST } from '../../mock/db.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Select,
  Field,
  Card,
  Button,
  Badge,
  Avatar,
  Pagination,
  ConfirmDialog,
  DataState,
  Skeleton,
  Table,
} from '../../components/ui/index.js';
import UserFormModal from '../../components/management/UserFormModal.jsx';

/** قسم المشرفين — مدينة وحي، إضافة وحذف، وعرض الحلقات التي يتولاها كل مشرف. */
export default function AdminSupervisors() {
  const t = useT();
  const { role, user } = useAuth();
  const toast = useToast();
  const { values, setValue } = useListState({ defaults: { q: '', city: 'all', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const [addOpen, setAddOpen] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [status, setStatus] = useState('idle');
  const [expanded, setExpanded] = useState(null);

  const fetcher = useCallback(
    () =>
      managementService.listSupervisors({
        role,
        query: debouncedQuery,
        city: values.city,
        page: values.page,
        perPage: 6,
      }),
    [role, debouncedQuery, values.city, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    role,
    debouncedQuery,
    values.city,
    values.page,
  ]);

  const handleCreate = async (payload) => {
    setStatus('loading');
    try {
      await managementService.createUser({ role, actorId: user.userId, payload });
      toast.success(t('admin.supervisors.created'));
      setAddOpen(false);
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setStatus('idle');
    }
  };

  const handleDelete = async () => {
    setStatus('loading');
    try {
      await managementService.deleteUser({ role, userId: deleting.id });
      toast.success(t('admin.supervisors.deleted'));
      setDeleting(null);
      refetch();
    } catch (err) {
      toast.error(t(err?.messageKey ?? 'state.errorHint'));
    } finally {
      setStatus('idle');
    }
  };

  const circleColumns = [
    { key: 'name', header: t('circles.name') },
    { key: 'teacherName', header: t('circles.teacher') },
    {
      key: 'studentsCount',
      header: t('circles.students'),
      render: (row) => formatNumber(row.studentsCount),
    },
    {
      key: 'performance',
      header: t('reports.performance'),
      render: (row) => formatPercent(row.performance),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('admin.supervisors.title')}
        subtitle={t('admin.supervisors.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.supervisors') }]}
        actions={
          <Button onClick={() => setAddOpen(true)} data-testid="add-supervisor">
            {t('admin.supervisors.add')}
          </Button>
        }
      />

      <Card variant="quiet" className="row row-4 row-wrap">
        <div className="grow" style={{ minWidth: '220px' }}>
          <SearchInput
            value={values.q}
            onChange={(value) => setValue('q', value)}
            placeholder={t('common.searchPlaceholder')}
            label={t('search.label')}
          />
        </div>
        <Field label={t('admin.form.city')}>
          <Select value={values.city} onChange={(event) => setValue('city', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {CITY_LIST.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </Select>
        </Field>
      </Card>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.items?.length === 0}
        emptyTitle={t('state.emptySearchTitle')}
        emptyText={t('state.emptySearchHint')}
        loadingFallback={<Skeleton variant="card" count={4} height={120} />}
      >
        {data ? (
          <>
            <ul className="stack-3">
              {data.items.map((supervisor) => (
                <li key={supervisor.id}>
                  <Card className="stack-4">
                    <div className="row row-4 row-wrap">
                      <Avatar name={supervisor.name} size="lg" />
                      <div className="grow">
                        <p className="t-lg t-semibold">{supervisor.name}</p>
                        <p className="t-xs t-muted">
                          {supervisor.city} · {supervisor.district}
                        </p>
                        <p className="t-xs t-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
                          {supervisor.email}
                        </p>
                      </div>

                      <div className="row row-3 row-wrap">
                        <Badge variant="brand">
                          {t('supervisor.circlesCount')}: {formatNumber(supervisor.circlesCount)}
                        </Badge>
                        <Badge variant="neutral">
                          {t('supervisor.teachersCount')}: {formatNumber(supervisor.teachersCount)}
                        </Badge>
                        <Badge variant="neutral">
                          {t('supervisor.studentsCount')}: {formatNumber(supervisor.studentsCount)}
                        </Badge>
                      </div>
                    </div>

                    <div className="row row-3 row-wrap">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setExpanded(expanded === supervisor.id ? null : supervisor.id)}
                        aria-expanded={expanded === supervisor.id}
                      >
                        {expanded === supervisor.id
                          ? t('admin.supervisors.hideCircles')
                          : t('admin.supervisors.viewCircles')}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="t-danger"
                        onClick={() => setDeleting(supervisor)}
                      >
                        {t('common.delete')}
                      </Button>
                    </div>

                    {expanded === supervisor.id ? (
                      supervisor.circles.length === 0 ? (
                        <p className="t-sm t-muted">{t('admin.supervisors.noCircles')}</p>
                      ) : (
                        <Table
                          columns={circleColumns}
                          rows={supervisor.circles}
                          getRowKey={(row) => row.id}
                          caption={t('admin.supervisors.circlesOf', { name: supervisor.name })}
                        />
                      )
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>

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

      <UserFormModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleCreate}
        targetRole="supervisor"
        status={status}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t('admin.users.deleteTitle', { name: deleting?.name ?? '' })}
        message={t('admin.users.deleteConfirm')}
        confirmLabel={t('common.delete')}
        variant="danger"
        status={status}
      />
    </>
  );
}
