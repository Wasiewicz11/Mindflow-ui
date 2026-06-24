import { POMODORO_PHASE_META, type PomodoroPhase } from './pomodoroModel';

let audioContext: AudioContext | null = null;

export async function primePomodoroNotifications() {
  try {
    const AudioContextClass = window.AudioContext;
    audioContext ??= new AudioContextClass();
    if (audioContext.state === 'suspended') await audioContext.resume();
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

function playCompletionChime() {
  try {
    const AudioContextClass = window.AudioContext;
    audioContext ??= new AudioContextClass();
    const now = audioContext.currentTime;

    [660, 880].forEach((frequency, index) => {
      const oscillator = audioContext!.createOscillator();
      const gain = audioContext!.createGain();
      const startsAt = now + index * 0.16;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startsAt);
      gain.gain.setValueAtTime(0.0001, startsAt);
      gain.gain.exponentialRampToValueAtTime(0.16, startsAt + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, startsAt + 0.32);
      oscillator.connect(gain);
      gain.connect(audioContext!.destination);
      oscillator.start(startsAt);
      oscillator.stop(startsAt + 0.34);
    });
  } catch {
    // A denied audio context must not interrupt session transitions.
  }
}

export function notifyPomodoroPhaseComplete(phase: PomodoroPhase, taskTitle: string) {
  playCompletionChime();

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

