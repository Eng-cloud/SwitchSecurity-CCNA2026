/**
 * محاكاة مشغّل التلاوة (بدون ملفات صوتية).
 * كل حالة صوتية لها مقابل بصري في الواجهة، فلا تعتمد أي معلومة على الصوت وحده.
 */

const DEFAULT_DURATION = 96; // ثانية

let state = {
  status: 'idle', // idle | playing | paused | ended
  position: 0,
  duration: DEFAULT_DURATION,
  volume: 0.8,
  trackLabel: '',
};

const listeners = new Set();
let ticker = null;

function emit() {
  const snapshot = { ...state };
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch {
      /* تجاهل */
    }
  });
}

export function subscribe(listener) {
  listeners.add(listener);
  listener({ ...state });
  return () => listeners.delete(listener);
}

export function getState() {
  return { ...state };
}

function stopTicker() {
  if (ticker) {
    clearInterval(ticker);
    ticker = null;
  }
}

export function play({ trackLabel, duration } = {}) {
  if (trackLabel && trackLabel !== state.trackLabel) {
    state.position = 0;
    state.trackLabel = trackLabel;
    state.duration = duration ?? DEFAULT_DURATION;
  }
  state.status = 'playing';
  stopTicker();
  ticker = setInterval(() => {
    state.position += 1;
    if (state.position >= state.duration) {
      state.position = state.duration;
      state.status = 'ended';
      stopTicker();
    }
    emit();
  }, 1000);
  emit();
  return getState();
}

export function pause() {
  if (state.status !== 'playing') return getState();
  state.status = 'paused';
  stopTicker();
  emit();
  return getState();
}

export function stop() {
  stopTicker();
  state.status = 'idle';
  state.position = 0;
  emit();
  return getState();
}

export function seek(position) {
  const next = Math.max(0, Math.min(state.duration, Number(position) || 0));
  state.position = next;
  if (state.status === 'ended' && next < state.duration) state.status = 'paused';
  emit();
  return getState();
}

export function setVolume(volume) {
  state.volume = Math.max(0, Math.min(1, Number(volume)));
  emit();
  return getState();
}

export function reset() {
  stopTicker();
  state = {
    status: 'idle',
    position: 0,
    duration: DEFAULT_DURATION,
    volume: state.volume,
    trackLabel: '',
  };
  emit();
  return getState();
}
