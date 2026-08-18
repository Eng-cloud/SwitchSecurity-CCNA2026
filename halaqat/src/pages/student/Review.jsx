import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as studentService from '../../services/studentService.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Tabs,
  Card,
  Badge,
  Button,
  DataState,
  Skeleton,
  Stat,
} from '../../components/ui/index.js';

/** المراجعة — سجل الجلسات مقسّمًا حسب النوع. */
export default function Review() {
  const t = useT();
  const { user } = useAuth();
  const { values, setValue } = useListState({ defaults: { type: 'all' } });

  const fetcher = useCallback(
    () => studentService.getSessions(user.studentId, { type: values.type }),
    [user.studentId, values.type],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId, values.type]);

  const tabs = [
    { value: 'all', label: t('common.all') },
    { value: 'memorization', label: t('teacher.session.types.memorization') },
    { value: 'review', label: t('teacher.session.types.review') },
    { value: 'test', label: t('teacher.session.types.test') },
  ];

  const sessions = data ?? [];
  const average =
    sessions.length > 0
      ? Math.round(sessions.reduce((sum, item) => sum + item.mastery, 0) / sessions.length)
      : 0;

  return (
    <>
      <PageHeader
        title={t('nav.review')}
        subtitle={t('student.plan.recentReview')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/student' }, { label: t('nav.review') }]}
        actions={
          <Button to="/app/student/recitation" variant="secondary">
            {t('recitation.start')}
          </Button>
        }
      />

      <div className="grid grid-3 stagger">
        <Stat label={t('reports.sessionsCount')} value={formatNumber(sessions.length)} icon="🔁" />
        <Stat label={t('reports.averageMastery')} value={formatPercent(average)} icon="📈" />
        <Stat
          label={t('student.lastPosition')}
          value={sessions[0]?.surahName ?? '—'}
          meta={sessions[0] ? formatRelative(sessions[0].createdAt, t) : undefined}
          icon="📖"
        />
      </div>

      <Tabs
        tabs={tabs}
        value={values.type}
        onChange={(value) => setValue('type', value)}
        label={t('nav.review')}
      >
        <DataState
          loading={loading}
          error={error}
          onRetry={refetch}
          isEmpty={sessions.length === 0}
          emptyTitle={t('teacher.session.noSessions')}
          emptyText={t('student.noActivity')}
          loadingFallback={<Skeleton variant="card" count={4} height={72} />}
        >
          <ul className="stack-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <Card variant="flat" className="row row-3 row-wrap">
                  <span aria-hidden="true">
                    {session.type === 'memorization' ? '📖' : session.type === 'test' ? '📝' : '🔁'}
                  </span>
                  <div className="grow">
                    <p className="t-medium">
                      {session.surahName} · {formatNumber(session.fromAyah)}–
                      {formatNumber(session.toAyah)}
                    </p>
                    <p className="t-xs t-muted">
                      {t(`teacher.session.types.${session.type}`)} ·{' '}
                      {formatRelative(session.createdAt, t)}
                    </p>
                  </div>
                  <Badge
                    variant={
                      session.mastery >= 90 ? 'success' : session.mastery >= 75 ? 'info' : 'warning'
                    }
                  >
                    {formatPercent(session.mastery)}
                  </Badge>
                </Card>
              </li>
            ))}
          </ul>
        </DataState>
      </Tabs>
    </>
  );
}
