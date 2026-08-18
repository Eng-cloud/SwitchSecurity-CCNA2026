import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import useAsyncData from '../../hooks/useAsyncData.js';
import * as testsService from '../../services/testsService.js';
import { formatDuration, formatNumber } from '../../lib/format.js';
import {
  PageHeader,
  Card,
  Button,
  ProgressBar,
  DataState,
  ConfirmDialog,
  Badge,
} from '../../components/ui/index.js';

/** تشغيل الاختبار: سؤال بسؤال، مؤقّت، تنقل، وتأكيد قبل الإنهاء. */
export default function TestRunner() {
  const t = useT();
  const { testId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();

  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [status, setStatus] = useState('idle');
  const submittedRef = useRef(false);

  const fetcher = useCallback(() => testsService.getTest(testId), [testId]);
  const { data: test, loading, error, refetch } = useAsyncData(fetcher, [testId]);

  useEffect(() => {
    if (test && secondsLeft == null) setSecondsLeft(test.durationMinutes * 60);
  }, [test, secondsLeft]);

  const submit = useCallback(
    async (auto = false) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setStatus('loading');
      try {
        await testsService.submitTest(testId, user.studentId, answers);
        if (auto) toast.info(t('tests.timeUp'));
        navigate(`/app/student/tests/${testId}/result`, { replace: true });
      } catch {
        submittedRef.current = false;
        setStatus('idle');
        toast.error(t('state.errorHint'));
      }
    },
    [answers, navigate, t, testId, toast, user.studentId],
  );

  useEffect(() => {
    if (secondsLeft == null) return undefined;
    if (secondsLeft <= 0) {
      submit(true);
      return undefined;
    }
    const timer = setTimeout(() => setSecondsLeft((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft, submit]);

  const questions = test?.questions ?? [];
  const current = questions[index];
  const answeredCount = Object.keys(answers).length;
  const unanswered = questions.length - answeredCount;

  const handleFinish = () => {
    if (unanswered > 0) setConfirmOpen(true);
    else submit(false);
  };

  return (
    <>
      <PageHeader
        title={test ? t(test.titleKey) : t('tests.title')}
        documentTitle={test ? t(test.titleKey) : t('tests.title')}
        breadcrumb={[
          { label: t('nav.home'), to: '/app/student' },
          { label: t('tests.title'), to: '/app/student/tests' },
          { label: test ? t(test.titleKey) : '' },
        ]}
      />

      <DataState loading={loading} error={error} onRetry={refetch} isEmpty={false}>
        {current ? (
          <div className="stack-5">
            <div className="test-header">
              <div className="stack-1 grow">
                <p className="t-sm t-muted">
                  {t('tests.questionOf', {
                    current: formatNumber(index + 1),
                    total: formatNumber(questions.length),
                  })}
                </p>
                <ProgressBar
                  value={answeredCount}
                  max={questions.length}
                  showValue={false}
                  label={t('tests.answered')}
                />
              </div>
              <p
                className={`test-timer${secondsLeft != null && secondsLeft < 60 ? ' test-timer--warning' : ''}`}
                role="timer"
                aria-live="off"
              >
                <span className="visually-hidden">{t('tests.timeLeft')}: </span>
                {formatDuration(secondsLeft ?? 0)}
              </p>
            </div>

            <Card className="stack-5">
              <div className="stack-2">
                <p className="t-sm t-muted">{current.meta}</p>
                <h2 className="t-lg t-semibold">{current.prompt}</h2>
                {current.context ? (
                  <p className="t-serif t-xl" style={{ lineHeight: 2.2 }}>
                    {current.context}
                  </p>
                ) : null}
              </div>

              <fieldset className="stack-3" style={{ border: 'none' }}>
                <legend className="visually-hidden">{t('tests.answer')}</legend>
                {current.options.map((option) => (
                  <label key={option} className="answer-option">
                    <input
                      type="radio"
                      name={current.id}
                      value={option}
                      checked={answers[current.id] === option}
                      onChange={() =>
                        setAnswers((prev) => ({ ...prev, [current.id]: option }))
                      }
                      style={{ width: 20, height: 20, accentColor: 'var(--brand-600)' }}
                    />
                    <span className="answer-option__text">{option}</span>
                  </label>
                ))}
              </fieldset>

              <div className="row row-between row-wrap">
                <Button
                  variant="ghost"
                  onClick={() => setIndex((prev) => Math.max(0, prev - 1))}
                  disabled={index === 0}
                >
                  {t('common.previous')}
                </Button>

                {index < questions.length - 1 ? (
                  <Button onClick={() => setIndex((prev) => prev + 1)}>{t('common.next')}</Button>
                ) : (
                  <Button onClick={handleFinish} status={status} data-testid="submit-test">
                    {t('tests.submit')}
                  </Button>
                )}
              </div>
            </Card>

            <nav className="question-nav" aria-label={t('tests.title')}>
              {questions.map((question, questionIndex) => (
                <button
                  key={question.id}
                  type="button"
                  className={`question-nav__btn${answers[question.id] ? ' question-nav__btn--answered' : ''}`}
                  aria-current={questionIndex === index ? 'true' : undefined}
                  aria-label={t('tests.questionOf', {
                    current: formatNumber(questionIndex + 1),
                    total: formatNumber(questions.length),
                  })}
                  onClick={() => setIndex(questionIndex)}
                >
                  {formatNumber(questionIndex + 1)}
                </button>
              ))}
            </nav>

            <p className="t-sm t-muted">
              <Badge variant={unanswered > 0 ? 'warning' : 'success'}>
                {unanswered > 0
                  ? `${formatNumber(unanswered)} ${t('tests.unanswered')}`
                  : t('tests.answered')}
              </Badge>
            </p>
          </div>
        ) : null}
      </DataState>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => submit(false)}
        title={t('tests.confirmSubmitTitle')}
        message={t('tests.confirmSubmitText', { count: formatNumber(unanswered) })}
        confirmLabel={t('tests.submit')}
        status={status}
      />
    </>
  );
}
