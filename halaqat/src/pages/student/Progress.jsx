import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as studentService from '../../services/studentService.js';
import { formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Stat,
  Card,
  LineChart,
  BarChart,
  ProgressBar,
  DataState,
  PageSkeleton,
  Accordion,
} from '../../components/ui/index.js';

/** التقدم — الصورة الكاملة للطالب، والتفاصيل مطويّة تحت الطلب. */
export default function Progress() {
  const t = useT();
  const { user } = useAuth();

  const fetcher = useCallback(() => studentService.getProgress(user.studentId), [user.studentId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  return (
    <>
      <PageHeader
        title={t('student.progress.title')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/student' },
          { label: t('student.progress.title') },
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
            <div className="grid grid-4">
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
                label={t('student.progress.totalSessions')}
                value={formatNumber(data.totalSessions)}
                icon="🎙"
              />
              <Stat
                label={t('student.progress.averageScore')}
                value={formatPercent(data.averageMastery)}
                icon="📈"
                accent
              />
            </div>

            <Card>
              <LineChart
                title={t('student.progress.lastSixWeeks')}
                data={data.weeks}
                series={[
                  { key: 'memorization', label: t('reports.memorization') },
                  { key: 'review', label: t('reports.review') },
                ]}
              />
            </Card>

            <Card>
              <BarChart
                title={t('reports.averageMastery')}
                data={data.weeks}
                series={[{ key: 'mastery', label: t('reports.averageMastery') }]}
                valueFormatter={(value) => formatPercent(value)}
              />
            </Card>

            <Section title={t('student.progress.byJuz')} id="juz-progress">
              <Accordion
                items={[
                  {
                    id: 'juz-list',
                    title: t('common.details'),
                    content: (
                      <ul className="grid grid-2">
                        {data.juzProgress.map((item) => (
                          <li key={item.juz}>
                            <ProgressBar
                              label={t('student.progress.juz', { number: formatNumber(item.juz) })}
                              value={item.percent}
                              variant={item.percent === 100 ? 'success' : 'brand'}
                            />
                          </li>
                        ))}
                      </ul>
                    ),
                  },
                ]}
              />
            </Section>
          </div>
        ) : null}
      </DataState>
    </>
  );
}
