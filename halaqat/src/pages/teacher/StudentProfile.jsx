import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import useGoBack from '../../hooks/useGoBack.js';
import * as teacherService from '../../services/teacherService.js';
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
  Avatar,
  Table,
  ProgressBar,
  BarChart,
  DataState,
  PageSkeleton,
  EmptyState,
} from '../../components/ui/index.js';
import AddNoteModal from '../../components/teacher/AddNoteModal.jsx';

const STATUS_VARIANT = {
  excellent: 'success',
  onTrack: 'info',
  behind: 'warning',
  atRisk: 'danger',
};

/** ملف الطالب — يُستخدم للمعلم والمشرف والإدارة بنفس البيانات. */
export default function StudentProfile() {
  const t = useT();
  const { studentId } = useParams();
  const { role } = useAuth();
  const [noteOpen, setNoteOpen] = useState(false);
  const { values, setValue } = useListState({ defaults: { tab: 'info' } });

  const fetcher = useCallback(() => teacherService.getStudentProfile(studentId), [studentId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [studentId]);

  const tabs = [
    { value: 'info', label: t('teacher.profileTabs.info') },
    { value: 'progress', label: t('teacher.profileTabs.progress') },
    { value: 'recitation', label: t('teacher.profileTabs.recitation') },
    { value: 'notes', label: t('teacher.note.listTitle') },
    { value: 'attendance', label: t('reports.attendance') },
  ];

  const sessionColumns = [
    { key: 'date', header: t('reports.period'), render: (row) => formatShortDate(row.createdAt) },
    {
      key: 'type',
      header: t('teacher.session.typeLabel'),
      render: (row) => t(`teacher.session.types.${row.type}`),
    },
    { key: 'surahName', header: t('recitation.surah') },
    {
      key: 'range',
      header: t('common.ayat'),
      render: (row) => `${formatNumber(row.fromAyah)}–${formatNumber(row.toAyah)}`,
    },
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

  // البديل حين يُفتح الرابط مباشرةً: قائمة الطلاب للمعلم، والحلقات لغيره.
  const fallback = role === 'teacher' ? '/app/teacher/students' : `/app/${role}/circles`;
  const goBack = useGoBack(fallback);

  return (
    <>
      <PageHeader
        title={data?.name ?? t('nav.students')}
        documentTitle={data?.name}
        subtitle={data ? `${data.circleName} · ${data.teacherName}` : undefined}
        breadcrumb={[
          { label: t('nav.home'), to: `/app/${role}` },
          ...(role === 'teacher'
            ? [{ label: t('nav.students'), to: '/app/teacher/students' }]
            : [{ label: t('nav.circles'), to: `/app/${role}/circles` }]),
          { label: data?.name ?? '' },
        ]}
        actions={
          <>
            <Button variant="ghost" onClick={goBack}>
              {t('common.back')}
            </Button>
            {role === 'teacher' ? (
              <Button onClick={() => setNoteOpen(true)} data-testid="open-note">
                {t('teacher.addNote')}
              </Button>
            ) : null}
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
            <Card className="profile-hero">
              <Avatar name={data.name} size="xl" />
              <div className="grow stack-2">
                <h2 className="t-xl t-semibold">{data.name}</h2>
                <div className="row row-2 row-wrap">
                  <Badge variant={STATUS_VARIANT[data.status]}>
                    {t(`teacher.status.${data.status}`)}
                  </Badge>
                  <Badge variant="neutral">{t(`circles.levels.${data.level}`)}</Badge>
                  <span className="t-sm t-muted">
                    {t('teacher.studentInfo.years', { count: formatNumber(data.age) })}
                  </span>
                </div>
              </div>
              <div className="grid grid-2 stagger" style={{ minWidth: '260px' }}>
                <Stat
                  label={t('reports.averageMastery')}
                  value={formatPercent(data.masteryAvg)}
                  icon="📈"
                />
                <Stat
                  label={t('reports.attendanceRate')}
                  value={formatPercent(data.attendanceRate)}
                  icon="✓"
                />
              </div>
            </Card>

            <Tabs
              tabs={tabs}
              value={values.tab}
              onChange={(tab) => setValue('tab', tab)}
              label={t('nav.students')}
            >
              {values.tab === 'info' ? (
                <Card>
                  <dl className="info-list">
                    {[
                      { label: t('teacher.studentInfo.circle'), value: data.circleName },
                      { label: t('roles.teacher'), value: data.teacherName },
                      { label: t('teacher.studentInfo.guardian'), value: data.guardianName },
                      { label: t('teacher.studentInfo.phone'), value: data.guardianPhone },
                      { label: t('teacher.studentInfo.joined'), value: formatShortDate(data.joinedAt) },
                      { label: t('settings.accountCity'), value: data.city },
                    ].map((item) => (
                      <div className="info-list__item" key={item.label}>
                        <dt className="info-list__label">{item.label}</dt>
                        <dd className="info-list__value">{item.value}</dd>
                      </div>
                    ))}
                  </dl>
                </Card>
              ) : null}

              {values.tab === 'progress' ? (
                <div className="stack-5">
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
                      label={t('reports.review')}
                      value={formatPercent(data.reviewRate)}
                      icon="🔁"
                    />
                    <Stat
                      label={t('reports.testsAverage')}
                      value={formatPercent(data.testsAvg)}
                      icon="📝"
                    />
                  </div>
                  <Card>
                    <BarChart
                      title={t('reports.trend')}
                      data={data.weeklySeries}
                      series={[
                        { key: 'memorization', label: t('reports.memorization') },
                        { key: 'review', label: t('reports.review') },
                      ]}
                    />
                  </Card>
                </div>
              ) : null}

              {values.tab === 'recitation' ? (
                <Table
                  columns={sessionColumns}
                  rows={data.sessions}
                  getRowKey={(row) => row.id}
                  caption={t('teacher.session.history')}
                  emptyMessage={t('teacher.session.noSessions')}
                />
              ) : null}

              {values.tab === 'notes' ? (
                data.notes.length === 0 ? (
                  <EmptyState
                    icon="📝"
                    title={t('teacher.note.listTitle')}
                    text={t('teacher.note.none')}
                    action={
                      role === 'teacher' ? (
                        <Button onClick={() => setNoteOpen(true)}>{t('teacher.addNote')}</Button>
                      ) : null
                    }
                  />
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
                              {t('teacher.note.by', { name: note.authorName })} ·{' '}
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
                      <span
                        key={row.id}
                        className={`attendance-day attendance-day--${row.status}`}
                        title={`${formatShortDate(row.date)} — ${t(
                          `teacher.attendanceStatus.${row.status}`,
                        )}`}
                      >
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

      <AddNoteModal
        open={noteOpen}
        student={data}
        onClose={() => setNoteOpen(false)}
        onSaved={refetch}
      />
    </>
  );
}
