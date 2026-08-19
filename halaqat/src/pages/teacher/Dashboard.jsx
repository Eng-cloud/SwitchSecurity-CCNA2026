import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as teacherService from '../../services/teacherService.js';
import CoveragePanel from '../../components/coverage/CoveragePanel.jsx';
import DeputyInbox from '../../components/coverage/DeputyInbox.jsx';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Stat,
  Card,
  Button,
  Badge,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** لوحة المعلم — أرقام اليوم أولًا ثم من يحتاج متابعة. */
export default function TeacherDashboard() {
  const t = useT();
  const { user } = useAuth();

  const fetcher = useCallback(() => teacherService.getDashboard(user.userId), [user.userId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId]);

  return (
    <>
      <PageHeader
        title={t('teacher.dashboardTitle')}
        documentTitle={t('nav.dashboard')}
        subtitle={data?.circle?.name}
        actions={
          <>
            <Button to="/app/teacher/circle" size="lg">
              {t('teacher.openCircle')}
            </Button>
            <Button to="/app/teacher/sessions" variant="secondary">
              {t('teacher.session.start')}
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
            {/* أول ما يُسأل عنه المعلم صباحًا: هل أنت حاضر؟ ومن ينوب عنك إن لم تكن؟ */}
            <DeputyInbox onChange={refetch} />
            {data.circle?.id ? (
              <CoveragePanel circleId={data.circle.id} onChange={refetch} />
            ) : null}

            <div className="grid grid-4 stagger">
              <Stat
                label={t('teacher.circleStudents')}
                value={formatNumber(data.studentsCount)}
                icon="👥"
                href="/app/teacher/students"
                linkLabel={t('common.details')}
              />
              <Stat
                label={t('teacher.present')}
                value={formatNumber(data.presentCount)}
                meta={`${t('teacher.absent')}: ${formatNumber(data.absentCount)}`}
                icon="✓"
              />
              <Stat
                label={t('teacher.todaySessions')}
                value={formatNumber(data.todaySessionsCount)}
                icon="🎙"
              />
              <Stat
                label={t('teacher.needsFollowUp')}
                value={formatNumber(data.needsFollowUpCount)}
                icon="!"
                accent={data.needsFollowUpCount > 0}
              />
            </div>

            <Section
              title={t('teacher.needsFollowUp')}
              id="follow-up"
              actions={
                <Link to="/app/teacher/students" className="t-sm">
                  {t('common.seeAll')} ←
                </Link>
              }
            >
              {data.needsFollowUp.length === 0 ? (
                <Card variant="quiet" className="t-center t-muted">
                  {t('supervisor.attentionEmpty')}
                </Card>
              ) : (
                <ul className="stack-2">
                  {data.needsFollowUp.map((student) => (
                    <li key={student.id}>
                      <Card variant="flat" className="row row-3 row-wrap">
                        <div className="grow">
                          <p className="t-medium">{student.name}</p>
                          <p className="t-xs t-muted">
                            {t('reports.attendanceRate')}: {formatPercent(student.attendanceRate)} ·{' '}
                            {t('reports.averageMastery')}: {formatPercent(student.masteryAvg)}
                          </p>
                        </div>
                        <Badge variant="warning">{t(`teacher.status.${student.status}`)}</Badge>
                        <Button
                          size="sm"
                          variant="secondary"
                          to={`/app/teacher/students/${student.id}`}
                        >
                          {t('teacher.viewStudent')}
                        </Button>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Card>
              <BarChart
                title={t('reports.performance')}
                data={data.weeklySeries}
                series={[
                  { key: 'memorization', label: t('reports.memorization') },
                  { key: 'review', label: t('reports.review') },
                ]}
              />
            </Card>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
