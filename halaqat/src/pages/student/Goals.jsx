import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as studentService from '../../services/studentService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Card,
  Button,
  Field,
  Select,
  Stat,
  Badge,
  Alert,
  ProgressBar,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** مدد الهدف: من شهر إلى سنة كحد أقصى. */
const DURATIONS = [30, 60, 90, 180, 270, 365];

export default function Goals() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();

  const [juzForm, setJuzForm] = useState({ targetJuz: 1, durationDays: 90 });
  const [dailyForm, setDailyForm] = useState({ targetDaily: 3, targetWeekly: 15 });
  const [juzStatus, setJuzStatus] = useState('idle');
  const [dailyStatus, setDailyStatus] = useState('idle');

  const fetcher = useCallback(() => studentService.getGoals(user.studentId), [user.studentId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  useEffect(() => {
    if (!data) return;
    setJuzForm({
      targetJuz: data.juzGoal.targetJuz,
      durationDays: data.juzGoal.durationDays,
    });
    setDailyForm({ targetDaily: data.targetDaily, targetWeekly: data.targetWeekly });
  }, [data]);

  const saveJuzGoal = async (event) => {
    event.preventDefault();
    setJuzStatus('loading');
    try {
      await studentService.updateJuzGoal(user.studentId, juzForm);
      setJuzStatus('success');
      toast.success(t('student.goals.goalSaved'));
      refetch();
    } catch {
      setJuzStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  const saveDaily = async (event) => {
    event.preventDefault();
    setDailyStatus('loading');
    try {
      await studentService.updateGoals(user.studentId, dailyForm);
      setDailyStatus('success');
      toast.success(t('student.goals.updated'));
      refetch();
    } catch {
      setDailyStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  const durationLabel = (days) => {
    if (days === 365) return t('student.goals.durationYear');
    if (days % 30 === 0 && days >= 60) {
      return t('student.goals.durationMonths', { count: formatNumber(days / 30) });
    }
    return t('student.goals.durationDays', { count: formatNumber(days) });
  };

  const goal = data?.juzGoal;

  return (
    <>
      <PageHeader
        title={t('student.goals.title')}
        subtitle={t('student.goals.subtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/student' },
          { label: t('student.goals.title') },
        ]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={false}
        loadingFallback={<PageSkeleton cards={3} />}
      >
        {data && goal ? (
          <div className="stack-6">
            {/* حالة هدف الأجزاء */}
            <Card className="stack-5">
              <div className="row row-between row-wrap">
                <h2 className="t-lg t-semibold">{t('student.goals.juzTitle')}</h2>
                <Badge
                  variant={goal.pace === 'ahead' ? 'success' : goal.pace === 'behind' ? 'warning' : 'info'}
                >
                  {t(`student.goals.${goal.pace}`)}
                </Badge>
              </div>

              <ProgressBar
                label={t('student.goals.achievedJuz')}
                value={goal.progressPercent}
                valueText={`${formatNumber(goal.achievedJuz)} / ${formatNumber(goal.targetJuz)}`}
                variant={goal.pace === 'behind' ? 'warning' : 'success'}
              />

              <div className="grid grid-4">
                <Stat
                  label={t('student.goals.targetJuz')}
                  value={
                    goal.targetJuz === 1
                      ? t('student.goals.juzCountOne')
                      : t('student.goals.juzCount', { count: formatNumber(goal.targetJuz) })
                  }
                  icon="📚"
                />
                <Stat
                  label={t('student.goals.duration')}
                  value={durationLabel(goal.durationDays)}
                  meta={t('student.goals.remainingDays', { count: formatNumber(goal.remainingDays) })}
                  icon="🗓"
                />
                <Stat
                  label={t('student.goals.requiredPace')}
                  value={t('student.goals.pagePerDay', {
                    count: formatNumber(goal.requiredPagePerDay),
                  })}
                  icon="⚡"
                  accent
                />
                <Stat
                  label={t('student.goals.elapsed')}
                  value={formatPercent(
                    Math.min(100, Math.round((goal.elapsedDays / goal.durationDays) * 100)),
                  )}
                  meta={t('student.goals.durationDays', { count: formatNumber(goal.elapsedDays) })}
                  icon="⏳"
                />
              </div>

              <form className="stack-4" onSubmit={saveJuzGoal}>
                <div className="grid grid-2">
                  <Field label={t('student.goals.targetJuz')}>
                    <Select
                      value={juzForm.targetJuz}
                      onChange={(event) =>
                        setJuzForm((prev) => ({ ...prev, targetJuz: Number(event.target.value) }))
                      }
                      data-testid="target-juz"
                    >
                      {Array.from({ length: 30 }, (_, index) => index + 1).map((juz) => (
                        <option key={juz} value={juz}>
                          {juz === 1
                            ? t('student.goals.juzCountOne')
                            : t('student.goals.juzCount', { count: formatNumber(juz) })}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label={t('student.goals.duration')} hint={t('student.goals.maxHint')}>
                    <Select
                      value={juzForm.durationDays}
                      onChange={(event) =>
                        setJuzForm((prev) => ({ ...prev, durationDays: Number(event.target.value) }))
                      }
                      data-testid="goal-duration"
                    >
                      {DURATIONS.map((days) => (
                        <option key={days} value={days}>
                          {durationLabel(days)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>

                <Alert variant="info">
                  {t('student.goals.requiredPace')}:{' '}
                  <strong>
                    {t('student.goals.pagePerDay', {
                      count: formatNumber(
                        Math.round(((juzForm.targetJuz * 20) / juzForm.durationDays) * 10) / 10,
                      ),
                    })}
                  </strong>
                </Alert>

                <Button
                  type="submit"
                  status={juzStatus}
                  loadingText={t('common.saving')}
                  successText={t('common.saved')}
                  data-testid="save-juz-goal"
                >
                  {t('student.goals.saveGoal')}
                </Button>
              </form>
            </Card>

            {/* الهدف اليومي */}
            <Section title={t('student.goals.dailyTitle')} id="daily-goal">
              <Card className="stack-4">
                <div className="grid grid-3">
                  <Stat
                    label={t('student.todayGoal')}
                    value={`${formatNumber(data.todayDone)} / ${formatNumber(data.targetDaily)}`}
                    icon="🎯"
                  />
                  <Stat
                    label={t('student.streak')}
                    value={t('student.streakDays', { count: formatNumber(data.streak) })}
                    icon="🔥"
                  />
                  <Stat
                    label={t('student.goals.commitmentRate')}
                    value={formatPercent(data.commitmentRate)}
                    icon="✓"
                  />
                </div>

                <form className="stack-4" onSubmit={saveDaily}>
                  <div className="grid grid-2">
                    <Field label={t('student.goals.pagesPerDay')}>
                      <Select
                        value={dailyForm.targetDaily}
                        onChange={(event) =>
                          setDailyForm((prev) => ({
                            ...prev,
                            targetDaily: Number(event.target.value),
                          }))
                        }
                      >
                        {[1, 2, 3, 4, 5, 6].map((value) => (
                          <option key={value} value={value}>
                            {formatNumber(value)}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label={t('student.goals.pagesPerWeek')}>
                      <Select
                        value={dailyForm.targetWeekly}
                        onChange={(event) =>
                          setDailyForm((prev) => ({
                            ...prev,
                            targetWeekly: Number(event.target.value),
                          }))
                        }
                      >
                        {[5, 10, 15, 20, 25, 30].map((value) => (
                          <option key={value} value={value}>
                            {formatNumber(value)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>

                  <Button
                    type="submit"
                    variant="secondary"
                    status={dailyStatus}
                    loadingText={t('common.saving')}
                    successText={t('common.saved')}
                  >
                    {t('common.save')}
                  </Button>
                </form>
              </Card>
            </Section>

            <BarChart
              title={t('student.weeklyPlan')}
              data={data.history}
              series={[
                { key: 'planned', label: t('student.goals.weekly') },
                { key: 'done', label: t('student.plan.done') },
              ]}
            />
          </div>
        ) : null}
      </DataState>
    </>
  );
}
