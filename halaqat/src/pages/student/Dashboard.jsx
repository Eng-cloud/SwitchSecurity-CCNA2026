import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as studentService from '../../services/studentService.js';
import * as taskService from '../../services/taskService.js';
import useAssistantDuty from '../../hooks/useAssistantDuty.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Card,
  Button,
  DataState,
  PageSkeleton,
  Badge,
  Alert,
} from '../../components/ui/index.js';

/** تحية بحسب الوقت — لمسة إنسانية قبل أي رقم. */
function greetingKey() {
  const hour = new Date().getHours();
  return hour < 12 ? 'student.home.morning' : 'student.home.evening';
}

/**
 * لوحة الطالب — ترتيب إنساني لا إداري.
 *
 * تبدأ بمن يقرأ: تحية ودعاء، ثم وردُ اليوم بفعله الواحد، ثم رحلة الأسبوع
 * بثلاثة أرقام بلا بطاقات. التفاصيل والإحصاءات تأتي بعد ذلك لا قبله.
 */
export default function StudentDashboard() {
  const t = useT();
  const { user } = useAuth();
  const { duty } = useAssistantDuty();

  const fetcher = useCallback(
    () => studentService.getDashboard(user.studentId),
    [user.studentId],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  // ورد اليوم من نواة المهام — مصدر واحد لما ينبغي فعله الآن.
  const tasksFetcher = useCallback(() => taskService.listToday(user.studentId), [user.studentId]);
  const today = useAsyncData(tasksFetcher, [user.studentId]);

  /** تبديل حالة بند الخطة — الضغطة الخاطئة يتراجع عنها بضغطة مثلها. */
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
            {/* التحية والدعاء — افتتاح هادئ بلا أرقام */}
            <section className="daily-hero ornament ornament--fade">
              <h2 className="daily-hero__greeting">
                {t(greetingKey(), { name: student.name })}
              </h2>
              <p className="daily-hero__quote">{t('student.home.quote')}</p>
            </section>

            {/* وردك اليوم — الفعل الواحد الذي جاء من أجله */}
            {(() => {
              const tasks = today.data?.tasks ?? [];
              const pending = tasks.filter((task) => task.status === 'pending');
              const current = pending[0] ?? null;
              const rest = pending.slice(1);

              if (!current) {
                return (
                  <section className="ward">
                    <div>
                      <p className="ward__label">{t('student.home.wardLabel')}</p>
                      <p className="ward__title">{t('student.home.wardEmpty')}</p>
                      <p className="ward__range">{t('student.home.wardEmptyHint')}</p>
                    </div>
                    <div className="ward__actions">
                      <Button variant="secondary" to="/app/student/review">
                        {t('nav.review')}
                      </Button>
                    </div>
                  </section>
                );
              }

              return (
                <>
                  <section className="ward" data-testid="ward">
                    <div>
                      <p className="ward__label">
                        {t('student.home.wardLabel')} ·{' '}
                        {t(`tasks.types.${current.type}`)}
                        {current.source === 'teacher' ? ` · ${t('tasks.fromTeacher')}` : ''}
                      </p>
                      <p className="ward__title">{current.surahName}</p>
                      <p className="ward__range">
                        {t('tasks.range', {
                          surah: current.surahName,
                          from: formatNumber(current.fromAyah),
                          to: formatNumber(current.toAyah),
                        })}
                      </p>
                    </div>
                    <div className="ward__actions">
                      <Button variant="gold" to="/app/student/recitation" data-testid="ward-start">
                        {t(`tasks.start.${current.type}`)}
                      </Button>
                      <Button
                        variant="secondary"
                        to={`/app/quran/${current.surahNumber}?from=${current.fromAyah}&to=${current.toAyah}`}
                      >
                        {t('tasks.viewAyat')}
                      </Button>
                    </div>
                  </section>

                  {rest.length > 0 ? (
                    <div className="stack-3">
                      <p className="t-sm t-muted">{t('student.home.restLabel')}</p>
                      <ul className="ward-rest">
                        {rest.map((task) => (
                          <li key={task.id}>
                            <span className="ward-rest__mark" aria-hidden="true" />
                            <div className="ward-rest__body">
                              <p className="t-medium">{t(`tasks.types.${task.type}`)}</p>
                              <p className="t-sm t-muted">
                                {t('tasks.range', {
                                  surah: task.surahName,
                                  from: formatNumber(task.fromAyah),
                                  to: formatNumber(task.toAyah),
                                })}
                              </p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              );
            })()}

            {/* مهمة موكَّلة من المعلم — تظهر أثناء التوكيل فقط ثم تختفي. */}
            {duty?.active ? (
              <Alert variant="success" title={t('student.assistant.dutyTitle')}>
                <div className="stack-2">
                  <p>
                    {t('student.assistant.banner', {
                      count: duty.delegation.progress.remaining,
                    })}
                  </p>
                  <Button size="sm" to="/app/student/assistant" data-testid="duty-banner-cta">
                    {t('student.assistant.bannerCta')}
                  </Button>
                </div>
              </Alert>
            ) : null}

            {/* رحلة الأسبوع — ثلاثة أرقام في سطر، بلا بطاقات */}
            <Section title={t('student.home.journeyTitle')} id="journey">
              <div className="journey">
                <div className="journey__item">
                  <span className="journey__value">
                    🔥 {t('student.streakDays', { count: formatNumber(student.streak) })}
                  </span>
                  <span className="journey__label">{t('student.home.journeyStreak')}</span>
                </div>
                <div className="journey__item">
                  <span className="journey__value">
                    📖 {formatNumber(student.memorizedPages)}
                  </span>
                  <span className="journey__label">{t('reports.pagesMemorized')}</span>
                </div>
                <div className="journey__item">
                  <span className="journey__value">
                    ✓ {formatPercent(student.masteryAvg)}
                  </span>
                  <span className="journey__label">{t('student.home.journeyMastery')}</span>
                </div>
              </div>
            </Section>

            {/* آخر النشاطات */}
            <Section
              title={t('student.recentActivity')}
              id="recent-activity"
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
