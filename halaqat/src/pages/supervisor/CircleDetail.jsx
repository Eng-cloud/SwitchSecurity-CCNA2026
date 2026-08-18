import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as supervisorService from '../../services/supervisorService.js';
import { formatNumber, formatPercent, formatShortDate } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Stat,
  Table,
  Badge,
  Button,
  Avatar,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** تفاصيل الحلقة للمشرف: المعلم + الطلاب + الأداء. */
export default function SupervisorCircleDetail() {
  const t = useT();
  const { circleId } = useParams();

  const fetcher = useCallback(() => supervisorService.getCircleDetail(circleId), [circleId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [circleId]);

  const columns = [
    { key: 'name', header: t('teacher.tableStudent') },
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
    {
      key: 'actions',
      header: t('teacher.tableActions'),
      render: (row) => (
        <Button size="sm" variant="secondary" to={`/app/supervisor/students/${row.id}`}>
          {t('teacher.viewStudent')}
        </Button>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title={data?.name ?? t('nav.circle')}
        documentTitle={data?.name}
        subtitle={data ? `${data.schedule} · ${data.location}` : undefined}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/supervisor' },
          { label: t('nav.circles'), to: '/app/supervisor/circles' },
          { label: data?.name ?? '' },
        ]}
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
                label={t('supervisor.tableStudents')}
                value={formatNumber(data.studentsCount)}
                icon="👥"
              />
              <Stat
                label={t('reports.attendanceRate')}
                value={formatPercent(data.attendanceRate)}
                icon="✓"
              />
              <Stat
                label={t('supervisor.tablePerformance')}
                value={formatPercent(data.performance)}
                icon="📈"
              />
              <Stat
                label={t('supervisor.needsAttention')}
                value={formatNumber(data.atRisk)}
                icon="!"
              />
            </div>

            {data.teacher ? (
              <Card className="row row-4 row-wrap">
                <Avatar name={data.teacher.name} size="lg" />
                <div className="grow">
                  <p className="t-sm t-muted">{t('supervisor.teacherProfile')}</p>
                  <p className="t-lg t-semibold">{data.teacher.name}</p>
                  <p className="t-xs t-muted" style={{ direction: 'ltr', textAlign: 'start' }}>
                    {data.teacher.email} · {data.teacher.phone}
                  </p>
                </div>
                <div className="t-sm t-muted">
                  {t('teacher.studentInfo.joined')}: {formatShortDate(data.teacher.joinedAt)}
                </div>
              </Card>
            ) : null}

            <Card>
              <BarChart
                title={t('supervisor.circleOverview')}
                data={data.series}
                series={[
                  { key: 'memorization', label: t('reports.memorization') },
                  { key: 'review', label: t('reports.review') },
                ]}
              />
            </Card>

            <Table
              columns={columns}
              rows={data.students}
              getRowKey={(row) => row.id}
              caption={t('nav.students')}
            />
          </div>
        ) : null}
      </DataState>
    </>
  );
}
