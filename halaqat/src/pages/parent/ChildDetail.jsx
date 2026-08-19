import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as parentService from '../../services/parentService.js';
import {
  formatNumber,
  formatPercent,
  formatRelative,
  formatShortDate,
} from '../../lib/format.js';
import {
  PageHeader,
  Tabs,
  Card,
  Stat,
  Badge,
  Button,
  BarChart,
  ProgressBar,
  DataState,
  PageSkeleton,
  EmptyState,
} from '../../components/ui/index.js';

/** تفاصيل تقدم الابن لولي الأمر. */
export default function ParentChildDetail() {
  const t = useT();
  const { studentId } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const { values, setValue } = useListState({ defaults: { tab: 'progress' } });

  const fetcher = useCallback(
    () => parentService.getChildDetail(user.userId, studentId),
    [user.userId, studentId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.userId, studentId]);

  const tabs = [
    { value: 'progress', label: t('teacher.profileTabs.progress') },
    { value: 'sessions', label: t('nav.sessions') },
    { value: 'notes', label: t('teacher.note.listTitle') },
    { value: 'attendance', label: t('reports.attendance') },
  ];

  return (
    <>
      <PageHeader
        title={data ? t('parent.childProgress', { name: data.name }) : t('nav.children')}
        documentTitle={data?.name}
        subtitle={data ? `${data.circleName} · ${data.teacherName}` : undefined}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/parent' },
          { label: t('nav.children'), to: '/app/parent/children' },
          { label: data?.name ?? '' },
        ]}
        actions={
          <Button variant="secondary" onClick={() => toast.info(t('parent.contactNote'))}>
            {t('parent.contactTeacher')}
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
                label={t('student.progress.memorizedPages')}
                value={formatNumber(data.memorizedPages)}
                icon="📖"
              />
              <Stat
                label={t('student.progress.memorizedJuz')}
                value={formatNumber(data.memorizedJuz)}
                icon="📚"
              />
              <Stat
                label={t('reports.averageMastery')}
                value={formatPercent(data.masteryAvg)}
                icon="📈"
              />
              <Stat
                label={t('student.streak')}
                value={t('student.streakDays', { count: formatNumber(data.streak) })}
                icon="🔥"
                accent
              />
            </div>

            <Tabs
              tabs={tabs}
              value={values.tab}
              onChange={(tab) => setValue('tab', tab)}
              label={t('nav.children')}
            >
              {values.tab === 'progress' ? (
                <Card>
                  <BarChart
                    title={t('parent.weeklySummary')}
                    data={data.series}
                    series={[
                      { key: 'memorization', label: t('reports.memorization') },
                      { key: 'review', label: t('reports.review') },
                    ]}
                  />
                </Card>
              ) : null}

              {values.tab === 'sessions' ? (
                data.sessions.length === 0 ? (
                  <EmptyState icon="🎙" text={t('teacher.session.noSessions')} />
                ) : (
                  <ul className="stack-2">
                    {data.sessions.map((session) => (
                      <li key={session.id}>
                        <Card variant="flat" className="row row-3 row-wrap">
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
                          <Badge variant={session.mastery >= 90 ? 'success' : 'info'}>
                            {formatPercent(session.mastery)}
                          </Badge>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {values.tab === 'notes' ? (
                data.notes.length === 0 ? (
                  <EmptyState icon="📝" text={t('teacher.note.none')} />
                ) : (
                  <ul className="stack-3">
                    {data.notes.map((note) => (
                      <li key={note.id}>
                        <Card variant="flat" className="stack-2">
                          <div className="row row-between row-wrap">
                            <Badge
                              variant={
                                note.type === 'praise'
                                  ? 'success'
                                  : note.type === 'absence'
                                    ? 'danger'
                                    : 'info'
                              }
                            >
                              {t(`teacher.note.types.${note.type}`)}
                            </Badge>
                            <span className="t-xs t-muted">
                              {formatRelative(note.createdAt, t)}
                            </span>
                          </div>
                          <p>{note.text}</p>
                        </Card>
                      </li>
                    ))}
                  </ul>
                )
              ) : null}

              {values.tab === 'attendance' ? (
                <Card className="stack-4">
                  <ProgressBar
                    label={t('reports.attendanceRate')}
                    value={data.attendanceRate}
                    variant={data.attendanceRate >= 85 ? 'success' : 'warning'}
                  />
                  <div className="attendance-grid">
                    {data.attendance.map((row) => (
                      <span key={row.id} className={`attendance-day attendance-day--${row.status}`}>
                        <span className="visually-hidden">
                          {formatShortDate(row.date)} — {t(`teacher.attendanceStatus.${row.status}`)}
                        </span>
                        <span aria-hidden="true">
                          {row.status === 'present' ? '✓' : row.status === 'absent' ? '✕' : '○'}
                        </span>
                      </span>
                    ))}
                  </div>
                </Card>
              ) : null}
            </Tabs>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
