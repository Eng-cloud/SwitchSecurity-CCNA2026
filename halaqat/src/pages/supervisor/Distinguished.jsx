import { useCallback } from 'react';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import useListState from '../../hooks/useListState.js';
import * as distinguishedService from '../../services/distinguishedService.js';
import { formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Card,
  Badge,
  Alert,
  Field,
  Select,
  DataState,
  PageSkeleton,
} from '../../components/ui/index.js';
import DistinguishedList, {
  DistinguishedEmpty,
} from '../../components/distinguished/DistinguishedList.jsx';

/**
 * متميزو الشهر عند المشرف — عبر كل حلقاته.
 * ترتيب موحّد أولًا ليرى المشرف الصورة العامة، ثم تفصيل بكل حلقة.
 */
export default function SupervisorDistinguished() {
  const t = useT();
  const { user, role } = useAuth();
  const { values, setValue } = useListState({ defaults: { month: 'current' } });

  const fetcher = useCallback(
    () =>
      distinguishedService.listMonthlyDistinguished({
        role,
        userId: user.userId,
        month: values.month,
      }),
    [role, user.userId, values.month],
  );
  const { data, loading, error, refetch } = useAsyncData(fetcher, [role, user.userId, values.month]);

  return (
    <>
      <PageHeader
        title={t('distinguished.title')}
        subtitle={t('distinguished.supervisorSubtitle')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/supervisor' },
          { label: t('distinguished.title') },
        ]}
      />

      <Card variant="quiet" className="row row-4 row-wrap">
        <Field label={t('distinguished.monthLabel')} className="shrink-0">
          <Select
            value={values.month}
            onChange={(event) => setValue('month', event.target.value)}
            data-testid="month-select"
          >
            <option value="current">{t('distinguished.monthCurrent')}</option>
            <option value="previous">{t('distinguished.monthPrevious')}</option>
          </Select>
        </Field>
      </Card>

      <DataState loading={loading} error={error} onRetry={refetch} loadingFallback={<PageSkeleton />}>
        {data ? (
          <>
            <Alert variant="info" title={t('distinguished.criteria')}>
              {t('distinguished.criteriaText', {
                mastery: data.criteria.minMastery,
                attendance: data.criteria.minAttendance,
                sessions: data.criteria.minSessions,
              })}
            </Alert>

            {data.totalDistinguished === 0 ? (
              <DistinguishedEmpty
                onPrevious={
                  values.month === 'current' ? () => setValue('month', 'previous') : undefined
                }
              />
            ) : (
              <>
                <Section
                  id="top"
                  title={t('distinguished.topTitle')}
                  actions={
                    <Badge variant="success">
                      {t('distinguished.countBadge', {
                        count: formatNumber(data.totalDistinguished),
                      })}
                    </Badge>
                  }
                >
                  <DistinguishedList
                    rows={data.top}
                    showCircle
                    profileBase="/app/supervisor/students"
                  />
                </Section>

                <Section id="by-circle" title={t('distinguished.byCircle')}>
                  <div className="stack-4">
                    {data.circles.map((entry) => (
                      <div key={entry.circleId} className="stack-2">
                        <p className="t-strong">
                          {entry.circleName}
                          <span className="t-sm t-muted"> · {entry.teacherName}</span>
                        </p>
                        <DistinguishedList
                          rows={entry.students}
                          profileBase="/app/supervisor/students"
                        />
                      </div>
                    ))}
                  </div>
                </Section>
              </>
            )}
          </>
        ) : null}
      </DataState>
    </>
  );
}
