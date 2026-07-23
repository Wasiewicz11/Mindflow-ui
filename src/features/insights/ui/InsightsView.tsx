import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { BarChart3, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Project, TaskPriority } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import { getTimeEntries, type ApiTaskTimeEntry } from '../../tasks/api/timeEntriesApi';

type InsightMode = 'day' | 'week' | 'month';
type PositionedEntry = ApiTaskTimeEntry & { displayStartMinutes: number };

const DAY_START = 6 * 60;
const DAY_END = 23 * 60;
const HOUR_HEIGHT = 64;
const DEFAULT_FLOATING_START = 9 * 60;

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

function formatMinutes(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function minutesFromIso(value?: string | null) {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.getHours() * 60 + date.getMinutes();
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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getPriorityMeta(priority: TaskPriority | undefined) {
  return priority && PRIORITY_META[priority] ? PRIORITY_META[priority] : PRIORITY_META[Priority.P4];
}

function getPositionedEntries(entries: ApiTaskTimeEntry[]): PositionedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const aStart = minutesFromIso(a.startAt);
    const bStart = minutesFromIso(b.startAt);
    if (aStart !== undefined && bStart !== undefined) return aStart - bStart;
    if (aStart !== undefined) return -1;
    if (bStart !== undefined) return 1;
    return a.createdAt.localeCompare(b.createdAt);
  });

  let floatingCursor = DEFAULT_FLOATING_START;
  return sorted.map(entry => {
    const explicitStart = minutesFromIso(entry.startAt);
    const displayStartMinutes = explicitStart ?? floatingCursor;
    if (explicitStart === undefined) {
      floatingCursor = Math.min(DAY_END - 15, floatingCursor + Math.max(30, entry.durationMinutes) + 15);
    }
    return { ...entry, displayStartMinutes };
  });
}

function blockStyle(entry: PositionedEntry): CSSProperties {
  const start = clamp(entry.displayStartMinutes, DAY_START, DAY_END - 15);
  const duration = clamp(entry.durationMinutes, 15, DAY_END - start);
  return {
    top: ((start - DAY_START) / 60) * HOUR_HEIGHT,
    height: Math.max(42, (duration / 60) * HOUR_HEIGHT),
  };
}

export function InsightsView({ projects }: { projects: Project[] }) {
  const [mode, setMode] = useState<InsightMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [entries, setEntries] = useState<ApiTaskTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (mode === 'month') return;
    const id = window.requestAnimationFrame(() => {
      const scroller = scrollerRef.current;
      if (!scroller) return;
      scroller.scrollTo({ top: Math.max(0, ((8 * 60 - DAY_START) / 60) * HOUR_HEIGHT), behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
  }, [anchorDate, mode]);

  const entriesByDate = useMemo(() => {
    const groups = new Map<string, ApiTaskTimeEntry[]>();
    for (const entry of entries) {
      const key = entry.workDate;
      groups.set(key, [...(groups.get(key) ?? []), entry]);
    }
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

  function renderEntryBlock(entry: PositionedEntry) {
    const meta = getPriorityMeta(entry.taskPriority);
    const project = getProject(entry);
    const start = minutesFromIso(entry.startAt) ?? entry.displayStartMinutes;
    const end = minutesFromIso(entry.endAt) ?? start + entry.durationMinutes;

    return (
      <article
        key={entry.id}
        className="absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-2 text-left shadow-sm transition-[transform,box-shadow] duration-200 ease hover:-translate-y-0.5 hover:shadow-md"
        style={{ ...blockStyle(entry), color: meta.fg, background: meta.bg, borderColor: meta.ring }}
        title={`${entry.taskContent} · ${formatDuration(entry.durationMinutes)}`}
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1.5">
              <span className="rounded-md bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold">{meta.label}</span>
              <span className="text-[10.5px] font-semibold text-[#5a606b]">{formatDuration(entry.durationMinutes)}</span>
            </div>
            <p className="break-words text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-[#0f1115]">
              {entry.taskContent}
            </p>
            <p className="mt-1 text-[10.5px] font-medium text-[#5a606b]">
              {formatMinutes(start)}-{formatMinutes(end)}
            </p>
          </div>
          {project && <p className="mt-auto truncate text-[10.5px] font-medium text-[#5a606b]">{project.name}</p>}
        </div>
      </article>
    );
  }

  const weekGridClass = mode === 'week'
    ? 'grid-cols-7 min-w-[700px] sm:min-w-[760px] lg:min-w-0'
    : 'grid-cols-1';

  function renderTimeGrid() {
    return (
      <div className="flex h-full flex-1 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
        <div ref={scrollerRef} className="min-w-0 flex-1 overflow-auto custom-scrollbar">
          <div className="flex">
            <div className="sticky left-0 z-40 w-12 shrink-0 border-r border-[#f1f0ed] bg-[#f7f7f4] sm:w-16 dark:border-white/8 dark:bg-[#232326]">
              <div className="sticky top-0 z-[45] h-14 border-b border-[#f1f0ed] bg-[#f7f7f4] dark:border-white/8 dark:bg-[#232326]" />
              {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, index) => (
                <div key={index} className="relative h-[64px] pr-1.5 text-right text-[10.5px] font-medium text-[#9098a4] sm:pr-3 sm:text-[11px]">
                  {formatMinutes(DAY_START + index * 60)}
                </div>
              ))}
            </div>

            <div className="flex-1">
              <div className={`sticky top-0 z-[35] grid h-14 border-b border-[#f1f0ed] bg-white dark:border-white/8 dark:bg-[#27272A] ${weekGridClass}`}>
                {days.map(day => {
                  const key = toDateKey(day);
                  const dayEntries = entriesByDate.get(key) ?? [];
                  const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.durationMinutes, 0);
                  return (
                    <div key={key} className="flex items-center justify-center border-r border-[#f1f0ed] last:border-r-0 dark:border-white/8">
                      <div className={`flex min-h-9 min-w-9 flex-col items-center justify-center rounded-lg px-2 transition-colors duration-200 ease ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#0f1115] dark:text-gray-100'}`}>
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{day.toLocaleDateString('pl-PL', { weekday: 'short' })} {day.getDate()}</span>
                        {dayTotal > 0 && <span className="text-[10px] font-semibold opacity-70">{formatTotal(dayTotal)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`grid ${weekGridClass}`} style={{ height: ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT }}>
                {days.map(day => {
                  const key = toDateKey(day);
                  const dayEntries = getPositionedEntries(entriesByDate.get(key) ?? []);
                  return (
                    <div key={key} className="relative border-r border-[#f1f0ed] bg-white last:border-r-0 dark:border-white/8 dark:bg-[#27272A]">
                      {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, index) => (
                        <div key={index} className="h-[64px] border-b border-[#f1f0ed] dark:border-white/8" />
                      ))}
                      {dayEntries.map(renderEntryBlock)}
                    </div>
                  );
                })}
              </div>
            </div>
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
                {dayEntries.slice(0, 4).map(entry => {
                  const meta = getPriorityMeta(entry.taskPriority);
                  const project = getProject(entry);
                  return (
                    <div key={entry.id} className="flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f7f7f4] dark:text-gray-100 dark:hover:bg-[#323238]">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.fg }} />
                      <span className="truncate">{entry.taskContent}</span>
                      <span className="shrink-0 text-[#9098a4]">{formatDuration(entry.durationMinutes)}</span>
                      {project && <span className="hidden shrink-0 text-[#b0b5be] lg:inline">{project.name}</span>}
                    </div>
                  );
                })}
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

      <div className="min-h-0 flex-1 overflow-auto custom-scrollbar pb-6">
        {isLoading ? (
          <div className="h-full rounded-[18px] border border-[#e8e8e4] bg-white p-4 dark:border-white/10 dark:bg-[#27272A]">
            <div className="h-full animate-pulse rounded-xl bg-[#f1f0ed] dark:bg-white/8" />
          </div>
        ) : entries.length === 0 ? (
          <div className="flex h-full min-h-[360px] flex-col items-center justify-center rounded-[18px] border border-dashed border-[#e8e8e4] bg-white text-center dark:border-white/10 dark:bg-[#27272A]">
            <CalendarDays className="mb-3 h-8 w-8 text-[#c0c5cc]" />
            <p className="text-[14px] font-medium text-[#9098a4]">Brak zarejestrowanego czasu w tym zakresie.</p>
          </div>
        ) : mode === 'month' ? renderMonth() : renderTimeGrid()}
      </div>
    </div>
  );
}
