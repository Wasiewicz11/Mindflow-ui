import { useEffect, useMemo, useState } from 'react';
import { getCalendarBlocks } from '../api/calendarApi';
import type { Task } from '../../../shared/types';

export interface AgendaItem {
  id: string;
  title: string;
  start: Date;
  end: Date;
}

export interface TodayAgenda {
  now: Date;
  current: AgendaItem | null;
  next: AgendaItem | null;
}

interface RawBlock {
  id: string;
  taskId: string | null;
  title: string | null;
  start: Date;
  end: Date;
}

function dateKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function useTodayCalendar(enabled: boolean, tasks: Task[]): TodayAgenda {
  const [blocks, setBlocks] = useState<RawBlock[]>([]);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let intervalId: number | undefined;
    const tick = () => setNow(new Date());
    const current = new Date();
    const msToNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      tick();
      intervalId = window.setInterval(tick, 60_000);
    }, Math.max(msToNextMinute, 250));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  const dayKey = dateKey(now);

  useEffect(() => {
    if (!enabled) {
      void Promise.resolve().then(() => setBlocks([]));
      return;
    }
    let cancelled = false;

    const load = () => {
      getCalendarBlocks(dayKey, dayKey)
        .then(apiBlocks => {
          if (cancelled) return;
          setBlocks(apiBlocks.map(block => {
            const start = new Date(block.startAt);
            return {
              id: block.id,
              taskId: block.taskId ?? null,
              title: block.title ?? null,
              start,
              end: new Date(start.getTime() + block.durationMinutes * 60_000),
            };
          }));
        })
        .catch(error => console.error('Failed to load today calendar', error));
    };

    load();
    const intervalId = window.setInterval(load, 120_000);
    window.addEventListener('focus', load);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', load);
    };
  }, [enabled, dayKey]);

  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task.content])), [tasks]);

  return useMemo(() => {
    const resolve = (block: RawBlock): AgendaItem => ({
      id: block.id,
      title: (block.taskId && taskById.get(block.taskId)) || block.title || 'Blok czasu',
      start: block.start,
      end: block.end,
    });

    const t = now.getTime();
    const current = blocks.find(block => block.start.getTime() <= t && t < block.end.getTime());
    const next = blocks
      .filter(block => block.start.getTime() > t)
      .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

    return {
      now,
      current: current ? resolve(current) : null,
      next: next ? resolve(next) : null,
    };
  }, [blocks, now, taskById]);
}
