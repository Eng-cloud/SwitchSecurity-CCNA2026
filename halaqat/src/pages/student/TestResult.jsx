import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as testsService from '../../services/testsService.js';
import { formatNumber, formatPercent, formatDateTime } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  Badge,
  Stat,
  ProgressRing,
  DataState,
  Section,
} from '../../components/ui/index.js';

/** نتيجة الاختبار مع مراجعة الإجابات. */
export default function TestResult() {
  const t = useT();
  const { testId } = useParams();
  const { user } = useAuth();
  const [showReview, setShowReview] = useState(false);

  const fetcher = useCallback(
    () => testsService.getAttempt(testId, user.studentId),
    [testId, user.studentId],
  );
  const { data: attempt, loading, error, refetch } = useAsyncData(fetcher, [testId]);

  const passed = (attempt?.score ?? 0) >= 60;

  return (
    <>
      <PageHeader
        title={t('tests.resultTitle')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/student' },
          { label: t('tests.title'), to: '/app/student/tests' },
          { label: t('tests.resultTitle') },
        ]}
        actions={
          <Button variant="secondary" to="/app/student/tests">
            {t('tests.backToTests')}
          </Button>
        }
      />

      <DataState loading={loading} error={error} onRetry={refetch} isEmpty={false}>
        {attempt ? (
          <div className="stack-6">
            <Card className="stack-5">
              <div className="row row-6 row-wrap" style={{ justifyContent: 'center' }}>
                <ProgressRing
                  value={attempt.score}
                  label={t('tests.score')}
                  color={passed ? 'var(--success)' : 'var(--warning)'}
                />
                <div className="stack-2">
                  <Badge variant={passed ? 'success' : 'warning'}>
                    {passed ? t('tests.passed') : t('tests.failed')}
                  </Badge>
                  <p className="t-sm t-muted">{formatDateTime(attempt.submittedAt)}</p>
                </div>
              </div>

              <div className="grid grid-3 stagger">
                <Stat label={t('tests.correct')} value={formatNumber(attempt.correctCount)} icon="✓" />
                <Stat
                  label={t('tests.wrong')}
                  value={formatNumber(attempt.totalCount - attempt.correctCount)}
                  icon="✕"
                />
                <Stat label={t('tests.score')} value={formatPercent(attempt.score)} icon="📊" />
              </div>

              <div className="row row-3 row-wrap">
                <Button
                  variant="secondary"
                  onClick={() => setShowReview((prev) => !prev)}
                  aria-expanded={showReview}
                >
                  {t('tests.reviewAnswers')}
                </Button>
                <Button variant="ghost" to="/app/student/reports">
                  {t('tests.openReport')}
                </Button>
              </div>
            </Card>

            {showReview ? (
              <Section title={t('tests.reviewAnswers')} id="review">
                <ul className="stack-3">
                  {attempt.details.map((item, index) => (
                    <li key={item.id}>
                      <Card
                        className="stack-3"
                        style={{
                          borderColor: item.isCorrect ? 'var(--success-border)' : 'var(--danger-border)',
                        }}
                      >
                        <div className="row row-between row-wrap">
                          <p className="t-medium">
                            {formatNumber(index + 1)}. {item.prompt}
                          </p>
                          <Badge variant={item.isCorrect ? 'success' : 'danger'}>
                            {item.isCorrect ? t('tests.correct') : t('tests.wrong')}
                          </Badge>
                        </div>

                        {item.context ? (
                          <p className="t-serif t-lg" style={{ lineHeight: 2 }}>
                            {item.context}
                          </p>
                        ) : null}

                        <div className="stack-1 t-sm">
                          <p>
                            <span className="t-muted">{t('tests.yourAnswer')}: </span>
                            <strong>{item.answer ?? t('tests.unanswered')}</strong>
                          </p>
                          {!item.isCorrect ? (
                            <p>
                              <span className="t-muted">{t('tests.correctAnswer')}: </span>
                              <strong className="t-success">{item.correct}</strong>
                            </p>
                          ) : null}
                        </div>
                      </Card>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>
        ) : null}
      </DataState>
    </>
  );
}
