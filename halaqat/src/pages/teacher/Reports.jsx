import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as teacherService from '../../services/teacherService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  Table,
  BarChart,
  Badge,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';

/** تقرير الحلقة للمعلم — قابل للطباعة. */
export default function TeacherReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { period: 'weekly' } });

  const fetcher = useCallback(
    () => teacherService.getCircleReport(user.circleId, { period: values.period }),
    [user.circleId, values.period],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.circleId, values.period]);

  const columns = [
    { key: 'name', header: t('teacher.tableStudent') },
    {
      key: 'attendanceRate',
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'memorizedPages',
      header: t('reports.pagesMemorized'),
      render: (row) => formatNumber(row.memorizedPages),
    },
    {
      key: 'masteryAvg',
      header: t('reports.averageMastery'),
      render: (row) => formatPercent(row.masteryAvg),
    },
    {
      key: 'testsAvg',
      header: t('reports.testsAverage'),
      render: (row) => formatPercent(row.testsAvg),
    },
    {
      key: 'status',
      header: t('teacher.tableStatus'),
      render: (row) => (
        <Badge
          variant={
            row.status === 'excellent'
              ? 'success'
              : row.status === 'atRisk'
                ? 'danger'
                : row.status === 'behind'
                  ? 'warning'
                  : 'info'
          }
        >
          {t(`teacher.status.${row.status}`)}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={data?.circle?.name}
        breadcrumb={[{ label: t('nav.home'), to: '/app/teacher' }, { label: t('reports.title') }]}
      />

      <ReportShell
        title={t('nav.circle')}
        period={values.period}
        onPeriodChange={(period) => setValue('period', period)}
        preparedBy={user.name}
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={false}
          loadingFallback={<PageSkeleton />}
        >
          {data ? (
            <div className="stack-6">
              <div className="grid grid-4">
                <Stat
                  label={t('teacher.circleStudents')}
                  value={formatNumber(data.studentsCount)}
                  icon="👥"
                />
                <Stat
                  label={t('reports.attendanceRate')}
                  value={formatPercent(data.attendanceRate)}
                  icon="✓"
                />
                <Stat
                  label={t('reports.averageMastery')}
                  value={formatPercent(data.averageMastery)}
                  icon="📈"
                />
                <Stat
                  label={t('reports.testsAverage')}
                  value={formatPercent(data.testsAverage)}
                  icon="📝"
                />
              </div>

              <Card>
                <BarChart
                  title={t('reports.trend')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                  ]}
                />
              </Card>

              <Table
                columns={columns}
                rows={data.rows}
                getRowKey={(row) => row.id}
                caption={t('reports.title')}
                emptyMessage={t('reports.noData')}
              />
            </div>
          ) : null}
        </DataState>
      </ReportShell>
    </>
  );
}
