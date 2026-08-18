import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useT } from '../../i18n/index.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import * as ai from '../../services/aiRecitationService.js';
import * as studentService from '../../services/studentService.js';
import { SURAHS_WITH_TEXT } from '../../mock/quran.js';
import { formatDuration, formatNumber, formatPercent } from '../../lib/format.js';
import {
  PageHeader,
  Section,
  Button,
  Card,
  Field,
  Select,
  Alert,
  Badge,
  ProgressRing,
  Stat,
} from '../../components/ui/index.js';

/**
 * التسميع مع تحليل تجريبي (Mock AI).
 * الرحلة: اختيار المقطع → تسجيل → إيقاف → تحليل → نتيجة → حفظ.
 */
export default function Recitation() {
  const t = useT();
  const { user } = useAuth();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const [engine, setEngine] = useState(ai.getState());
  const [range, setRange] = useState(() => {
    const requested = Number(searchParams.get('surah'));
    const surah =
      SURAHS_WITH_TEXT.find((item) => item.number === requested) ?? SURAHS_WITH_TEXT[0];
    return { surahNumber: surah.number, fromAyah: 1, toAyah: Math.min(surah.ayahCount, 5) };
  });
  const [result, setResult] = useState(null);
  const [showMistakes, setShowMistakes] = useState(false);
  const [saveStatus, setSaveStatus] = useState('idle');

  useEffect(() => ai.subscribe(setEngine), []);
  useEffect(() => () => ai.reset(), []);

  const selectedSurah = useMemo(
    () => SURAHS_WITH_TEXT.find((item) => item.number === range.surahNumber),
    [range.surahNumber],
  );

  const isRecording = engine.status === 'recording';
  const isPaused = engine.status === 'paused';
  const isAnalyzing = engine.status === 'analyzing';

  const handleStart = () => {
    setResult(null);
    setShowMistakes(false);
    ai.startRecording({
      surahNumber: range.surahNumber,
      fromAyah: range.fromAyah,
      toAyah: range.toAyah,
    });
    toast.info(t('recitation.recordingStarted'));
  };

  const handleStop = async () => {
    const snapshot = ai.getState();
    ai.stopRecording();
    // إشعار بصري صريح لأن "انتهاء التسجيل" لا يجوز أن يكون صوتيًا فقط.
    toast.success(t('recitation.stopped'));
    const analysis = await ai.analyzeRecitation({
      range: snapshot.range,
      durationSeconds: snapshot.elapsedSeconds,
    });
    setResult(analysis);
  };

  const handleSave = async () => {
    if (!result) return;
    setSaveStatus('loading');
    try {
      await studentService.saveRecitationSession(user.studentId, {
        surahNumber: result.range.surahNumber,
        fromAyah: result.range.fromAyah,
        toAyah: result.range.toAyah,
        mastery: result.mastery,
        durationSeconds: result.durationSeconds,
      });
      setSaveStatus('success');
      toast.success(t('recitation.result.saved'));
    } catch {
      setSaveStatus('idle');
      toast.error(t('state.errorHint'));
    }
  };

  const handleRetry = () => {
    ai.reset();
    setResult(null);
    setSaveStatus('idle');
    setShowMistakes(false);
  };

  const levels = engine.levels.length ? engine.levels : Array.from({ length: 28 }, () => 0.06);

  return (
    <>
      <PageHeader
        title={t('recitation.title')}
        subtitle={t('recitation.subtitle')}
        breadcrumb={[{ label: t('nav.home'), to: '/app/student' }, { label: t('recitation.title') }]}
      />

      {/* اختيار المقطع */}
      {engine.status === 'idle' && !result ? (
        <Card className="stack-5">
          <h2 className="t-lg t-semibold">{t('recitation.selectRange')}</h2>

          <div className="grid grid-3">
            <Field label={t('recitation.surah')}>
              <Select
                value={range.surahNumber}
                onChange={(event) => {
                  const surahNumber = Number(event.target.value);
                  const surah = SURAHS_WITH_TEXT.find((item) => item.number === surahNumber);
                  setRange({
                    surahNumber,
                    fromAyah: 1,
                    toAyah: Math.min(surah?.ayahCount ?? 3, 5),
                  });
                }}
              >
                {SURAHS_WITH_TEXT.map((surah) => (
                  <option key={surah.number} value={surah.number}>
                    {surah.name}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('recitation.fromAyah')}>
              <Select
                value={range.fromAyah}
                onChange={(event) => {
                  const fromAyah = Number(event.target.value);
                  setRange((prev) => ({
                    ...prev,
                    fromAyah,
                    toAyah: Math.max(fromAyah, prev.toAyah),
                  }));
                }}
              >
                {Array.from({ length: selectedSurah?.ayahCount ?? 1 }, (_, index) => (
                  <option key={index + 1} value={index + 1}>
                    {formatNumber(index + 1)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label={t('recitation.toAyah')}>
              <Select
                value={range.toAyah}
                onChange={(event) =>
                  setRange((prev) => ({ ...prev, toAyah: Number(event.target.value) }))
                }
              >
                {Array.from({ length: selectedSurah?.ayahCount ?? 1 }, (_, index) => index + 1)
                  .filter((value) => value >= range.fromAyah)
                  .map((value) => (
                    <option key={value} value={value}>
                      {formatNumber(value)}
                    </option>
                  ))}
              </Select>
            </Field>
          </div>

          <Button size="lg" onClick={handleStart} icon="🎙" data-testid="start-recitation">
            {t('recitation.start')}
          </Button>

          <Alert variant="mock">{t('recitation.micHint')}</Alert>
        </Card>
      ) : null}

      {/* التسجيل */}
      {isRecording || isPaused || isAnalyzing ? (
        <div
          className={`mic${isRecording ? ' mic--active' : ''}${isPaused ? ' mic--paused' : ''}`}
        >
          <span className="mic__circle" aria-hidden="true">
            🎙
          </span>

          <p className="t-lg t-semibold" role="status" aria-live="polite">
            {isAnalyzing
              ? t('recitation.analyzing')
              : isPaused
                ? t('recitation.paused')
                : t('recitation.recording')}
          </p>

          <p className="mic__timer" aria-label={t('recitation.timer')}>
            {formatDuration(engine.elapsedSeconds)}
          </p>

          <div
            className="waveform"
            role="img"
            aria-label={`${t('recitation.waveform')} — ${t('recitation.waveformNote')}`}
          >
            {levels.slice(-40).map((level, index) => (
              <span
                key={index}
                className="waveform__bar"
                style={{ height: `${Math.max(6, level * 100)}%` }}
              />
            ))}
          </div>

          <p className="t-sm t-muted">
            {engine.range?.surahName} · {formatNumber(engine.range?.fromAyah ?? 0)}–
            {formatNumber(engine.range?.toAyah ?? 0)}
          </p>

          {!isAnalyzing ? (
            <div className="row row-3 row-wrap row-center">
              {isRecording ? (
                <Button variant="secondary" onClick={() => ai.pauseRecording()} icon="⏸">
                  {t('recitation.pause')}
                </Button>
              ) : (
                <Button variant="secondary" onClick={() => ai.resumeRecording()} icon="▶">
                  {t('recitation.resume')}
                </Button>
              )}
              <Button variant="danger" onClick={handleStop} icon="⏹" data-testid="stop-recitation">
                {t('recitation.stop')}
              </Button>
            </div>
          ) : (
            <p className="t-sm t-muted">{t('recitation.analyzingHint')}</p>
          )}
        </div>
      ) : null}

      {/* النتيجة */}
      {result && !isAnalyzing ? (
        <div className="stack-5" data-testid="recitation-result">
          <Card className="stack-5">
            <div className="row row-6 row-wrap" style={{ justifyContent: 'center' }}>
              <ProgressRing
                value={result.mastery}
                label={t('recitation.result.mastery')}
                color={
                  result.mastery >= 90
                    ? 'var(--success)'
                    : result.mastery >= 75
                      ? 'var(--brand-600)'
                      : 'var(--warning)'
                }
              />
              <div className="stack-2">
                <h2 className="t-xl t-semibold">{t('recitation.result.title')}</h2>
                <Badge
                  variant={
                    result.grade === 'excellent'
                      ? 'success'
                      : result.grade === 'good'
                        ? 'info'
                        : 'warning'
                  }
                >
                  {t(`recitation.result.${result.grade === 'needsWork' ? 'needsWork' : result.grade}`)}
                </Badge>
                <p className="t-sm t-muted">
                  {result.range.surahName} · {formatNumber(result.range.fromAyah)}–
                  {formatNumber(result.range.toAyah)}
                </p>
              </div>
            </div>

            <div className="grid grid-3">
              <Stat
                label={t('recitation.result.correctAyat')}
                value={formatNumber(result.correctAyat)}
                icon="✓"
              />
              <Stat
                label={t('recitation.result.needsReview')}
                value={formatNumber(result.needsReview)}
                icon="!"
              />
              <Stat
                label={t('recitation.result.duration')}
                value={formatDuration(result.durationSeconds)}
                icon="⏱"
              />
            </div>

            <div className="row row-3 row-wrap">
              <Button
                variant="secondary"
                onClick={() => setShowMistakes((prev) => !prev)}
                aria-expanded={showMistakes}
              >
                {showMistakes ? t('recitation.result.hideMistakes') : t('recitation.result.showMistakes')}
              </Button>
              <Button variant="ghost" onClick={handleRetry}>
                {t('recitation.result.retry')}
              </Button>
              <Button
                onClick={handleSave}
                status={saveStatus}
                loadingText={t('recitation.result.saving')}
                successText={t('recitation.result.saved')}
                data-testid="save-session"
              >
                {t('recitation.result.save')}
              </Button>
            </div>

            <Alert variant="mock" title={t('app.mockNotice')}>
              {t('recitation.result.mockNotice')}
            </Alert>
          </Card>

          {showMistakes ? (
            <Section title={t('recitation.result.mistakesTitle')} id="mistakes">
              {result.mistakes.length === 0 ? (
                <Card variant="quiet" className="t-center t-success t-medium">
                  ✓ {t('recitation.result.noMistakes')}
                </Card>
              ) : (
                <ul className="stack-2">
                  {result.mistakes.map((mistake) => (
                    <li key={mistake.id} className="mistake-row">
                      <span aria-hidden="true">!</span>
                      <div>
                        <p className="t-medium">
                          {t('quran.ayahLabel', { number: formatNumber(mistake.ayahNumber) })} ·{' '}
                          {t(`recitation.mistakeType.${mistake.type}`)}
                        </p>
                        {mistake.excerpt ? (
                          <p className="t-sm t-serif">{mistake.excerpt}…</p>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Section>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
