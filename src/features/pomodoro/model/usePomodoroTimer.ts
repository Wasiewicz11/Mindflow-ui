import { useCallback, useEffect, useRef, useState } from 'react';
import {
  advancePomodoroSession,
  createGlobalPomodoroSession,
  createPomodoroSession,
  reconcilePomodoroSession,
  type PomodoroLaunchRequest,
  type PomodoroSession,
  type PomodoroSettings,
} from './pomodoroModel';
import { notifyPomodoroPhaseComplete, primePomodoroNotifications } from './pomodoroNotifications';
import { loadPomodoroSession, savePomodoroSession } from './pomodoroStorage';
import { deletePomodoroSession, upsertPomodoroSession } from '../api/pomodoroApi';

export function usePomodoroTimer(
  settings: PomodoroSettings,
  launchRequest: PomodoroLaunchRequest | null,
) {
  const [session, setSession] = useState<PomodoroSession | null>(loadPomodoroSession);
  const handledRequestRef = useRef<string | null>(null);
  const completingKeyRef = useRef<string | null>(null);
  const remoteSignatureRef = useRef<string | null>(null);
  const hasPublishedRemoteSessionRef = useRef(false);
  const remoteRetryAfterRef = useRef(0);
  const remoteSyncQueueRef = useRef<Promise<void>>(Promise.resolve());
  const settingsRef = useRef(settings);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    savePomodoroSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) {
      if (!hasPublishedRemoteSessionRef.current) return;
      hasPublishedRemoteSessionRef.current = false;
      remoteSignatureRef.current = null;
      remoteSyncQueueRef.current = remoteSyncQueueRef.current
        .catch(() => undefined)
        .then(() => deletePomodoroSession())
        .catch(error => console.warn('Failed to clear remote Pomodoro session', error));
      return;
    }

    if (session.isComplete) {
      hasPublishedRemoteSessionRef.current = false;
      remoteSignatureRef.current = null;
      remoteSyncQueueRef.current = remoteSyncQueueRef.current
        .catch(() => undefined)
        .then(() => deletePomodoroSession())
        .catch(error => console.warn('Failed to clear completed remote Pomodoro session', error));
      return;
    }

    const signature = JSON.stringify({
      id: session.id,
      taskId: session.taskId,
      title: session.title,
      phase: session.phase,
      totalSeconds: session.totalSeconds,
      remainingSeconds: session.isRunning ? null : session.remainingSeconds,
      isRunning: session.isRunning,
      endsAt: session.endsAt,
    });
    if (signature === remoteSignatureRef.current) return;
    if (Date.now() < remoteRetryAfterRef.current) return;

    remoteSignatureRef.current = signature;
    hasPublishedRemoteSessionRef.current = true;
    remoteSyncQueueRef.current = remoteSyncQueueRef.current
      .catch(() => undefined)
      .then(() => upsertPomodoroSession(session))
      .then(() => undefined)
      .catch(error => {
        console.warn('Failed to sync Pomodoro session', error);
        if (remoteSignatureRef.current === signature) remoteSignatureRef.current = null;
        remoteRetryAfterRef.current = Date.now() + 30_000;
      });
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
    const endMs = new Date(session.endsAt).getTime();
    if (!Number.isFinite(endMs)) return;

    let timeoutId: number | null = null;
    const completePhase = () => {
      const remainingMs = endMs - Date.now();
      if (remainingMs > 0) {
        timeoutId = window.setTimeout(completePhase, remainingMs + 20);
        return;
      }
      if (completingKeyRef.current === completionKey) return;

      completingKeyRef.current = completionKey;
      notifyPomodoroPhaseComplete(session.phase, session.title, settingsRef.current.soundVolume);
      setSession(current => {
        if (!current || current.id !== session.id || current.endsAt !== session.endsAt) return current;
        return reconcilePomodoroSession(current);
      });
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && Date.now() >= endMs) completePhase();
    };

    timeoutId = window.setTimeout(completePhase, Math.max(0, endMs - Date.now()) + 20);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      if (timeoutId !== null) window.clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
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

  const startGlobalCycle = useCallback((focusSessionCount: number) => {
    void primePomodoroNotifications();
    const nowMs = Date.now();
    const nowIso = new Date(nowMs).toISOString();
    setSession(current => {
      if (current && !current.isComplete) return current;

      const nextSession = createGlobalPomodoroSession(settingsRef.current, focusSessionCount, nowMs);
      return {
        ...nextSession,
        isRunning: true,
        endsAt: nextSession.schedule?.[0]?.endsAt ?? new Date(nowMs + nextSession.remainingSeconds * 1000).toISOString(),
        updatedAt: nowIso,
      };
    });
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
    startGlobalCycle,
    setMinimized,
    stop,
  };
}
