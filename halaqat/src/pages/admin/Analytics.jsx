import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as adminService from '../../services/adminService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Stat,
  Card,
  LineChart,
  DonutChart,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** إحصائيات المنصة. */
export default function AdminAnalytics() {
  const t = useT();
  const fetcher = useCallback(() => adminService.getAnalytics(), []);
  const { data, loading, error, refetch } = useAsyncData(fetcher, []);

  return (
    <>
      <PageHeader
        title={t('admin.analyticsTitle')}
        subtitle={t('admin.analyticsSubtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/admin' }, { label: t('nav.analytics') }]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<PageSkeleton cards={2} />}
      >
        {data ? (
          <div className="stack-6">
            <div className="grid grid-2">
              <Stat
                label={t('admin.activeUsers')}
                value={formatNumber(data.activeUsers)}
                icon="👥"
              />
              <Stat
                label={t('admin.sessionsPerWeek')}
                value={formatNumber(data.sessionsPerWeek)}
                icon="🎙"
                accent
              />
            </div>

            <Card>
              <LineChart
                title={t('admin.growth')}
                data={data.growth}
                series={[
                  { key: 'activity', label: t('admin.activityChart') },
                  { key: 'tests', label: t('reports.tests') },
                ]}
              />
            </Card>

            <div className="grid grid-2">
              <Card>
                <DonutChart title={t('admin.byRole')} data={data.byRole} />
              </Card>
              <Card>
                <BarChart
                  title={t('admin.byCircle')}
                  data={data.byCircle.map((item) => ({ label: item.label, value: item.value }))}
                  series={[{ key: 'value', label: t('circles.students') }]}
                />
              </Card>
            </div>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
