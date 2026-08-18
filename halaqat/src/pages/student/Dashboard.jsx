import { useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as studentService from '../../services/studentService.js';
import { formatFraction, formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Stat,
  Card,
  Button,
  ProgressBar,
  DataState,
  PageSkeleton,
  Badge,
  Alert,
} from '../../components/ui/index.js';

/**
 * لوحة الطالب — مختصرة عمدًا:
 * تحية، هدف اليوم، أربعة مؤشرات، إجراء أساسي واحد، ثم آخر النشاطات.
 */
export default function StudentDashboard() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [completing, setCompleting] = useState(null);

  const fetcher = useCallback(
    () => studentService.getDashboard(user.studentId),
    [user.studentId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  const handleComplete = async (planId) => {
    setCompleting(planId);
    try {
      await studentService.completePlanItem(user.studentId, planId);
      toast.success(t('student.plan.marked'));
      refetch();
    } catch {
      toast.error(t('state.errorHint'));
    } finally {
      setCompleting(null);
    }
  };

  const student = data?.student;
  const goalDone = student ? student.todayDone >= student.targetDaily : false;

  return (
    <>
      <PageHeader
        title={t('nav.dashboard')}
        documentTitle={t('nav.dashboard')}
        actions={
          <Button to="/app/student/recitation" size="lg">
            {goalDone ? t('student.continueSession') : t('student.startSession')}
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
        {student ? (
          <div className="stack-6">
            {/* الترحيب + هدف اليوم */}
            <section className="welcome">
              <div>
                <h2 className="welcome__title">{t('student.greeting', { name: student.name })}</h2>
                <p className="welcome__text">
                  {goalDone
                    ? t('student.goalDone')
                    : t('student.goalRemaining', {
                        count: formatNumber(student.targetDaily - student.todayDone),
                      })}
                </p>
              </div>
              <div className="welcome__actions">
                <Button variant="gold" to="/app/quran">
                  {t('student.resumeReading')}
                </Button>
                <Button variant="secondary" to="/app/student/progress">
                  {t('student.viewProgress')}
                </Button>
              </div>
            </section>

            {/* الطالب المتميز: مساعد المعلم */}
            {student.isAssistant ? (
              <Alert variant="success" title={t('teacher.assistant.yourRole')}>
                {t('teacher.assistant.yourRoleHint')}
              </Alert>
            ) : null}

            {/* المؤشرات */}
            <div className="grid grid-4">
              <Stat
                label={t('student.todayGoal')}
                value={formatFraction(student.todayDone, student.targetDaily)}
                meta={t('common.pages')}
                icon="🎯"
              >
                <ProgressBar
                  value={student.todayDone}
                  max={student.targetDaily}
                  showValue={false}
                  variant={goalDone ? 'success' : 'brand'}
                />
              </Stat>

              <Stat
                label={t('student.review')}
                value={formatPercent(student.reviewRate)}
                meta={t('reports.averageMastery')}
                icon="🔁"
                href="/app/student/review"
                linkLabel={t('common.details')}
              />

              <Stat
                label={t('student.recitation')}
                value={formatPercent(student.masteryAvg)}
                meta={t('recitation.result.mastery')}
                icon="🎙"
                href="/app/student/recitation"
                linkLabel={t('recitation.start')}
              />

              <Stat
                label={t('student.streak')}
                value={t('student.streakDays', { count: formatNumber(student.streak) })}
                meta={t('student.goals.commitment')}
                icon="🔥"
              />
            </div>

            {/* خطة اليوم */}
            <Section title={t('student.plan.title')} id="today-plan">
              <div className="stack-3">
                {data.plan.map((item) => (
                  <div
                    key={item.id}
                    className={`plan-item${item.done ? ' plan-item--done' : ''}`}
                  >
                    <span className="plan-item__mark" aria-hidden="true">
                      {item.done ? '✓' : '•'}
                    </span>
                    <div className="grow">
                      <p className="t-medium">{t(`student.plan.${item.kind}`)}</p>
                      <p className="t-sm t-muted">
                        {item.surahName} · {formatNumber(item.fromAyah)}–{formatNumber(item.toAyah)}
                      </p>
                    </div>
                    {item.done ? (
                      <Badge variant="success">{t('student.plan.done')}</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        status={completing === item.id ? 'loading' : 'idle'}
                        onClick={() => handleComplete(item.id)}
                      >
                        {t('student.plan.markDone')}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Section>

            {/* آخر النشاطات */}
            <Section
              title={t('student.recentActivity')}
              id="recent-activity"
              actions={
                <Link to="/app/student/progress" className="t-sm">
                  {t('common.seeAll')} ←
                </Link>
              }
            >
              {data.recent.length === 0 ? (
                <Card variant="quiet" className="t-center t-muted">
                  {t('student.noActivity')}
                </Card>
              ) : (
                <ul className="stack-2">
                  {data.recent.map((item) => (
                    <li key={item.id}>
                      <Card variant="flat" className="row row-3">
                        <span aria-hidden="true">
                          {item.type === 'memorization' ? '📖' : item.type === 'test' ? '📝' : '🔁'}
                        </span>
                        <div className="grow">
                          <p className="t-medium">
                            {item.surahName} · {formatNumber(item.fromAyah)}–
                            {formatNumber(item.toAyah)}
                          </p>
                          <p className="t-xs t-muted">{formatRelative(item.createdAt, t)}</p>
                        </div>
                        <Badge
                          variant={
                            item.mastery >= 90
                              ? 'success'
                              : item.mastery >= 75
                                ? 'info'
                                : 'warning'
                          }
                        >
                          {formatPercent(item.mastery)}
                        </Badge>
                      </Card>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {/* الاختبار القادم */}
            {data.nextTest ? (
              <Card className="row row-between row-wrap">
                <div>
                  <p className="t-semibold">{t('student.nextTest')}</p>
                  <p className="t-sm t-muted">
                    {t(data.nextTest.titleKey)} ·{' '}
                    {t('tests.questionsCount', { count: formatNumber(data.nextTest.questionCount) })}
                  </p>
                </div>
                <Button variant="secondary" to="/app/student/tests">
                  {t('tests.start')}
                </Button>
              </Card>
            ) : null}
          </div>
        ) : null}
      </DataState>
    </>
  );
}
