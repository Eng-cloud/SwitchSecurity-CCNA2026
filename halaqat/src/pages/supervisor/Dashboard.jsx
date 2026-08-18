import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as supervisorService from '../../services/supervisorService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Stat,
  Card,
  Button,
  Badge,
  DonutChart,
  LineChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** لوحة المشرف — نظرة عامة ثم الحالات التي تحتاج متابعة. */
export default function SupervisorDashboard() {
  const t = useT();
  const { user } = useAuth();

  const fetcher = useCallback(() => supervisorService.getDashboard(user.userId), [user.userId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId]);

  return (
    <>
      <PageHeader
        title={t('supervisor.dashboardTitle')}
        documentTitle={t('nav.dashboard')}
        actions={
          <Button to="/app/supervisor/circles" size="lg">
            {t('supervisor.circlesTitle')}
          </Button>
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
                label={t('supervisor.circlesCount')}
                value={formatNumber(data.circlesCount)}
                icon="🕌"
                href="/app/supervisor/circles"
                linkLabel={t('common.details')}
              />
              <Stat
                label={t('supervisor.teachersCount')}
                value={formatNumber(data.teachersCount)}
                icon="🧑‍🏫"
                href="/app/supervisor/teachers"
                linkLabel={t('common.details')}
              />
              <Stat
                label={t('supervisor.studentsCount')}
                value={formatNumber(data.studentsCount)}
                icon="🧑‍🎓"
              />
              <Stat
                label={t('supervisor.averagePerformance')}
                value={formatPercent(data.performance)}
                icon="📈"
                accent
              />
            </div>

            <Section
              title={t('supervisor.needsAttention')}
              id="attention"
              actions={
                <Link to="/app/supervisor/reports" className="t-sm">
                  {t('reports.title')} ←
                </Link>
              }
            >
              {data.attention.length === 0 ? (
                <Card variant="quiet" className="t-center t-muted">
                  {t('supervisor.attentionEmpty')}
                </Card>
              ) : (
                <ul className="stack-2">
                  {data.attention.map((item) => (
                    <li key={item.id}>
                      <Card variant="flat" className="row row-3 row-wrap">
                        <div className="grow">
                          <p className="t-medium">{item.name}</p>
                          <p className="t-xs t-muted">{item.circleName}</p>
                        </div>
                        <Badge variant="warning">
                          {t(`supervisor.attentionReason.${item.reason}`)}
                        </Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          to={`/app/supervisor/students/${item.id}`}
                        >
                          {t('teacher.viewStudent')}
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <div className="grid grid-2 stagger">
              <Card>
                <LineChart
                  title={t('reports.trend')}
                  data={data.series}
                  series={[
                    { key: 'memorization', label: t('reports.memorization') },
                    { key: 'review', label: t('reports.review') },
                  ]}
                />
              </Card>
              <Card>
                <DonutChart title={t('admin.byCircle')} data={data.distribution} />
              </Card>
            </div>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
