export type PomodoroPhase = 'focus' | 'shortBreak' | 'longBreak';

export interface PomodoroSettings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  sessionsBeforeLongBreak: number;
  autoStartNextSession: boolean;
  soundVolume: number;
}

export interface PomodoroLaunchRequest {
  requestId: string;
  taskId?: string | null;
  title: string;
  taskEndsAt?: string;
}

export interface PomodoroScheduleItem {
  id: string;
  phase: PomodoroPhase;
  durationSeconds: number;
  startsAt: string;
  endsAt: string;
}

export interface PomodoroSession {
  version: 1;
  id: string;
  taskId?: string | null;
  title: string;
  taskEndsAt?: string;
  settings: PomodoroSettings;
  phase: PomodoroPhase;
  schedule: PomodoroScheduleItem[] | null;
  scheduleIndex: number;
  completedFocusSessions: number;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  isComplete: boolean;
  isMinimized: boolean;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  focusMinutes: 55,
  shortBreakMinutes: 5,
  longBreakMinutes: 15,
  sessionsBeforeLongBreak: 4,
  autoStartNextSession: false,
  soundVolume: 0.55,
};

export const POMODORO_PHASE_META: Record<PomodoroPhase, { label: string; shortLabel: string }> = {
  focus: { label: 'Skupienie', shortLabel: 'Focus' },
  shortBreak: { label: 'Krótka przerwa', shortLabel: 'Przerwa' },
  longBreak: { label: 'Długa przerwa', shortLabel: 'Długa przerwa' },
};

function phaseDurationSeconds(phase: PomodoroPhase, settings: PomodoroSettings) {
  if (phase === 'focus') return settings.focusMinutes * 60;
  if (phase === 'shortBreak') return settings.shortBreakMinutes * 60;
  return settings.longBreakMinutes * 60;
}

function nextDynamicPhase(session: PomodoroSession): { phase: PomodoroPhase; completedFocusSessions: number } {
  if (session.phase !== 'focus') {
    return { phase: 'focus', completedFocusSessions: session.completedFocusSessions };
  }

  const completedFocusSessions = session.completedFocusSessions + 1;
  const phase = completedFocusSessions % session.settings.sessionsBeforeLongBreak === 0
    ? 'longBreak'
    : 'shortBreak';
  return { phase, completedFocusSessions };
}

export function buildTaskSchedule(
  taskEndsAt: string,
  settings: PomodoroSettings,
  startsAtMs = Date.now(),
): PomodoroScheduleItem[] {
  const endMs = new Date(taskEndsAt).getTime();
  if (!Number.isFinite(endMs) || endMs <= startsAtMs) return [];

  const items: PomodoroScheduleItem[] = [];
  let cursorMs = startsAtMs;
  let completedFocusSessions = 0;
  let phase: PomodoroPhase = 'focus';

  while (cursorMs < endMs && items.length < 512) {
    const fullDurationSeconds = phaseDurationSeconds(phase, settings);
    const availableSeconds = Math.max(1, Math.ceil((endMs - cursorMs) / 1000));
    const durationSeconds = Math.min(fullDurationSeconds, availableSeconds);
    const itemEndMs = Math.min(endMs, cursorMs + durationSeconds * 1000);

    items.push({
      id: `${items.length}-${phase}-${cursorMs}`,
      phase,
      durationSeconds,
      startsAt: new Date(cursorMs).toISOString(),
      endsAt: new Date(itemEndMs).toISOString(),
    });

    cursorMs = itemEndMs;
    if (cursorMs >= endMs) break;

    if (phase === 'focus') {
      completedFocusSessions += 1;
      phase = completedFocusSessions % settings.sessionsBeforeLongBreak === 0 ? 'longBreak' : 'shortBreak';
    } else {
      phase = 'focus';
    }
  }

  return items;
}

export function createPomodoroSession(
  request: PomodoroLaunchRequest,
  settings: PomodoroSettings,
  nowMs = Date.now(),
): PomodoroSession {
  const schedule = request.taskEndsAt ? buildTaskSchedule(request.taskEndsAt, settings, nowMs) : [];
  const firstItem = schedule[0];
  const totalSeconds = firstItem?.durationSeconds ?? settings.focusMinutes * 60;
  const nowIso = new Date(nowMs).toISOString();

  return {
    version: 1,
    id: request.requestId,
    taskId: request.taskId,
    title: request.title,
    taskEndsAt: request.taskEndsAt,
    settings: { ...settings },
    phase: firstItem?.phase ?? 'focus',
    schedule: schedule.length > 0 ? schedule : null,
    scheduleIndex: 0,
    completedFocusSessions: 0,
    totalSeconds,
    remainingSeconds: totalSeconds,
    isRunning: false,
    isComplete: false,
    isMinimized: false,
    endsAt: null,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export function advancePomodoroSession(
  session: PomodoroSession,
  transitionAtMs: number,
  shouldRun: boolean,
): PomodoroSession {
  const updatedAt = new Date(transitionAtMs).toISOString();

  if (session.schedule) {
    const nextIndex = session.scheduleIndex + 1;
    const nextItem = session.schedule[nextIndex];
    const completedFocusSessions = session.completedFocusSessions + (session.phase === 'focus' ? 1 : 0);

    if (!nextItem) {
      return {
        ...session,
        completedFocusSessions,
        remainingSeconds: 0,
        isRunning: false,
        isComplete: true,
        endsAt: null,
        updatedAt,
      };
    }

    return {
      ...session,
      phase: nextItem.phase,
      scheduleIndex: nextIndex,
      completedFocusSessions,
      totalSeconds: nextItem.durationSeconds,
      remainingSeconds: nextItem.durationSeconds,
      isRunning: shouldRun,
      isComplete: false,
      endsAt: shouldRun ? new Date(transitionAtMs + nextItem.durationSeconds * 1000).toISOString() : null,
      updatedAt,
    };
  }

  const next = nextDynamicPhase(session);
  const durationSeconds = phaseDurationSeconds(next.phase, session.settings);
  const cycleLength = session.settings.sessionsBeforeLongBreak * 2;
  return {
    ...session,
    phase: next.phase,
    scheduleIndex: (session.scheduleIndex + 1) % cycleLength,
    completedFocusSessions: next.completedFocusSessions,
    totalSeconds: durationSeconds,
    remainingSeconds: durationSeconds,
    isRunning: shouldRun,
    isComplete: false,
    endsAt: shouldRun ? new Date(transitionAtMs + durationSeconds * 1000).toISOString() : null,
    updatedAt,
  };
}

export function reconcilePomodoroSession(session: PomodoroSession, nowMs = Date.now()): PomodoroSession {
  if (!session.isRunning || !session.endsAt || session.isComplete) return session;

  let current = session;
  let endMs = new Date(session.endsAt).getTime();
  if (!Number.isFinite(endMs)) {
    return { ...current, isRunning: false, endsAt: null };
  }

  if (endMs > nowMs) {
    return {
      ...current,
      remainingSeconds: Math.max(1, Math.ceil((endMs - nowMs) / 1000)),
      updatedAt: new Date(nowMs).toISOString(),
    };
  }

  while (endMs <= nowMs && !current.isComplete) {
    current = advancePomodoroSession(current, endMs, current.settings.autoStartNextSession);
    if (!current.settings.autoStartNextSession || current.isComplete || !current.endsAt) return current;
    endMs = new Date(current.endsAt).getTime();
  }

  if (current.endsAt) {
    const currentEndMs = new Date(current.endsAt).getTime();
    current = {
      ...current,
      remainingSeconds: Math.max(1, Math.ceil((currentEndMs - nowMs) / 1000)),
      updatedAt: new Date(nowMs).toISOString(),
    };
  }

  return current;
}

export function formatPomodoroTime(seconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainingSeconds = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}
