import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Table,
  Pagination,
  Badge,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

/** كل الحلقات في المنصة. */
export default function AdminCircles() {
  const t = useT();
  const { values, setValue } = useListState({ defaults: { q: '', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const fetcher = useCallback(
    () => adminService.getCircles({ query: debouncedQuery, page: values.page, perPage: 8 }),
    [debouncedQuery, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [debouncedQuery, values.page]);

  const columns = [
    { key: 'name', header: t('circles.name') },
    { key: 'teacherName', header: t('circles.teacher') },
    { key: 'supervisorName', header: t('circles.supervisor') },
    {
      key: 'level',
      header: t('circles.level'),
      render: (row) => <Badge variant="neutral">{t(`circles.levels.${row.level}`)}</Badge>,
    },
    { key: 'schedule', header: t('circles.schedule') },
    {
      key: 'studentsCount',
      header: t('circles.students'),
      render: (row) => formatNumber(row.studentsCount),
    },
    {
      key: 'performance',
      header: t('reports.performance'),
      render: (row) => (
        <Badge variant={row.performance >= 85 ? 'success' : row.performance >= 70 ? 'info' : 'warning'}>
          {formatPercent(row.performance)}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('circles.title')}
        subtitle={t('circles.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.circles') }]}
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
        loadingFallback={<Skeleton variant="card" count={5} height={56} />}
      >
        {data ? (
          <>
            <Table
              columns={columns}
              rows={data.items}
              getRowKey={(row) => row.id}
              caption={t('circles.title')}
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
