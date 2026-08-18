import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  Table,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';

/** التقرير العام للإدارة. */
export default function AdminReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { period: 'monthly' } });

  const fetcher = useCallback(
    () => adminService.getAdminReport({ period: values.period }),
    [values.period],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [values.period]);

  const columns = [
    { key: 'name', header: t('circles.name') },
    { key: 'teacherName', header: t('circles.teacher') },
    { key: 'supervisorName', header: t('circles.supervisor') },
    {
      key: 'studentsCount',
      header: t('circles.students'),
      render: (row) => formatNumber(row.studentsCount),
    },
    {
      key: 'attendanceRate',
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'performance',
      header: t('reports.performance'),
      render: (row) => formatPercent(row.performance),
    },
    {
      key: 'testsAverage',
      header: t('reports.testsAverage'),
      render: (row) => formatPercent(row.testsAverage),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('admin.dashboardTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('reports.title') }]}
      />

      <ReportShell
        title={t('admin.dashboardTitle')}
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
              <div className="grid grid-4 stagger">
                <Stat
                  label={t('admin.totalCircles')}
                  value={formatNumber(data.totals.circles)}
                  icon="🕌"
                />
                <Stat
                  label={t('admin.totalStudents')}
                  value={formatNumber(data.totals.students)}
                  icon="🧑‍🎓"
                />
                <Stat
                  label={t('admin.totalTeachers')}
                  value={formatNumber(data.totals.teachers)}
                  icon="🧑‍🏫"
                />
                <Stat
                  label={t('reports.performance')}
                  value={formatPercent(data.totals.performance)}
                  icon="📈"
                />
              </div>

              <Card>
                <BarChart
                  title={t('reports.trend')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                    { key: 'tests', label: t('reports.tests') },
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
