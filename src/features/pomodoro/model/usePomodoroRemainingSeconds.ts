import { useCallback, useEffect, useState } from 'react';

type PomodoroClockPrecision = 'second' | 'minute';

interface PomodoroRemainingSecondsOptions {
  endsAt: string | null;
  fallbackSeconds: number;
  isRunning: boolean;
  precision: PomodoroClockPrecision;
}

function calculateRemainingSeconds(endsAt: string | null, fallbackSeconds: number, isRunning: boolean) {
  if (!isRunning || !endsAt) return Math.max(0, fallbackSeconds);
  const endMs = new Date(endsAt).getTime();
  if (!Number.isFinite(endMs)) return Math.max(0, fallbackSeconds);
  return Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
}

export function usePomodoroRemainingSeconds({
  endsAt,
  fallbackSeconds,
  isRunning,
  precision,
}: PomodoroRemainingSecondsOptions) {
  const readRemainingSeconds = useCallback(
    () => calculateRemainingSeconds(endsAt, fallbackSeconds, isRunning),
    [endsAt, fallbackSeconds, isRunning],
  );
  const [remainingSeconds, setRemainingSeconds] = useState(readRemainingSeconds);

  useEffect(() => {
    let timeoutId: number | null = null;

    const clearScheduledTick = () => {
      if (timeoutId === null) return;
      window.clearTimeout(timeoutId);
      timeoutId = null;
    };

    const scheduleTick = () => {
      clearScheduledTick();
      const nextRemainingSeconds = readRemainingSeconds();
      setRemainingSeconds(current => current === nextRemainingSeconds ? current : nextRemainingSeconds);

      if (!isRunning || !endsAt || nextRemainingSeconds <= 0 || document.visibilityState !== 'visible') return;
      const endMs = new Date(endsAt).getTime();
      if (!Number.isFinite(endMs)) return;

      const unitMs = precision === 'second' ? 1_000 : 60_000;
      const remainingMs = Math.max(0, endMs - Date.now());
      const displayedUnits = Math.ceil(remainingMs / unitMs);
      const nextBoundaryMs = remainingMs - Math.max(0, displayedUnits - 1) * unitMs;
      timeoutId = window.setTimeout(scheduleTick, Math.max(50, nextBoundaryMs + 20));
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') scheduleTick();
      else clearScheduledTick();
    };

    scheduleTick();
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearScheduledTick();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [endsAt, isRunning, precision, readRemainingSeconds]);

  return remainingSeconds;
}
