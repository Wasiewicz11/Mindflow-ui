import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, Pencil, Trash2 } from 'lucide-react';
import type { Project, TaskPriority } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import { useConfirmDialog } from '../../../shared/ui/confirmDialog';
import {
  deleteTimeEntry,
  getTimeEntries,
  updateTimeEntry,
  type ApiTaskTimeEntry,
  type UpdateTaskTimeEntryDto,
} from '../../tasks/api/timeEntriesApi';
import { TaskTimeEntryModal } from '../../tasks/ui/TaskTimeEntryModal';

type InsightMode = 'day' | 'week' | 'month';

const PRIORITY_META: Record<TaskPriority, { fg: string; bg: string; ring: string; label: string }> = {
  [Priority.P1]: { label: 'P1', fg: 'oklch(0.62 0.18 25)', bg: 'oklch(0.96 0.03 25)', ring: 'oklch(0.78 0.12 25)' },
  [Priority.P2]: { label: 'P2', fg: 'oklch(0.70 0.16 55)', bg: 'oklch(0.96 0.03 55)', ring: 'oklch(0.82 0.10 55)' },
  [Priority.P3]: { label: 'P3', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)', ring: 'oklch(0.78 0.10 230)' },
  [Priority.P4]: { label: 'P4', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)', ring: 'oklch(0.78 0.01 260)' },
};

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfWeek(date: Date) {
  const next = new Date(date);
  const day = (next.getDay() + 6) % 7;
  next.setDate(next.getDate() - day);
  next.setHours(12, 0, 0, 0);
  return next;
}

function startOfMonthGrid(date: Date) {
  return startOfWeek(new Date(date.getFullYear(), date.getMonth(), 1, 12));
}

function getWeekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthDays(anchor: Date) {
  const start = startOfMonthGrid(anchor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function formatTotal(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function getPriorityMeta(priority: TaskPriority | undefined) {
  return priority && PRIORITY_META[priority] ? PRIORITY_META[priority] : PRIORITY_META[Priority.P4];
}

function sortLoggedEntries(entries: ApiTaskTimeEntry[]) {
  return [...entries].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function InsightsView({ projects }: { projects: Project[] }) {
  const { confirm } = useConfirmDialog();
  const [mode, setMode] = useState<InsightMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [entries, setEntries] = useState<ApiTaskTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ApiTaskTimeEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const days = useMemo(
    () => mode === 'month' ? getMonthDays(anchorDate) : mode === 'week' ? getWeekDays(anchorDate) : [anchorDate],
    [anchorDate, mode],
  );
  const todayKey = toDateKey(new Date());
  const fromKey = toDateKey(days[0]);
  const toKey = toDateKey(days[days.length - 1]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) {
        setIsLoading(true);
        setError(null);
      }
    });

    getTimeEntries(fromKey, toKey)
      .then(nextEntries => {
        if (!cancelled) setEntries(nextEntries);
      })
      .catch(err => {
        console.error('Failed to fetch time entries', err);
        if (!cancelled) setError('Nie udało się pobrać wpisów czasu.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey]);

  const entriesByDate = useMemo(() => {
    const groups = new Map<string, ApiTaskTimeEntry[]>();
    for (const entry of entries) {
      const key = entry.workDate;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
    for (const [key, group] of groups) groups.set(key, sortLoggedEntries(group));
    return groups;
  }, [entries]);

  const totalMinutes = entries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
  const title = mode === 'month'
    ? anchorDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${days[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} - ${days[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchorDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function shiftDate(amount: number) {
    if (mode === 'day') setAnchorDate(prev => addDays(prev, amount));
    if (mode === 'week') setAnchorDate(prev => addDays(prev, amount * 7));
    if (mode === 'month') setAnchorDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1, 12));
  }

  function getProject(entry: ApiTaskTimeEntry) {
    return projects.find(project => project.id === entry.projectId);
  }

  function modalTaskFromEntry(entry: ApiTaskTimeEntry) {
    return {
      id: entry.taskId ?? entry.id,
      content: entry.taskContent,
      priority: entry.taskPriority,
      status: entry.taskStatus,
      estimatedHours: entry.estimatedHours ?? undefined,
      project_id: entry.projectId ?? null,
    };
  }

  async function handleUpdateEntry(entryId: string, dto: UpdateTaskTimeEntryDto) {
    setActionError(null);
    const response = await updateTimeEntry(entryId, dto);
    setEntries(prev => prev.map(entry => entry.id === entryId ? response.timeEntry : entry));
    setEditingEntry(null);
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
      setEntries(prev => prev.filter(item => item.id !== entry.id));
    } catch (err) {
      console.warn('Failed to delete time entry', err);
      setActionError('Nie udało się usunąć wpisu czasu.');
    } finally {
      setDeletingId(null);
    }
  }

  function openEntry(entry: ApiTaskTimeEntry) {
    setEditingEntry(entry);
  }

  function handleCardKeyDown(event: React.KeyboardEvent<HTMLElement>, entry: ApiTaskTimeEntry) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openEntry(entry);
  }

  function renderEntryCard(entry: ApiTaskTimeEntry, compact = false) {
    const meta = getPriorityMeta(entry.taskPriority);
    const project = getProject(entry);

    return (
      <article
        key={entry.id}
        role="button"
        tabIndex={0}
        onClick={() => openEntry(entry)}
        onKeyDown={event => handleCardKeyDown(event, entry)}
        className={`group rounded-xl border bg-white text-left shadow-sm transition-[border-color,box-shadow,transform] duration-200 ease hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:bg-[#27272A] ${compact ? 'px-2 py-1.5' : 'px-3 py-3'}`}
        style={{ borderColor: meta.ring }}
        title="Kliknij, aby edytować wpis czasu"
      >
        <div className="flex min-w-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="mb-1 flex min-w-0 items-center gap-1.5">
              <span className="rounded-md bg-[#f7f7f4] px-1.5 py-0.5 text-[10px] font-semibold text-[#9098a4] dark:bg-white/8">{meta.label}</span>
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-orange-500">
                <Clock size={12} />
                {formatDuration(entry.durationMinutes)}
              </span>
            </div>
            <p className={`${compact ? 'truncate text-[11px]' : 'text-[13px]'} font-semibold leading-tight text-[#0f1115] dark:text-white`}>
              {entry.taskContent}
            </p>
            {!compact && project && (
              <p className="mt-1 truncate text-[11.5px] font-medium text-[#9098a4]">{project.name}</p>
            )}
          </div>

          <div className="flex flex-none items-center gap-1 opacity-0 transition-opacity duration-150 ease group-hover:opacity-100 group-focus-within:opacity-100">
            <button
              type="button"
              onClick={event => { event.stopPropagation(); openEntry(entry); }}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#9098a4] transition-colors hover:bg-[#f1f0ed] hover:text-[#0f1115] dark:hover:bg-[#323238] dark:hover:text-white"
              title="Edytuj wpis czasu"
            >
              <Pencil size={13} />
            </button>
            <button
              type="button"
              onClick={event => { event.stopPropagation(); void handleDeleteEntry(entry); }}
              disabled={deletingId === entry.id}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#c0c5cc] transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-red-500/10"
              title="Usuń wpis czasu"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {!compact && entry.notes && (
          <div className="mt-2 flex gap-1.5 rounded-lg bg-[#fbfbf9] px-2 py-1.5 text-[11.5px] leading-5 text-[#5a606b] dark:bg-white/5 dark:text-gray-400">
            <FileText size={12} className="mt-0.5 flex-none text-[#9098a4]" />
            <p className="line-clamp-3">{entry.notes}</p>
          </div>
        )}
      </article>
    );
  }

  const weekGridClass = mode === 'week'
    ? 'grid-cols-1 md:grid-cols-7 md:min-w-[760px] lg:min-w-0'
    : 'grid-cols-1';

  function renderDayColumns() {
    return (
      <div className="flex h-full min-h-0 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
        <div className="min-w-0 flex-1 overflow-x-auto custom-scrollbar">
          <div className={`grid h-full ${weekGridClass}`}>
            {days.map(day => {
              const key = toDateKey(day);
              const dayEntries = entriesByDate.get(key) ?? [];
              const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
              return (
                <section key={key} className="flex min-h-0 flex-col border-r border-[#f1f0ed] last:border-r-0 dark:border-white/8">
                  <header className="flex h-14 flex-none items-center justify-between gap-2 border-b border-[#f1f0ed] px-3 dark:border-white/8">
                    <div className={`flex min-h-9 min-w-9 flex-col justify-center rounded-lg px-2 transition-colors duration-200 ease ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#0f1115] dark:text-gray-100'}`}>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{day.toLocaleDateString('pl-PL', { weekday: 'short' })} {day.getDate()}</span>
                      {dayTotal > 0 && <span className="text-[10px] font-semibold opacity-70">{formatTotal(dayTotal)} h</span>}
                    </div>
                  </header>

                  <div className="min-h-0 flex-1 overflow-y-auto p-3 custom-scrollbar">
                    {dayEntries.length === 0 ? (
                      <div className="flex h-full min-h-[120px] items-center justify-center rounded-xl border border-dashed border-[#f1f0ed] px-3 text-center text-[12px] font-medium text-[#b0b5be] dark:border-white/8">
                        Brak wpisów
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayEntries.map(entry => renderEntryCard(entry))}
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  function renderMonth() {
    return (
      <div className="grid min-h-full grid-cols-7 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
        {days.map(day => {
          const key = toDateKey(day);
          const dayEntries = entriesByDate.get(key) ?? [];
          const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
          const muted = day.getMonth() !== anchorDate.getMonth();
          return (
            <div key={key} className={`min-h-[132px] border-r border-b border-[#f1f0ed] p-2 last:border-r-0 dark:border-white/8 ${muted ? 'bg-[#fbfbf9] text-[#b0b5be] dark:bg-[#232326]' : ''}`}>
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[12px] font-semibold ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#5a606b] dark:text-gray-300'}`}>
                  {day.getDate()}
                </span>
                {dayTotal > 0 && <span className="rounded-md bg-[#f7f7f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5a606b] dark:bg-white/8 dark:text-gray-300">{formatTotal(dayTotal)}</span>}
              </div>
              <div className="space-y-1">
                {dayEntries.slice(0, 4).map(entry => renderEntryCard(entry, true))}
                {dayEntries.length > 4 && <p className="px-1.5 text-[10.5px] font-medium text-[#9098a4]">+{dayEntries.length - 4} więcej</p>}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
            <BarChart3 size={14} /> Ewidencja pracy
          </div>
          <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-[#0f1115] sm:text-2xl dark:text-white">{title}</h2>
        </div>

        <div className="flex w-full items-center gap-2 lg:w-auto">
          <div className="rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-semibold text-[#3a3f47] dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200">
            {formatTotal(totalMinutes)} h
          </div>
          <button onClick={() => setAnchorDate(new Date())} className="rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200 dark:hover:bg-[#323238]">Dziś</button>
          <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1 dark:border-white/10 dark:bg-[#27272A]">
            <button onClick={() => shiftDate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:text-gray-300 dark:hover:bg-[#323238]" title="Poprzedni okres"><ChevronLeft size={17} /></button>
            <button onClick={() => shiftDate(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:text-gray-300 dark:hover:bg-[#323238]" title="Następny okres"><ChevronRight size={17} /></button>
          </div>
          <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1 dark:border-white/10 dark:bg-[#27272A]">
            {(['day', 'week', 'month'] as InsightMode[]).map(item => (
              <button
                key={item}
                onClick={() => setMode(item)}
                className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 sm:px-3 dark:focus:ring-white/10 ${mode === item ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-300 dark:hover:bg-[#323238]'}`}
              >
                <span className="hidden sm:inline">{{ day: 'Dzień', week: 'Tydzień', month: 'Miesiąc' }[item]}</span>
                <span className="sm:hidden">{{ day: 'D', week: 'T', month: 'M' }[item]}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
          {error}
        </div>
      )}

      {actionError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
          {actionError}
        </div>
      )}

      <div className={`min-h-0 flex-1 ${mode === 'month' ? 'overflow-auto custom-scrollbar pb-6' : 'overflow-hidden'}`}>
        {isLoading ? (
          <div className="h-full rounded-[18px] border border-[#e8e8e4] bg-white p-4 dark:border-white/10 dark:bg-[#27272A]">
            <div className="h-full animate-pulse rounded-xl bg-[#f1f0ed] dark:bg-white/8" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#e8e8e4] bg-white text-center dark:border-white/10 dark:bg-[#27272A]">
            <CalendarDays className="mb-3 h-8 w-8 text-[#c0c5cc]" />
            <p className="text-[14px] font-medium text-[#9098a4]">Brak zarejestrowanego czasu w tym zakresie.</p>
          </div>
        ) : mode === 'month' ? renderMonth() : renderDayColumns()}
      </div>

      {editingEntry && (
        <TaskTimeEntryModal
          mode="edit"
          task={modalTaskFromEntry(editingEntry)}
          entry={editingEntry}
          projects={projects}
          onUpdateTime={handleUpdateEntry}
          onClose={() => setEditingEntry(null)}
        />
      )}
    </div>
  );
}
