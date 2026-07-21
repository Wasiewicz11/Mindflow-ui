import { useEffect, useRef } from 'react';
import type { AgendaItem } from './useTodayCalendar';

const START_SOON_MIN = 10;
const END_SOON_MIN = 15;

export function useBlockNotifications(enabled: boolean, items: AgendaItem[], now: Date) {
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const fired = firedRef.current;
    const t = now.getTime();

    const fire = (key: string, title: string, body: string) => {
      if (fired.has(key)) return;
      fired.add(key);
      try {
        new Notification(title, { body, tag: key, icon: '/mindle_mark_black.svg' });
      } catch {
        // ignore — np. brak wsparcia w danej przeglądarce
      }
    };

    for (const item of items) {
      const minsToStart = Math.round((item.start.getTime() - t) / 60_000);
      const minsToEnd = Math.round((item.end.getTime() - t) / 60_000);

      if (minsToStart >= 1 && minsToStart <= START_SOON_MIN) {
        fire(`${item.id}:start-soon`, 'Nadchodzący blok', `Za ${minsToStart} min zaczyna się „${item.title}”`);
      }
      if (minsToStart <= 0 && minsToStart >= -1) {
        fire(`${item.id}:start`, 'Start bloku', `Zaczyna się „${item.title}”`);
      }
      if (minsToEnd >= 1 && minsToEnd <= END_SOON_MIN) {
        fire(`${item.id}:end-soon`, 'Blok się kończy', `Za ${minsToEnd} min kończy się „${item.title}”`);
      }
    }
  }, [enabled, items, now]);
}
