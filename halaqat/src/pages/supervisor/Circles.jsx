import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as supervisorService from '../../services/supervisorService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Table,
  Pagination,
  Button,
  Badge,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

/** قائمة الحلقات التابعة للمشرف. */
export default function SupervisorCircles() {
  const t = useT();
  const { user } = useAuth();
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
        <Button size="sm" variant="secondary" to={`/app/supervisor/circles/${row.id}`}>
          {t('supervisor.openCircle')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('supervisor.circlesTitle')}
        subtitle={t('circles.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/supervisor' }, { label: t('nav.circles') }]}
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
    </>
  );
}
