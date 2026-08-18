import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useDebouncedValue from '../../hooks/useDebouncedValue.js';
import * as teacherService from '../../services/teacherService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  SearchInput,
  Card,
  Badge,
  Avatar,
  Pagination,
  ProgressBar,
  DataState,
  Skeleton,
  Button,
} from '../../components/ui/index.js';

const STATUS_VARIANT = {
  excellent: 'success',
  onTrack: 'info',
  behind: 'warning',
  atRisk: 'danger',
};

/** قائمة الطلاب كبطاقات — أنسب للتصفح السريع على الجوال. */
export default function TeacherStudents() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { q: '', page: 1 } });
  const debouncedQuery = useDebouncedValue(values.q, 300);

  const fetcher = useCallback(
    () =>
      teacherService.getCircleStudents(user.circleId, {
        query: debouncedQuery,
        page: values.page,
        perPage: 9,
      }),
    [user.circleId, debouncedQuery, values.page],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [
    user.circleId,
    debouncedQuery,
    values.page,
  ]);

  return (
    <>
      <PageHeader
        title={t('nav.students')}
        subtitle={t('teacher.circleStudents')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/teacher' }, { label: t('nav.students') }]}
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
        emptyAction={
          values.q ? (
            <Button variant="secondary" onClick={() => setValue('q', '')}>
              {t('common.clear')}
            </Button>
          ) : null
        }
        loadingFallback={
          <div className="grid grid-3">
            {Array.from({ length: 6 }, (_, index) => (
              <Skeleton key={index} variant="card" height={150} />
            ))}
          </div>
        }
      >
        {data ? (
          <>
            <ul className="grid grid-3">
              {data.items.map((student) => (
                <li key={student.id}>
                  <Card className="stack-3">
                    <div className="row row-3">
                      <Avatar name={student.name} />
                      <div className="grow">
                        <Link
                          to={`/app/teacher/students/${student.id}`}
                          className="t-medium"
                          style={{ textDecoration: 'none' }}
                        >
                          {student.name}
                        </Link>
                        <p className="t-xs t-muted">
                          {formatNumber(student.memorizedPages)} {t('common.pages')}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[student.status]}>
                        {t(`teacher.status.${student.status}`)}
                      </Badge>
                    </div>

                    <ProgressBar
                      label={t('reports.averageMastery')}
                      value={student.masteryAvg}
                      variant={student.masteryAvg >= 85 ? 'success' : 'brand'}
                    />

                    <div className="row row-between t-xs t-muted">
                      <span>
                        {t('reports.attendanceRate')}: {formatPercent(student.attendanceRate)}
                      </span>
                      <Link to={`/app/teacher/students/${student.id}`}>{t('common.details')} ←</Link>
                    </div>
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
