import { useCallback, useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as studentService from '../../services/studentService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Field,
  Select,
  Stat,
  ProgressBar,
  BarChart,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';

/** الأهداف — تعديل الهدف اليومي والأسبوعي ومتابعة الالتزام. */
export default function Goals() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ targetDaily: 3, targetWeekly: 15 });
  const [status, setStatus] = useState('idle');

  const fetcher = useCallback(() => studentService.getGoals(user.studentId), [user.studentId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  useEffect(() => {
    if (data) setForm({ targetDaily: data.targetDaily, targetWeekly: data.targetWeekly });
  }, [data]);

  const handleSave = async (event) => {
    event.preventDefault();
    setStatus('loading');
    try {
      await studentService.updateGoals(user.studentId, form);
      setStatus('success');
      toast.success(t('student.goals.updated'));
      refetch();
    } catch {
      setStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

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
        {data ? (
          <div className="stack-6">
            <div className="grid grid-3">
              <Stat
                label={t('student.todayGoal')}
                value={`${formatNumber(data.todayDone)} / ${formatNumber(data.targetDaily)}`}
                icon="🎯"
              >
                <ProgressBar value={data.todayDone} max={data.targetDaily} showValue={false} />
              </Stat>
              <Stat
                label={t('student.streak')}
                value={t('student.streakDays', { count: formatNumber(data.streak) })}
                icon="🔥"
              />
              <Stat
                label={t('student.goals.commitmentRate')}
                value={formatPercent(data.commitmentRate)}
                icon="✓"
                accent
              />
            </div>

            <Card className="stack-5">
              <h2 className="t-lg t-semibold">{t('student.goals.daily')}</h2>
              <form className="stack-4" onSubmit={handleSave}>
                <div className="grid grid-2">
                  <Field label={t('student.goals.pagesPerDay')}>
                    <Select
                      value={form.targetDaily}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, targetDaily: Number(event.target.value) }))
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
                      value={form.targetWeekly}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, targetWeekly: Number(event.target.value) }))
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
                  status={status}
                  loadingText={t('common.saving')}
                  successText={t('common.saved')}
                >
                  {t('common.save')}
                </Button>
              </form>
            </Card>

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
