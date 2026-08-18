import { useEffect, useState } from 'react';
import { useT } from '../../i18n/index.jsx';
import * as audioService from '../../services/audioService.js';
import { formatDuration } from '../../lib/format.js';
import Button, { IconButton } from '../ui/Button.jsx';
import Alert from '../ui/Alert.jsx';

/**
 * مشغّل تلاوة (محاكاة).
 * كل حالة صوتية مصحوبة بنص مرئي، وكل عنصر تحكم قابل للاستخدام بالكيبورد.
 */
export default function AudioPlayer({ trackLabel, reciterName }) {
  const t = useT();
  const [state, setState] = useState(audioService.getState());

  useEffect(() => audioService.subscribe(setState), []);
  useEffect(() => () => audioService.reset(), []);

  const isPlaying = state.status === 'playing';

  const statusText =
    state.status === 'playing'
      ? t('quran.playing')
      : state.status === 'paused'
        ? t('quran.paused')
        : state.status === 'ended'
          ? t('common.no')
          : t('quran.recite');

  return (
    <div className="stack-3">
      <div className="row row-3 row-wrap">
        <Button
          onClick={() => (isPlaying ? audioService.pause() : audioService.play({ trackLabel }))}
          icon={isPlaying ? '⏸' : '▶'}
        >
          {isPlaying ? t('quran.pause') : t('quran.play')}
        </Button>

        <IconButton label={t('quran.stop')} bordered onClick={() => audioService.stop()}>
          ⏹
        </IconButton>

        <span className="tnum t-sm t-muted" style={{ direction: 'ltr' }}>
          {formatDuration(state.position)} / {formatDuration(state.duration)}
        </span>

        {reciterName ? <span className="t-sm t-muted">{reciterName}</span> : null}
      </div>

      <label className="stack-1">
        <span className="t-xs t-muted">{t('quran.seek')}</span>
        <input
          type="range"
          min={0}
          max={state.duration}
          value={state.position}
          onChange={(event) => audioService.seek(event.target.value)}
          aria-label={t('quran.seek')}
          aria-valuetext={formatDuration(state.position)}
          style={{ width: '100%', accentColor: 'var(--brand-600)' }}
        />
      </label>

      <label className="stack-1">
        <span className="t-xs t-muted">{t('quran.volume')}</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={state.volume}
          onChange={(event) => audioService.setVolume(event.target.value)}
          aria-label={t('quran.volume')}
          style={{ width: '160px', accentColor: 'var(--brand-600)' }}
        />
      </label>

      {/* بديل بصري دائم لأي معلومة صوتية */}
      <p className="t-sm" role="status" aria-live="polite">
        <strong>{statusText}</strong>
      </p>

      <Alert variant="mock">{t('quran.audioNote')}</Alert>
    </div>
  );
}
