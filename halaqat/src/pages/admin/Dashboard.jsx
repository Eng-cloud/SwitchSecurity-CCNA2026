import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  Button,
  BarChart,
  LineChart,
  DonutChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** لوحة الإدارة — أربعة مؤشرات ثم الرسوم الأساسية فقط. */
export default function AdminDashboard() {
  const t = useT();
  const fetcher = useCallback(() => adminService.getDashboard(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher, []);

  return (
    <>
      <PageHeader
        title={t('admin.dashboardTitle')}
        documentTitle={t('nav.dashboard')}
        actions={
          <>
            <Button to="/app/admin/reports" size="lg">
              {t('reports.title')}
            </Button>
            <Button to="/app/admin/users" variant="secondary">
              {t('admin.usersTitle')}
            </Button>
          </>
        }
      />

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
                label={t('admin.totalSupervisors')}
                value={formatNumber(data.totals.supervisors)}
                icon="🧭"
              />
              <Stat
                label={t('admin.totalCircles')}
                value={formatNumber(data.totals.circles)}
                icon="🕌"
                accent
              />
            </div>

            <div className="grid grid-2 stagger">
              <Card>
                <LineChart
                  title={t('admin.activityChart')}
                  data={data.series}
                  series={[{ key: 'activity', label: t('admin.activeUsers') }]}
                />
              </Card>
              <Card>
                <BarChart
                  title={t('admin.memorizationChart')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                  ]}
                />
              </Card>
            </div>

            <div className="grid grid-2 stagger">
              <Card>
                <DonutChart title={t('admin.byRole')} data={data.roleDistribution} />
              </Card>
              <Card>
                <BarChart
                  title={t('admin.testsChart')}
                  data={data.series}
                  series={[{ key: 'tests', label: t('reports.testsAverage') }]}
                  valueFormatter={(value) => formatPercent(value)}
                />
              </Card>
            </div>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
