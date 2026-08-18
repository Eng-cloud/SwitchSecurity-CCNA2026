import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as parentService from '../../services/parentService.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Stat,
  Badge,
  Button,
  Avatar,
  ProgressBar,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** لوحة ولي الأمر — بطاقة مختصرة لكل ابن. */
export default function ParentDashboard() {
  const t = useT();
  const { user } = useAuth();

  const fetcher = useCallback(() => parentService.getChildren(user.userId), [user.userId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId]);

  const children = data ?? [];

  return (
    <>
      <PageHeader
        title={t('parent.title')}
        documentTitle={t('nav.dashboard')}
        subtitle={t('parent.subtitle')}
        actions={
          <Button to="/app/parent/reports" variant="secondary">
            {t('reports.title')}
          </Button>
        }
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={children.length === 0}
        emptyTitle={t('parent.childrenTitle')}
        emptyText={t('parent.noChildren')}
        loadingFallback={<PageSkeleton cards={2} />}
      >
        <div className="grid grid-2">
          {children.map((child) => (
            <Card key={child.id} className="stack-4">
              <div className="row row-3">
                <Avatar name={child.name} size="lg" />
                <div className="grow">
                  <p className="t-lg t-semibold">{child.name}</p>
                  <p className="t-xs t-muted">
                    {child.circleName} · {child.teacherName}
                  </p>
                </div>
                <Badge
                  variant={
                    child.status === 'excellent'
                      ? 'success'
                      : child.status === 'atRisk'
                        ? 'danger'
                        : child.status === 'behind'
                          ? 'warning'
                          : 'info'
                  }
                >
                  {t(`teacher.status.${child.status}`)}
                </Badge>
              </div>

              <div className="grid grid-2">
                <Stat
                  label={t('student.progress.memorizedPages')}
                  value={formatNumber(child.memorizedPages)}
                  icon="📖"
                />
                <Stat
                  label={t('reports.averageMastery')}
                  value={formatPercent(child.masteryAvg)}
                  icon="📈"
                />
              </div>

              <ProgressBar
                label={t('reports.attendanceRate')}
                value={child.attendanceRate}
                variant={child.attendanceRate >= 85 ? 'success' : 'warning'}
              />

              <div className="row row-between row-wrap">
                <span className="t-xs t-muted">
                  {t('student.recitation')}: {formatRelative(child.lastRecitationAt, t)}
                </span>
                <Button size="sm" to={`/app/parent/children/${child.id}`}>
                  {t('common.details')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </DataState>
    </>
  );
}
