import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as studentService from '../../services/studentService.js';
import { formatNumber, formatPercent, formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Tabs,
  Stat,
  Card,
  Table,
  BarChart,
  LineChart,
  ProgressBar,
  DataState,
  PageSkeleton,
  Badge,
} from '../../components/ui/index.js';
import ReportShell from '../../components/reports/ReportShell.jsx';

/** تقارير الطالب — تبويبات حسب المحور مع معاينة طباعة. */
export default function StudentReports() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { tab: 'memorization', period: 'weekly' } });

  const fetcher = useCallback(
    () => studentService.getStudentReport(user.studentId, { period: values.period }),
    [user.studentId, values.period],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId, values.period]);

  const tabs = [
    { value: 'memorization', label: t('reports.memorization') },
    { value: 'review', label: t('reports.review') },
    { value: 'recitation', label: t('reports.recitation') },
    { value: 'tests', label: t('reports.tests') },
    { value: 'commitment', label: t('reports.commitment') },
  ];

  const columns = [
    { key: 'date', header: t('reports.period'), render: (row) => formatShortDate(row.date) },
    {
      key: 'type',
      header: t('teacher.session.typeLabel'),
      render: (row) => t(`teacher.session.types.${row.type}`),
    },
    { key: 'surahName', header: t('recitation.surah') },
    { key: 'range', header: t('common.ayat') },
    {
      key: 'mastery',
      header: t('reports.averageMastery'),
      render: (row) => (
        <Badge variant={row.mastery >= 90 ? 'success' : row.mastery >= 75 ? 'info' : 'warning'}>
          {formatPercent(row.mastery)}
        </Badge>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={t('reports.title')}
        subtitle={t('reports.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/student' }, { label: t('reports.title') }]}
      />

      <ReportShell
        title={t('reports.title')}
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
                  label={t('reports.pagesMemorized')}
                  value={formatNumber(data.pagesMemorized)}
                  icon="📖"
                />
                <Stat
                  label={t('reports.sessionsCount')}
                  value={formatNumber(data.sessionsCount)}
                  icon="🎙"
                />
                <Stat
                  label={t('reports.averageMastery')}
                  value={formatPercent(data.averageMastery)}
                  icon="📈"
                />
                <Stat
                  label={t('reports.attendanceRate')}
                  value={formatPercent(data.attendanceRate)}
                  icon="✓"
                />
              </div>

              <Tabs
                tabs={tabs}
                value={values.tab}
                onChange={(tab) => setValue('tab', tab)}
                label={t('reports.title')}
              >
                {values.tab === 'memorization' || values.tab === 'review' ? (
                  <Card>
                    <BarChart
                      title={
                        values.tab === 'memorization' ? t('reports.memorization') : t('reports.review')
                      }
                      data={data.series}
                      series={[
                        {
                          key: values.tab === 'memorization' ? 'memorization' : 'review',
                          label:
                            values.tab === 'memorization'
                              ? t('reports.pagesMemorized')
                              : t('reports.pagesReviewed'),
                        },
                      ]}
                    />
                  </Card>
                ) : null}

                {values.tab === 'recitation' ? (
                  <Table
                    columns={columns}
                    rows={data.rows}
                    getRowKey={(row) => row.id}
                    caption={t('reports.recitation')}
                    emptyMessage={t('reports.noData')}
                  />
                ) : null}

                {values.tab === 'tests' ? (
                  <Card>
                    <LineChart
                      title={t('reports.tests')}
                      data={data.series}
                      series={[{ key: 'tests', label: t('reports.testsAverage') }]}
                      valueFormatter={(value) => formatPercent(value)}
                    />
                  </Card>
                ) : null}

                {values.tab === 'commitment' ? (
                  <Card className="stack-4">
                    <ProgressBar
                      label={t('reports.attendanceRate')}
                      value={data.attendanceRate}
                      variant={data.attendanceRate >= 85 ? 'success' : 'warning'}
                    />
                    <ProgressBar
                      label={t('reports.testsAverage')}
                      value={data.testsAverage}
                      variant="brand"
                    />
                    <ProgressBar
                      label={t('reports.averageMastery')}
                      value={data.averageMastery}
                      variant="gold"
                    />
                  </Card>
                ) : null}
              </Tabs>
            </div>
          ) : null}
        </DataState>
      </ReportShell>
    </>
  );
}
