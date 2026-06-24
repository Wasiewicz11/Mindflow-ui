import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advancePomodoroSession,
  createPomodoroSession,
  reconcilePomodoroSession,
  type PomodoroLaunchRequest,
  type PomodoroSession,
  type PomodoroSettings,
} from './pomodoroModel';
import { notifyPomodoroPhaseComplete, primePomodoroNotifications } from './pomodoroNotifications';
import { loadPomodoroSession, savePomodoroSession } from './pomodoroStorage';

export function usePomodoroTimer(
  settings: PomodoroSettings,
  launchRequest: PomodoroLaunchRequest | null,
) {
  const [session, setSession] = useState<PomodoroSession | null>(loadPomodoroSession);
  const handledRequestRef = useRef<string | null>(null);
  const completingKeyRef = useRef<string | null>(null);

  useEffect(() => {
    savePomodoroSession(session);
  }, [session]);

  useEffect(() => {
    if (!launchRequest || handledRequestRef.current === launchRequest.requestId) return;
    handledRequestRef.current = launchRequest.requestId;

    setSession(current => {
      if (current && !current.isComplete) {
        const opensExistingTaskSession = Boolean(
          launchRequest.taskId && current.taskId === launchRequest.taskId,
        );
        if (opensExistingTaskSession) {
          return { ...current, isMinimized: false, updatedAt: new Date().toISOString() };
        }

        const replace = window.confirm('Masz już aktywną sesję Pomodoro. Czy chcesz rozpocząć nową?');
        if (!replace) return { ...current, isMinimized: false };
      }
      return createPomodoroSession(launchRequest, settings);
    });
  }, [launchRequest, settings]);

  useEffect(() => {
    if (!session?.isRunning || !session.endsAt || session.isComplete) return;

    const completionKey = `${session.id}-${session.scheduleIndex}-${session.phase}-${session.endsAt}`;
    const tick = () => {
      const endMs = new Date(session.endsAt!).getTime();
      const remainingSeconds = Math.max(0, Math.ceil((endMs - Date.now()) / 1000));

      if (remainingSeconds > 0) {
        setSession(current => {
          if (!current || current.id !== session.id || current.remainingSeconds === remainingSeconds) return current;
          return { ...current, remainingSeconds, updatedAt: new Date().toISOString() };
        });
        return;
      }

      if (completingKeyRef.current === completionKey) return;
      completingKeyRef.current = completionKey;
      notifyPomodoroPhaseComplete(session.phase, session.title);
      setSession(current => current ? reconcilePomodoroSession(current) : null);
    };

    tick();
    const intervalId = window.setInterval(tick, 250);
    return () => window.clearInterval(intervalId);
  }, [session?.endsAt, session?.id, session?.isComplete, session?.isRunning, session?.phase, session?.scheduleIndex, session?.title]);

  const start = useCallback(() => {
    void primePomodoroNotifications();
    const nowMs = Date.now();
    setSession(current => {
      if (!current || current.isComplete || current.isRunning) return current;
      return {
        ...current,
        isRunning: true,
        endsAt: new Date(nowMs + current.remainingSeconds * 1000).toISOString(),
        updatedAt: new Date(nowMs).toISOString(),
      };
    });
  }, []);

  const pause = useCallback(() => {
    const nowMs = Date.now();
    setSession(current => {
      if (!current?.isRunning || !current.endsAt) return current;
      const remainingSeconds = Math.max(0, Math.ceil((new Date(current.endsAt).getTime() - nowMs) / 1000));
      return {
        ...current,
        remainingSeconds,
        isRunning: false,
        endsAt: null,
        updatedAt: new Date(nowMs).toISOString(),
      };
    });
  }, []);

  const resetPhase = useCallback(() => {
    const nowIso = new Date().toISOString();
    setSession(current => current ? {
      ...current,
      remainingSeconds: current.totalSeconds,
      isRunning: false,
      isComplete: false,
      endsAt: null,
      updatedAt: nowIso,
    } : null);
  }, []);

  const skip = useCallback(() => {
    const nowMs = Date.now();
    setSession(current => current ? advancePomodoroSession(current, nowMs, current.settings.autoStartNextSession) : null);
  }, []);

  const setMinimized = useCallback((isMinimized: boolean) => {
    setSession(current => current ? { ...current, isMinimized, updatedAt: new Date().toISOString() } : null);
  }, []);

  const stop = useCallback(() => setSession(null), []);

  return {
    session,
    start,
    pause,
    resetPhase,
    skip,
    setMinimized,
    stop,
  };
}
