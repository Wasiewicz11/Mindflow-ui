import { apiFetch } from '../../../shared/api/client';
import type { PomodoroSession, PomodoroPhase } from '../model/pomodoroModel';

export type ApiPomodoroPhase = 'Focus' | 'ShortBreak' | 'LongBreak';

export interface ApiPomodoroSession {
  id: string;
  taskId?: string | null;
  title: string;
  phase: ApiPomodoroPhase;
  totalSeconds: number;
  remainingSeconds: number;
  isRunning: boolean;
  endsAt?: string | null;
  updatedAt: string;
}

const API_PHASE: Record<PomodoroPhase, ApiPomodoroPhase> = {
  focus: 'Focus',
  shortBreak: 'ShortBreak',
  longBreak: 'LongBreak',
};

export function upsertPomodoroSession(session: PomodoroSession): Promise<ApiPomodoroSession> {
  return apiFetch<ApiPomodoroSession>('/pomodoro/session', {
    method: 'PUT',
    body: JSON.stringify({
      taskId: session.taskId ?? null,
      title: session.title,
      phase: API_PHASE[session.phase],
      totalSeconds: session.totalSeconds,
      remainingSeconds: session.remainingSeconds,
      isRunning: session.isRunning,
      endsAt: session.isRunning ? session.endsAt : null,
    }),
  });
}

export function deletePomodoroSession(): Promise<void> {
  return apiFetch<void>('/pomodoro/session', { method: 'DELETE' });
}
