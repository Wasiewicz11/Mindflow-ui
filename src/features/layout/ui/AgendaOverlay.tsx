import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Clock } from 'lucide-react';
import { useTodayCalendar } from '../../tasks/model/useTodayCalendar';
import type { Task } from '../../../shared/types';

export type AgendaPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

interface AgendaOverlayProps {
  enabled: boolean;
  tasks: Task[];
  position: AgendaPosition;
}

const COLLAPSED_KEY = 'mindflow_agenda_collapsed';

const POSITIONS: Record<AgendaPosition, { card: string; tab: string; edge: 'left' | 'right' }> = {
  'bottom-right': { card: 'bottom-5 right-5', tab: 'bottom-5 right-0', edge: 'right' },
  'bottom-left': { card: 'bottom-5 left-5', tab: 'bottom-5 left-0', edge: 'left' },
  'top-right': { card: 'top-5 right-5', tab: 'top-5 right-0', edge: 'right' },
  'top-left': { card: 'top-5 left-5', tab: 'top-5 left-0', edge: 'left' },
};

function clockLabel(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function remainingLabel(minutes: number) {
  const total = Math.max(0, minutes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function untilLabel(minutes: number) {
  const total = Math.max(0, minutes);
  if (total < 60) return `za ${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m ? `za ${h} godz. ${m} min` : `za ${h} godz.`;
}

export function AgendaOverlay({ enabled, tasks, position }: AgendaOverlayProps) {
  const { now, current, next } = useTodayCalendar(enabled, tasks);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSED_KEY) === '1');

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  if (!enabled) return null;

  const pos = POSITIONS[position];
  const isRight = pos.edge === 'right';

  const remainingMinutes = current ? Math.max(0, Math.round((current.end.getTime() - now.getTime()) / 60_000)) : 0;
  const progress = current
    ? Math.min(100, Math.max(0, ((now.getTime() - current.start.getTime()) / (current.end.getTime() - current.start.getTime())) * 100))
    : 0;
  const untilMinutes = next ? Math.round((next.start.getTime() - now.getTime()) / 60_000) : 0;

  const cardSlideOut = isRight ? 'translateX(calc(100% + 28px))' : 'translateX(calc(-100% - 28px))';
  const tabHidden = isRight ? 'translateX(100%)' : 'translateX(-100%)';

  const overlay = (
    <div className="hidden lg:block">
      <div
        className={`fixed z-40 ${pos.card} transition-[transform,opacity] duration-300 ease`}
        style={{
          transform: collapsed ? cardSlideOut : 'translateX(0)',
          opacity: collapsed ? 0 : 1,
          pointerEvents: collapsed ? 'none' : 'auto',
        }}
      >
        <div className="w-[268px] overflow-hidden rounded-2xl border border-[#e8e8e4] bg-white/95 shadow-[0_14px_36px_-14px_rgba(15,17,21,.28)] backdrop-blur dark:border-white/10 dark:bg-[#1C1C1E]/95">
          <div className="flex items-center justify-between px-3.5 pt-3 pb-2">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9098a4]">Teraz</span>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Zwiń"
              className="flex h-6 w-6 items-center justify-center rounded-md text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] dark:hover:bg-white/8 dark:hover:text-white"
            >
              {isRight ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
            </button>
          </div>

          <div className="px-3.5 pb-3">
            {current ? (
              <>
                <p className="truncate text-[13px] font-semibold text-[#0f1115] dark:text-white">{current.title}</p>
                <div className="mt-1 flex items-center gap-1.5 text-[11.5px] text-[#5a606b] dark:text-gray-400">
                  <Clock size={12} className="flex-none" />
                  <span className="tabular-nums">Zostało {remainingLabel(remainingMinutes)}</span>
                  <span className="text-[#c0c5cc] dark:text-white/25">·</span>
                  <span className="tabular-nums">do {clockLabel(current.end)}</span>
                </div>
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#f1f0ed] dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-[#0f1115] transition-[width] duration-500 ease dark:bg-white/80"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-[#9098a4]">Brak aktywnego bloku</p>
            )}
          </div>

          <div className="border-t border-[#f1f0ed] px-3.5 py-2.5 dark:border-white/8">
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9098a4]">Następne</span>
            {next ? (
              <>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <p className="truncate text-[12.5px] font-medium text-[#0f1115] dark:text-gray-100">{next.title}</p>
                  <span className="flex-none tabular-nums text-[11.5px] text-[#5a606b] dark:text-gray-400">{clockLabel(next.start)}</span>
                </div>
                <p className="mt-0.5 text-[11px] text-[#9098a4]">{untilLabel(untilMinutes)}</p>
              </>
            ) : (
              <p className="mt-1 text-[12px] text-[#9098a4]">Nic więcej dziś</p>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setCollapsed(false)}
        aria-label="Rozwiń przegląd dnia"
        className={`fixed z-40 ${pos.tab} flex items-center gap-1.5 border border-[#e8e8e4] bg-white/95 px-2.5 py-2 shadow-[0_10px_28px_-14px_rgba(15,17,21,.3)] backdrop-blur transition-[transform,opacity,background-color] duration-300 ease hover:bg-[#f7f7f4] dark:border-white/10 dark:bg-[#1C1C1E]/95 dark:hover:bg-[#27272A] ${isRight ? 'rounded-l-xl border-r-0' : 'rounded-r-xl border-l-0'}`}
        style={{
          transform: collapsed ? 'translateX(0)' : tabHidden,
          opacity: collapsed ? 1 : 0,
          pointerEvents: collapsed ? 'auto' : 'none',
        }}
      >
        <Clock size={13} className="flex-none text-[#5a606b] dark:text-gray-300" />
        {current ? (
          <span className="tabular-nums text-[11.5px] font-semibold text-[#0f1115] dark:text-white">{remainingLabel(remainingMinutes)}</span>
        ) : isRight ? (
          <ChevronLeft size={13} className="text-[#9098a4]" />
        ) : (
          <ChevronRight size={13} className="text-[#9098a4]" />
        )}
      </button>
    </div>
  );

  return createPortal(overlay, document.body);
}
