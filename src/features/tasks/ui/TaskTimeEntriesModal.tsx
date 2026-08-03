import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Clock, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { Project, Task } from '../../../shared/types';
import { useConfirmDialog } from '../../../shared/ui/confirmDialog';
import {
  createTaskTimeEntry,
  deleteTimeEntry,
  getTaskTimeEntries,
  updateTimeEntry,
  type ApiTaskTimeEntry,
  type UpdateTaskTimeEntryDto,
} from '../api/timeEntriesApi';
import { mapApiTask } from '../model/taskModel';
import { formatLoggedHours } from '../model/timeFormatting';
import { TaskTimeEntryModal } from './TaskTimeEntryModal';

interface Props {
  task: Task;
  projects?: Project[];
  onTotalMinutesChange?: (minutes: number) => void;
  onTaskUpdated?: (task: Task) => void;
  onClose: () => void;
}

function formatWorkDate(value: string) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('pl-PL', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function sortEntries(entries: ApiTaskTimeEntry[]) {
  return [...entries].sort((a, b) => {
    const byDate = b.workDate.localeCompare(a.workDate);
    if (byDate !== 0) return byDate;
    return b.createdAt.localeCompare(a.createdAt);
  });
}

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseHours(value: string) {
  const normalized = value.replace(',', '.').trim();
  if (!/^(?:\d+|\d*[.]\d+)$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function TaskTimeEntriesModal({ task, projects = [], onTotalMinutesChange, onTaskUpdated, onClose }: Props) {
  const { confirm } = useConfirmDialog();
  const [entries, setEntries] = useState<ApiTaskTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ApiTaskTimeEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [quickHours, setQuickHours] = useState('');
  const [isQuickAdding, setIsQuickAdding] = useState(false);

  const applyEntries = useCallback((nextEntries: ApiTaskTimeEntry[]) => {
    const sorted = sortEntries(nextEntries);
    setEntries(sorted);
    onTotalMinutesChange?.(sorted.reduce((sum, entry) => sum + entry.durationMinutes, 0));
  }, [onTotalMinutesChange]);

  useEffect(() => {
    let isActive = true;

    getTaskTimeEntries(task.id)
      .then(result => {
        if (!isActive) return;
        applyEntries(result);
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
  }, [applyEntries, task.id]);

  const totalMinutes = useMemo(
    () => isLoading && entries.length === 0
      ? task.loggedMinutes ?? 0
      : entries.reduce((sum, entry) => sum + entry.durationMinutes, 0),
    [entries, isLoading, task.loggedMinutes],
  );

  async function handleUpdateEntry(entryId: string, dto: UpdateTaskTimeEntryDto) {
    setActionError(null);
    const response = await updateTimeEntry(entryId, dto);
    applyEntries(entries.map(entry => entry.id === entryId ? response.timeEntry : entry));
    if (response.task) onTaskUpdated?.(mapApiTask(response.task));
    setEditingEntry(null);
  }

  async function handleQuickAdd(event: FormEvent) {
    event.preventDefault();
    if (isQuickAdding) return;

    const hours = parseHours(quickHours);
    const durationMinutes = hours === undefined ? 0 : Math.round(hours * 60);
    if (durationMinutes <= 0 || durationMinutes > 24 * 60) {
      setActionError('Podaj czas od 1 minuty do 24 godzin.');
      return;
    }

    setActionError(null);
    setIsQuickAdding(true);
    try {
      const response = await createTaskTimeEntry(task.id, {
        workDate: toDateKey(),
        durationMinutes,
      });
      applyEntries([response.timeEntry, ...entries]);
      onTaskUpdated?.(mapApiTask(response.task));
      setQuickHours('');
    } catch (err) {
      console.warn('Failed to add quick task time entry:', err);
      setActionError('Nie udało się dodać godzin.');
    } finally {
      setIsQuickAdding(false);
    }
  }

  async function handleDeleteEntry(entry: ApiTaskTimeEntry) {
    if (deletingId) return;
    const confirmed = await confirm({
      title: 'Usunąć wpis czasu?',
      message: 'Ten wpis zniknie z ewidencji zadania i widoku Insights.',
      confirmLabel: 'Usuń wpis',
      tone: 'danger',
    });
    if (!confirmed) return;

    setActionError(null);
    setDeletingId(entry.id);
    try {
      await deleteTimeEntry(entry.id);
      applyEntries(entries.filter(item => item.id !== entry.id));
    } catch (err) {
      console.warn('Failed to delete task time entry:', err);
      setActionError('Nie udało się usunąć wpisu czasu.');
    } finally {
      setDeletingId(null);
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 lg:items-center lg:p-4">
      <div
        className="absolute inset-0 bg-[#0f1115]/[0.22] backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[88dvh] w-full flex-col overflow-hidden rounded-t-[18px] border border-b-0 border-[#e8e8e4] bg-white shadow-[0_-16px_42px_-16px_rgba(15,17,21,.28)] dark:border-white/10 dark:bg-[#27272A] lg:max-h-[84vh] lg:max-w-[460px] lg:rounded-[18px] lg:border-b lg:shadow-[0_24px_48px_-12px_rgba(15,17,21,.24)]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex justify-center pb-1 pt-2.5 lg:hidden" aria-hidden="true">
          <span className="h-1 w-9 rounded-full bg-[#d4d4d0] dark:bg-white/20" />
        </div>
        <div className="flex flex-none items-start justify-between gap-4 border-b border-[#f1f0ed] px-4 pb-3 pt-2 dark:border-white/8 lg:px-5 lg:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Godziny zadania</p>
            <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {task.content}
            </h2>
            <div className="mt-1.5 inline-flex items-center gap-1.5 text-[12px] font-semibold text-orange-500 lg:mt-2 lg:rounded-lg lg:bg-orange-50 lg:px-2 lg:py-1">
              <Clock size={13} />
              {formatLoggedHours(totalMinutes)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:bg-[#323238] dark:hover:text-white lg:h-8 lg:w-8"
            title="Zamknij"
          >
            <X size={16} />
          </button>
        </div>

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 lg:px-5 lg:py-4">
          {!isLoading && !error && (
            <form
              onSubmit={handleQuickAdd}
              aria-busy={isQuickAdding}
              className="mb-3 flex items-center gap-2 border-b border-[#e8e8e4] bg-transparent px-0 pb-3 pt-1 dark:border-white/8 lg:rounded-xl lg:border lg:bg-[#fbfbf9] lg:px-3 lg:py-2 lg:dark:bg-white/5"
            >
              <Clock size={15} className="flex-none text-orange-500" />
              <input
                type="text"
                inputMode="decimal"
                value={quickHours}
                onChange={event => setQuickHours(event.target.value)}
                disabled={isQuickAdding}
                placeholder="0 h"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#0f1115] outline-none placeholder:text-[#c0c5cc] disabled:cursor-wait disabled:opacity-50 dark:text-white lg:text-[13px]"
                aria-label="Liczba godzin"
              />
              <button
                type="submit"
                disabled={isQuickAdding}
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#0f1115] text-white transition-opacity duration-200 ease hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f7f7f4] dark:text-[#18181B] lg:h-8 lg:w-8 lg:rounded-lg"
                title="Dodaj godziny"
              >
                <Plus size={15} />
              </button>
            </form>
          )}

          {isLoading && (
            <div className="space-y-0 lg:space-y-2">
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

          {!isLoading && actionError && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600">
              {actionError}
            </div>
          )}

          {!isLoading && !error && entries.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#e8e8e4] px-4 py-8 text-center text-[13px] font-medium text-[#9098a4] dark:border-white/10">
              Brak zarejestrowanych godzin dla tego zadania.
            </div>
          )}

          {!isLoading && !error && entries.length > 0 && (
            <div className="space-y-0 lg:space-y-2">
              {entries.map(entry => (
                <div
                  key={entry.id}
                  className="flex min-h-[62px] items-center justify-between gap-2 border-b border-[#f1f0ed] bg-transparent py-2 dark:border-white/8 lg:gap-3 lg:rounded-xl lg:border lg:bg-[#fbfbf9] lg:px-3 lg:py-2.5 lg:dark:bg-white/5"
                >
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-[#0f1115] dark:text-white">
                      <CalendarDays size={14} className="flex-none text-[#9098a4]" />
                      <span className="truncate">{formatWorkDate(entry.workDate)}</span>
                    </div>
                    <div className="mt-1 flex min-w-0 items-center gap-1.5 text-[12px] font-semibold text-orange-500">
                      <Clock size={13} className="flex-none" />
                      <span className="truncate">{formatLoggedHours(entry.durationMinutes)}</span>
                    </div>
                    {entry.notes && (
                      <p className="mt-1 line-clamp-2 text-[12px] leading-5 text-[#5a606b] dark:text-gray-400">
                        {entry.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-none items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setEditingEntry(entry)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:bg-[#323238] dark:hover:text-white lg:h-8 lg:w-8"
                      title="Edytuj wpis czasu"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteEntry(entry)}
                      disabled={deletingId === entry.id}
                      className="flex h-10 w-10 items-center justify-center rounded-lg text-[#c0c5cc] transition-colors duration-200 ease hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10 lg:h-8 lg:w-8"
                      title="Usuń wpis czasu"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {editingEntry && (
          <TaskTimeEntryModal
            mode="edit"
            task={task}
            entry={editingEntry}
            projects={projects}
            onUpdateTime={handleUpdateEntry}
            onClose={() => setEditingEntry(null)}
          />
        )}
      </div>
    </div>,
    document.body,
  );
}
