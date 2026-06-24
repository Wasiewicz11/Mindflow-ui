import {
  DEFAULT_POMODORO_SETTINGS,
  reconcilePomodoroSession,
  type PomodoroSession,
  type PomodoroSettings,
} from './pomodoroModel';

const SETTINGS_KEY = 'mindflow_pomodoro_settings_v1';
const SESSION_KEY = 'mindflow_pomodoro_session_v1';

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function normalizePomodoroSettings(value: Partial<PomodoroSettings> | null | undefined): PomodoroSettings {
  return {
    focusMinutes: boundedInteger(value?.focusMinutes, DEFAULT_POMODORO_SETTINGS.focusMinutes, 1, 180),
    shortBreakMinutes: boundedInteger(value?.shortBreakMinutes, DEFAULT_POMODORO_SETTINGS.shortBreakMinutes, 1, 60),
    longBreakMinutes: boundedInteger(value?.longBreakMinutes, DEFAULT_POMODORO_SETTINGS.longBreakMinutes, 1, 120),
    sessionsBeforeLongBreak: boundedInteger(
      value?.sessionsBeforeLongBreak,
      DEFAULT_POMODORO_SETTINGS.sessionsBeforeLongBreak,
      2,
      12,
    ),
    autoStartNextSession: typeof value?.autoStartNextSession === 'boolean'
      ? value.autoStartNextSession
      : DEFAULT_POMODORO_SETTINGS.autoStartNextSession,
  };
}

export function loadPomodoroSettings(): PomodoroSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_POMODORO_SETTINGS;
    return normalizePomodoroSettings(JSON.parse(raw) as Partial<PomodoroSettings>);
  } catch {
    return DEFAULT_POMODORO_SETTINGS;
  }
}

export function savePomodoroSettings(settings: PomodoroSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(normalizePomodoroSettings(settings)));
  } catch {
    // The timer still works when storage is unavailable (for example in private mode).
  }
}

function isPomodoroSession(value: unknown): value is PomodoroSession {
  if (!value || typeof value !== 'object') return false;
  const session = value as Partial<PomodoroSession>;
  const validPhase = session.phase === 'focus' || session.phase === 'shortBreak' || session.phase === 'longBreak';
  return session.version === 1
    && typeof session.id === 'string'
    && typeof session.title === 'string'
    && validPhase
    && typeof session.remainingSeconds === 'number' && Number.isFinite(session.remainingSeconds)
    && typeof session.totalSeconds === 'number' && Number.isFinite(session.totalSeconds) && session.totalSeconds > 0
    && typeof session.scheduleIndex === 'number' && session.scheduleIndex >= 0
    && (session.schedule === null || Array.isArray(session.schedule))
    && typeof session.isRunning === 'boolean'
    && typeof session.isComplete === 'boolean'
    && !!session.settings;
}

export function loadPomodoroSession(): PomodoroSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isPomodoroSession(parsed)) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }

    const normalized: PomodoroSession = {
      ...parsed,
      settings: normalizePomodoroSettings(parsed.settings),
      isMinimized: Boolean(parsed.isMinimized),
    };
    return reconcilePomodoroSession(normalized);
  } catch {
    return null;
  }
}

export function savePomodoroSession(session: PomodoroSession | null) {
  try {
    if (!session) {
      localStorage.removeItem(SESSION_KEY);
      return;
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    // Persistence is best-effort; the in-memory timer remains available.
  }
}
