import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as supervisorService from '../../services/supervisorService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Button,
  Stat,
  Card,
  Table,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';
import { exportColumns } from '../../lib/export.js';

/** تقرير المشرف عن كل الحلقات التابعة — مع معاينة الطباعة. */
export default function SupervisorReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { period: 'monthly' } });

  const fetcher = useCallback(
    () => supervisorService.getSupervisorReport(user.userId, { period: values.period }),
    [user.userId, values.period],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId, values.period]);

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
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
    },
    {
      key: 'performance',
      header: t('supervisor.tablePerformance'),
      render: (row) => formatPercent(row.performance),
    },
    {
      key: 'atRisk',
      header: t('supervisor.needsAttention'),
      render: (row) => formatNumber(row.atRisk),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('supervisor.circlesTitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/supervisor' }, { label: t('reports.title') }]}
        actions={
          <Button variant="secondary" to="/app/supervisor/reports/coverage">
            {t('coverage.openReport')}
          </Button>
        }
      />

      <ReportShell
        title={t('supervisor.dashboardTitle')}
        period={values.period}
        onPeriodChange={(period) => setValue('period', period)}
        preparedBy={user.name}
        exportData={{
          filename: `halaqat-supervisor-${values.period}`,
          title: t('supervisor.dashboardTitle'),
          meta: t(`reports.${values.period}`),
          columns: exportColumns(columns),
          rows: data?.rows ?? [],
        }}
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
                  label={t('supervisor.circlesCount')}
                  value={formatNumber(data.totals.circles)}
                  icon="🕌"
                />
                <Stat
                  label={t('supervisor.studentsCount')}
                  value={formatNumber(data.totals.students)}
                  icon="🧑‍🎓"
                />
                <Stat
                  label={t('reports.attendanceRate')}
                  value={formatPercent(data.totals.attendanceRate)}
                  icon="✓"
                />
                <Stat
                  label={t('supervisor.averagePerformance')}
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
