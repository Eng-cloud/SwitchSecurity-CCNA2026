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
  Card,
  Avatar,
  Badge,
  Button,
  ProgressBar,
  Pagination,
  DataState,
  Skeleton,
} from '../../components/ui/index.js';

/** معلمو الحلقات التابعة للمشرف. */
export default function SupervisorTeachers() {
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

  return (
    <>
      <PageHeader
        title={t('nav.teachers')}
        subtitle={t('supervisor.circlesTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/supervisor' }, { label: t('nav.teachers') }]}
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
        loadingFallback={
          <div className="grid grid-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} variant="card" height={170} />
            ))}
          </div>
        }
      >
        {data ? (
          <>
            <ul className="grid grid-3">
              {data.items.map((circle) => (
                <li key={circle.id}>
                  <Card className="stack-3">
                    <div className="row row-3">
                      <Avatar name={circle.teacherName} />
                      <div className="grow">
                        <p className="t-medium">{circle.teacherName}</p>
                        <p className="t-xs t-muted">{circle.name}</p>
                      </div>
                      <Badge variant="neutral">{t(`circles.levels.${circle.level}`)}</Badge>
                    </div>

                    <ProgressBar
                      label={t('supervisor.tablePerformance')}
                      value={circle.performance}
                      variant={circle.performance >= 85 ? 'success' : 'brand'}
                    />

                    <div className="row row-between t-xs t-muted">
                      <span>
                        {t('supervisor.tableStudents')}: {formatNumber(circle.studentsCount)}
                      </span>
                      <span>
                        {t('reports.attendanceRate')}: {formatPercent(circle.attendanceRate)}
                      </span>
                    </div>

                    <Button variant="secondary" size="sm" to={`/app/supervisor/circles/${circle.id}`}>
                      {t('supervisor.openCircle')}
                    </Button>
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
    </>
  );
}
