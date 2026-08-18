import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as testsService from '../../services/testsService.js';
import { formatNumber, formatPercent, formatRelative } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Badge,
  Button,
  Modal,
  DataState,
  Skeleton,
  Accordion,
} from '../../components/ui/index.js';

/** قائمة الاختبارات (الأسبوعي والشهري) مع شاشة تعليمات قبل البدء. */
export default function Tests() {
  const t = useT();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [selected, setSelected] = useState(null);

  const fetcher = useCallback(() => testsService.listTests(user.studentId), [user.studentId]);
  const { data, loading, error, refetch } = useAsyncData(fetcher, [user.studentId]);

  const tests = data ?? [];

  return (
    <>
      <PageHeader
        title={t('tests.title')}
        subtitle={t('tests.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/student' }, { label: t('tests.title') }]}
      />

      <DataState
        loading={loading}
        error={error}
        onRetry={refetch}
        isEmpty={tests.length === 0}
        emptyTitle={t('tests.noTests')}
        loadingFallback={<Skeleton variant="card" count={2} height={160} />}
      >
        <div className="grid grid-2">
          {tests.map((test) => (
            <Card key={test.id} className="stack-4">
              <div className="row row-between">
                <div>
                  <h2 className="t-lg t-semibold">{t(test.titleKey)}</h2>
                  <p className="t-sm t-muted">
                    {t(test.scope === 'weekly' ? 'tests.weeklyDesc' : 'tests.monthlyDesc')}
                  </p>
                </div>
                <Badge variant={test.attempt ? 'success' : 'brand'}>
                  {test.attempt ? t('tests.completed') : t('tests.available')}
                </Badge>
              </div>

              <ul className="row row-4 row-wrap t-sm t-muted">
                <li>{t('tests.questionsCount', { count: formatNumber(test.questionCount) })}</li>
                <li>{t('tests.durationMinutes', { count: formatNumber(test.durationMinutes) })}</li>
              </ul>

              {test.attempt ? (
                <div className="row row-between row-wrap">
                  <p className="t-sm">
                    {t('tests.score')}: <strong>{formatPercent(test.attempt.score)}</strong>
                    <span className="t-muted">
                      {' '}
                      · {formatRelative(test.attempt.submittedAt, t)}
                    </span>
                  </p>
                  <div className="row row-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      to={`/app/student/tests/${test.id}/result`}
                    >
                      {t('tests.reviewAnswers')}
                    </Button>
                    <Button size="sm" onClick={() => setSelected(test)}>
                      {t('tests.start')}
                    </Button>
                  </div>
                </div>
              ) : (
                <Button onClick={() => setSelected(test)} data-testid={`start-${test.scope}`}>
                  {t('tests.start')}
                </Button>
              )}
            </Card>
          ))}
        </div>
      </DataState>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={t('tests.instructions')}
        description={selected ? t(selected.titleKey) : undefined}
        footer={
          <>
            <Button variant="ghost" onClick={() => setSelected(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={() => navigate(`/app/student/tests/${selected.id}/run`)}
              data-testid="confirm-start-test"
            >
              {t('tests.start')}
            </Button>
          </>
        }
      >
        <div className="stack-4">
          <ul className="stack-2 t-sm">
            <li>• {t('tests.instructionsList.one')}</li>
            <li>• {t('tests.instructionsList.two')}</li>
            <li>• {t('tests.instructionsList.three')}</li>
          </ul>

          <Accordion
            items={[
              {
                id: 'details',
                title: t('common.details'),
                content: selected ? (
                  <ul className="stack-1">
                    <li>
                      {t('tests.questionsCount', { count: formatNumber(selected.questionCount) })}
                    </li>
                    <li>
                      {t('tests.durationMinutes', { count: formatNumber(selected.durationMinutes) })}
                    </li>
                  </ul>
                ) : null,
              },
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
