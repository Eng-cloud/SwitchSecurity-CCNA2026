import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as adminService from '../../services/adminService.js';
import { formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Select,
  Field,
  Card,
  Table,
  Pagination,
  Badge,
  Button,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

const ROLES = ['student', 'teacher', 'supervisor', 'admin', 'parent'];
const STATUSES = ['active', 'inactive', 'pending'];

/** إدارة المستخدمين مع تصفية حسب الدور والحالة. */
export default function AdminUsers() {
  const t = useT();
  const { values, setValue, resetAll, isFiltered } = useListState({
    defaults: { q: '', role: 'all', status: 'all', page: 1 },
  });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const fetcher = useCallback(
    () =>
      adminService.getUsers({
        query: debouncedQuery,
        role: values.role,
        status: values.status,
        page: values.page,
        perPage: 10,
      }),
    [debouncedQuery, values.role, values.status, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    debouncedQuery,
    values.role,
    values.status,
    values.page,
  ]);

  const columns = [
    { key: 'name', header: t('admin.tableName') },
    {
      key: 'role',
      header: t('admin.tableRole'),
      render: (row) => <Badge variant="neutral">{t(`roles.${row.role}`)}</Badge>,
    },
    {
      key: 'circleName',
      header: t('admin.tableCircle'),
      render: (row) => row.circleName || '—',
    },
    {
      key: 'status',
      header: t('admin.tableStatus'),
      render: (row) => (
        <Badge
          variant={row.status === 'active' ? 'success' : row.status === 'pending' ? 'warning' : 'neutral'}
        >
          {t(`admin.userStatus.${row.status}`)}
        </Badge>
      ),
    },
    {
      key: 'joinedAt',
      header: t('admin.tableJoined'),
      render: (row) => formatShortDate(row.joinedAt),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('admin.usersTitle')}
        subtitle={t('admin.usersSubtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.users') }]}
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

        <Field label={t('admin.tableRole')}>
          <Select value={values.role} onChange={(event) => setValue('role', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {t(`roles.${role}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t('admin.tableStatus')}>
          <Select value={values.status} onChange={(event) => setValue('status', event.target.value)}>
            <option value="all">{t('common.all')}</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {t(`admin.userStatus.${status}`)}
              </option>
            ))}
          </Select>
        </Field>

        {isFiltered ? (
          <Button variant="ghost" onClick={resetAll}>
            {t('common.reset')}
          </Button>
        ) : null}
      </Card>

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={data?.items?.length === 0}
        emptyTitle={t('state.emptySearchTitle')}
        emptyText={t('state.emptySearchHint')}
        emptyAction={
          isFiltered ? (
            <Button variant="secondary" onClick={resetAll}>
              {t('common.reset')}
            </Button>
          ) : null
        }
        loadingFallback={<Skeleton variant="card" count={6} height={52} />}
      >
        {data ? (
          <>
            <Table
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              caption={t('admin.usersTitle')}
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
    </>
  );
}
