import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as parentService from '../../services/parentService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Table,
  Card,
  Stat,
  DataState,
  PageSkeleton,
  BarChart,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';

/** تقرير موحّد عن كل الأبناء. */
export default function ParentReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { period: 'monthly' } });

  const fetcher = useCallback(() => parentService.getChildren(user.userId), [user.userId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId]);

  const children = data ?? [];

  const columns = [
    { key: 'name', header: t('teacher.tableStudent') },
    { key: 'circleName', header: t('parent.circleLabel') },
    {
      key: 'memorizedPages',
      header: t('reports.pagesMemorized'),
      render: (row) => formatNumber(row.memorizedPages),
    },
    {
      key: 'attendanceRate',
      header: t('reports.attendanceRate'),
      render: (row) => formatPercent(row.attendanceRate),
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
  ];

  const chartData = children.map((child) => ({
    label: child.name.split(' ')[0],
    mastery: child.masteryAvg,
    attendance: child.attendanceRate,
  }));

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('parent.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/parent' }, { label: t('reports.title') }]}
      />

      <ReportShell
        title={t('parent.title')}
        period={values.period}
        onPeriodChange={(period) => setValue('period', period)}
        preparedBy={user.name}
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={children.length === 0}
          emptyText={t('parent.noChildren')}
          loadingFallback={<PageSkeleton cards={2} />}
        >
          <div className="stack-6">
            <div className="grid grid-3 stagger">
              <Stat label={t('parent.childrenTitle')} value={formatNumber(children.length)} icon="🧑‍🎓" />
              <Stat
                label={t('reports.averageMastery')}
                value={formatPercent(
                  Math.round(
                    children.reduce((sum, child) => sum + child.masteryAvg, 0) /
                      (children.length || 1),
                  ),
                )}
                icon="📈"
              />
              <Stat
                label={t('reports.attendanceRate')}
                value={formatPercent(
                  Math.round(
                    children.reduce((sum, child) => sum + child.attendanceRate, 0) /
                      (children.length || 1),
                  ),
                )}
                icon="✓"
              />
            </div>

            <Card>
              <BarChart
                title={t('reports.performance')}
                data={chartData}
                series={[
                  { key: 'mastery', label: t('reports.averageMastery') },
                  { key: 'attendance', label: t('reports.attendanceRate') },
                ]}
                valueFormatter={(value) => formatPercent(value)}
              />
            </Card>

            <Table
              columns={columns}
              rows={children}
              getRowKey={(row) => row.id}
              caption={t('reports.title')}
              emptyMessage={t('reports.noData')}
            />
          </div>
        </DataState>
      </ReportShell>
    </>
  );
}
