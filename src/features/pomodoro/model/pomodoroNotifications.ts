import { POMODORO_PHASE_META, type PomodoroPhase } from './pomodoroModel';

let audioContext: AudioContext | null = null;
const SILENT_GAIN = 0.0001;

export async function primePomodoroNotifications() {
  try {
    await getAudioContext();
  } catch {
    // Audio is optional and may be blocked by the browser.
  }

  if ('Notification' in window && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch {
      // The visual timer remains the source of truth when notifications are blocked.
    }
  }
}

function clampVolume(volume: number) {
  if (!Number.isFinite(volume)) return 0.55;
  return Math.min(1, Math.max(0, volume));
}

async function getAudioContext() {
  const AudioContextClass = window.AudioContext;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === 'suspended') await audioContext.resume();
  return audioContext;
}

function scheduleBell(
  context: AudioContext,
  startsAt: number,
  {
    duration,
    frequency,
    partials,
    peakGain,
  }: {
    duration: number;
    frequency: number;
    partials: Array<{ ratio: number; gain: number; detune?: number }>;
    peakGain: number;
  },
  volume: number,
) {
  const safeVolume = clampVolume(volume);
  if (safeVolume <= 0) return;

  const filter = context.createBiquadFilter();
  const master = context.createGain();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(4200, startsAt);
  filter.Q.setValueAtTime(0.55, startsAt);
  master.gain.setValueAtTime(1, startsAt);
  filter.connect(master);
  master.connect(context.destination);

  partials.forEach(partial => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const peak = Math.max(SILENT_GAIN, peakGain * safeVolume * partial.gain);

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency * partial.ratio, startsAt);
    if (partial.detune) oscillator.detune.setValueAtTime(partial.detune, startsAt);

    gain.gain.setValueAtTime(SILENT_GAIN, startsAt);
    gain.gain.exponentialRampToValueAtTime(peak, startsAt + 0.025);
    gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, startsAt + duration);

    oscillator.connect(gain);
    gain.connect(filter);
    oscillator.start(startsAt);
    oscillator.stop(startsAt + duration + 0.05);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  });

  window.setTimeout(() => {
    filter.disconnect();
    master.disconnect();
  }, Math.ceil((startsAt - context.currentTime + duration + 0.1) * 1000));
}

export async function playPomodoroFocusCompleteSound(volume: number) {
  try {
    const context = await getAudioContext();
    const startsAt = context.currentTime + 0.02;
    scheduleBell(context, startsAt, {
      duration: 2.45,
      frequency: 523.25,
      peakGain: 0.17,
      partials: [
        { ratio: 1, gain: 1 },
        { ratio: 1.505, gain: 0.34, detune: -3 },
        { ratio: 2.01, gain: 0.28 },
        { ratio: 2.98, gain: 0.12, detune: 4 },
      ],
    }, volume);
  } catch {
    // A denied audio context must not interrupt session transitions.
  }
}

export async function playPomodoroBreakCompleteSound(volume: number) {
  try {
    const context = await getAudioContext();
    const startsAt = context.currentTime + 0.02;
    const bell = {
      duration: 0.58,
      frequency: 783.99,
      peakGain: 0.13,
      partials: [
        { ratio: 1, gain: 1 },
        { ratio: 2.02, gain: 0.3, detune: 2 },
        { ratio: 3.01, gain: 0.12, detune: -4 },
      ],
    };
    scheduleBell(context, startsAt, bell, volume);
    scheduleBell(context, startsAt + 0.68, bell, volume);
  } catch {
    // A denied audio context must not interrupt session transitions.
  }
}

export function previewPomodoroSound(kind: 'focusComplete' | 'breakComplete', volume: number) {
  return kind === 'focusComplete'
    ? playPomodoroFocusCompleteSound(volume)
    : playPomodoroBreakCompleteSound(volume);
}

function playPhaseCompleteSound(phase: PomodoroPhase, volume: number) {
  return phase === 'focus'
    ? playPomodoroFocusCompleteSound(volume)
    : playPomodoroBreakCompleteSound(volume);
}

export function notifyPomodoroPhaseComplete(phase: PomodoroPhase, taskTitle: string, volume: number) {
  void playPhaseCompleteSound(phase, volume);

  if ('Notification' in window && Notification.permission === 'granted' && document.visibilityState !== 'visible') {
    try {
      new Notification(`${POMODORO_PHASE_META[phase].label} zakończone`, {
        body: taskTitle,
        icon: '/mindle_mark_black.svg',
        tag: 'mindflow-pomodoro',
      });
    } catch {
      // Some browsers expose Notification but do not allow constructing one here.
    }
  }
}
