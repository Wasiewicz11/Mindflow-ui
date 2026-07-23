import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, X } from 'lucide-react';
import type { Task } from '../../../shared/types';
import { getTaskTimeEntries, type ApiTaskTimeEntry } from '../api/timeEntriesApi';
import { formatLoggedHours } from '../model/timeFormatting';

interface Props {
  task: Task;
  onTotalMinutesChange?: (minutes: number) => void;
  onClose: () => void;
}

function formatWorkDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(value?: string | null) {
  if (!value) return null;
  return new Date(value).toLocaleTimeString('pl-PL', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatTimeRange(entry: ApiTaskTimeEntry) {
  const start = formatTime(entry.startAt);
  const end = formatTime(entry.endAt);
  return start && end ? `${start} - ${end}` : 'Bez zakresu godzin';
}

export function TaskTimeEntriesModal({ task, onTotalMinutesChange, onClose }: Props) {
  const [entries, setEntries] = useState<ApiTaskTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;

    getTaskTimeEntries(task.id)
      .then(result => {
        if (!isActive) return;
        setEntries(result);
        onTotalMinutesChange?.(result.reduce((sum, entry) => sum + entry.durationMinutes, 0));
      })
      .catch(err => {
        console.warn('Failed to fetch task time entries:', err);
        if (isActive) setError('Nie udało się pobrać wpisów czasu.');
      })
      .finally(() => {
        if (isActive) setIsLoading(false);
      });

    return () => {
      isActive = false;
    };
  }, [onTotalMinutesChange, task.id]);

  const totalMinutes = useMemo(
    () => entries.length > 0
      ? entries.reduce((sum, entry) => sum + entry.durationMinutes, 0)
      : task.loggedMinutes ?? 0,
    [entries, task.loggedMinutes],
  );

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.22)' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 flex w-full max-w-[460px] flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.24)] dark:border-white/10 dark:bg-[#27272A]"
        style={{ maxHeight: '84vh' }}
        onClick={event => event.stopPropagation()}
      >
        <div className="flex flex-none items-start justify-between gap-4 border-b border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Godziny zadania</p>
            <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {task.content}
            </h2>
            <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-orange-50 px-2 py-1 text-[12px] font-semibold text-orange-500">
              <Clock size={13} />
              {formatLoggedHours(totalMinutes)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:bg-[#323238] dark:hover:text-white"
            title="Zamknij"
          >
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 custom-scrollbar">
          {isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map(item => (
                <div key={item} className="h-[58px] animate-pulse rounded-xl bg-[#f7f7f4] dark:bg-white/8" />
              ))}
            </div>
          )}

          {!isLoading && error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600">
              {error}
            </div>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e8e8e4] px-4 py-8 text-center text-[13px] font-medium text-[#9098a4] dark:border-white/10">
              Brak zarejestrowanych godzin dla tego zadania.
            </div>
          )}

          {!isLoading && !error && entries.length > 0 && (
            <div className="space-y-2">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[#f1f0ed] bg-[#fbfbf9] px-3 py-2.5 dark:border-white/8 dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#0f1115] dark:text-white">
                      <CalendarDays size={14} className="flex-none text-[#9098a4]" />
                      <span className="truncate">{formatWorkDate(entry.workDate)}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                      <Clock size={13} className="flex-none" />
                      <span className="truncate">{formatTimeRange(entry)}</span>
                    </div>
                  </div>
                  <div className="flex-none rounded-lg bg-orange-50 px-2 py-1 text-[12px] font-semibold text-orange-500">
                    {formatLoggedHours(entry.durationMinutes)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
