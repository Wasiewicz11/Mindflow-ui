import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent, type TouchEvent } from 'react';
import { createPortal } from 'react-dom';
import { BarChart3, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock, Pencil, SendHorizontal, Settings, Trash2, X } from 'lucide-react';
import type { Project, TaskPriority } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import {
  createStandaloneTimeEntry,
  deleteTimeEntry,
  getTimeEntries,
  updateTimeEntry,
  type ApiTaskTimeEntry,
  type CreateStandaloneTimeEntryDto,
  type UpdateTaskTimeEntryDto,
} from '../../tasks/api/timeEntriesApi';
import { TaskTimeEntryModal } from '../../tasks/ui/TaskTimeEntryModal';

type InsightMode = 'day' | 'week' | 'month';
type PositionedEntry = ApiTaskTimeEntry & { displayStartMinutes: number };

const DAY_START = 0;
const DAY_END = 24 * 60;
const TIME_HEADER_HEIGHT = 56;
const DEFAULT_HOUR_HEIGHT = 28;
const MIN_HOUR_HEIGHT = 10;
const DEFAULT_FLOATING_START = 9 * 60;
const DEFAULT_PROJECT_STORAGE_KEY = 'mindflow_insights_default_project_id';
const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

function getInitialInsightMode(): InsightMode {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches ? 'day' : 'week';
}

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
  if (minutes === 24 * 60) return '24:00';
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

function getStoredDefaultProjectId() {
  const value = localStorage.getItem(DEFAULT_PROJECT_STORAGE_KEY);
  return value && value.trim() ? value : null;
}

function parseDurationInput(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/godz(?:ina|iny|in)?\.?/g, 'h')
    .replace(/min(?:ut|uty|uta)?\.?/g, 'm')
    .replace(/\s+/g, ' ')
    .trim();

  if (!normalized) return undefined;
  if (/^p[oó]ł$/.test(normalized)) return 30;

  const halfMatch = normalized.match(/^(\d+)\s*(?:h\s*)?(?:i\s*)?p[oó]ł$/);
  if (halfMatch) return Number(halfMatch[1]) * 60 + 30;

  const clockMatch = normalized.match(/^(\d{1,2}):([0-5]\d)$/);
  if (clockMatch) return Number(clockMatch[1]) * 60 + Number(clockMatch[2]);

  const hoursMinutesMatch = normalized.match(/^(\d+)\s*h(?:\s*(\d{1,2})\s*m?)?$/);
  if (hoursMinutesMatch) {
    return Number(hoursMinutesMatch[1]) * 60 + Number(hoursMinutesMatch[2] ?? 0);
  }

  const spokenMatch = normalized.match(/^(\d+)\s+i\s+(\d{1,2})$/);
  if (spokenMatch) {
    const hours = Number(spokenMatch[1]);
    const rest = Number(spokenMatch[2]);
    return rest < 10
      ? Math.round(Number(`${hours}.${rest}`) * 60)
      : hours * 60 + rest;
  }

  const decimal = normalized.replace(',', '.');
  if (!/^(?:\d+|\d*[.]\d+)$/.test(decimal)) return undefined;

  const hours = Number(decimal);
  if (!Number.isFinite(hours)) return undefined;
  return Math.round(hours * 60);
}

function isValidDuration(minutes: number | undefined) {
  return minutes !== undefined && minutes > 0 && minutes <= 24 * 60;
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

function blockStyle(entry: PositionedEntry, hourHeight: number): CSSProperties {
  const start = clamp(entry.displayStartMinutes, DAY_START, DAY_END - 15);
  const duration = clamp(entry.durationMinutes, 15, DAY_END - start);
  const minBlockHeight = Math.min(36, Math.max(18, hourHeight * 0.85));
  return {
    top: ((start - DAY_START) / 60) * hourHeight,
    height: Math.max(minBlockHeight, (duration / 60) * hourHeight),
  };
}

interface ProjectPickerProps {
  projects: Project[];
  value: string | null;
  onChange: (projectId: string | null) => void;
  placement?: 'top' | 'bottom';
  disabled?: boolean;
}

function ProjectPicker({ projects, value, onChange, placement = 'bottom', disabled = false }: ProjectPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = value ? projects.find(project => project.id === value) : null;

  useEffect(() => {
    if (!isOpen) return;
    const handler = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  const popupPosition = placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2';

  return (
    <div ref={pickerRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        disabled={disabled}
        className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-2.5 text-[12px] font-medium text-[#5a606b] transition-[background-color,border-color,color,opacity] duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8 dark:focus:ring-white/10 ${isOpen ? 'border-[#c0c5cc] bg-white text-[#0f1115] dark:border-white/20 dark:bg-[#323238] dark:text-white' : ''}`}
        title={selected ? `Projekt: ${selected.name}` : 'Wybierz projekt'}
        aria-expanded={isOpen}
      >
        <BookOpen size={15} className={selected ? 'hidden lg:block' : undefined} />
        {selected && (
          <>
            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: selected.color || '#9098a4' }} />
            <span className="max-w-[5rem] truncate lg:hidden">{selected.name}</span>
          </>
        )}
      </button>

      <div
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={`absolute right-0 z-50 w-56 overflow-hidden rounded-xl border border-[#e8e8e4] bg-white p-1.5 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] ${popupPosition} ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}
      >
        <button
          type="button"
          onClick={() => {
            onChange(null);
            setIsOpen(false);
          }}
          className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:focus:ring-white/10 ${value === null ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}
        >
          <span className="h-2 w-2 rounded-full border border-[#c0c5cc]" />
          Bez projektu
        </button>

        <div className="max-h-56 overflow-y-auto custom-scrollbar">
          {projects.map(project => (
            <button
              key={project.id}
              type="button"
              onClick={() => {
                onChange(project.id);
                setIsOpen(false);
              }}
              className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:focus:ring-white/10 ${value === project.id ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color || '#9098a4' }} />
              <span className="truncate">{project.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

type TimeEntryDraftInput = {
  content: string;
  hours: string;
  projectId: string | null;
  workDate: string;
};

function InsightQuickAddTime({
  projects,
  projectId,
  workDate,
  onProjectChange,
  onSubmit,
  isSaving,
}: {
  projects: Project[];
  projectId: string | null;
  workDate: string;
  onProjectChange: (projectId: string | null) => void;
  onSubmit: (input: TimeEntryDraftInput) => Promise<boolean>;
  isSaving: boolean;
}) {
  const [content, setContent] = useState('');
  const [hours, setHours] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;

    const saved = await onSubmit({
      content,
      hours,
      projectId,
      workDate,
    });

    if (saved) {
      setContent('');
      setHours('');
      inputRef.current?.focus();
    }
  }

  return createPortal(
    <div className="pointer-events-none fixed bottom-[calc(4.0625rem+env(safe-area-inset-bottom))] left-0 right-0 z-40 px-0 lg:bottom-4 lg:left-[220px] lg:px-6">
      <div className="pointer-events-auto mx-auto max-w-3xl">
        <form
          onSubmit={handleSubmit}
          className="mf-mobile-form relative flex flex-nowrap items-center gap-1.5 border-t border-gray-200 bg-white/95 px-3 py-2.5 shadow-[0_-12px_32px_rgba(15,17,21,.10)] backdrop-blur-xl dark:border-white/10 dark:bg-[#1C1C1E]/95 lg:gap-2 lg:rounded-xl lg:border lg:px-3 lg:py-2 lg:shadow-sm"
        >
          <input
            ref={inputRef}
            type="text"
            value={content}
            onChange={event => setContent(event.target.value)}
            placeholder="Dodaj godziny..."
            disabled={isSaving}
            className="min-w-0 flex-1 bg-transparent text-[16px] text-gray-600 outline-none transition-colors duration-200 ease placeholder:text-[#b0b5be] disabled:cursor-not-allowed disabled:opacity-40 dark:text-gray-300 lg:min-w-[180px] lg:flex-[2_1_220px] lg:text-sm"
          />

          <label className="flex h-10 w-[76px] flex-none items-center gap-1.5 rounded-lg bg-[#f7f7f4] px-2 transition-colors duration-200 ease focus-within:bg-white focus-within:ring-1 focus-within:ring-[#9098a4] dark:bg-white/5 dark:focus-within:bg-[#323238] lg:h-9 lg:min-w-[112px] lg:flex-[1_1_112px] lg:gap-2 lg:border lg:border-[#e8e8e4] lg:px-2.5">
            <Clock size={14} className="flex-none text-[#9098a4]" />
            <input
              type="text"
              inputMode="decimal"
              value={hours}
              onChange={event => setHours(event.target.value)}
              placeholder="0 h"
              autoComplete="off"
              disabled={isSaving}
              className="min-w-0 flex-1 bg-transparent text-[16px] font-semibold text-[#0f1115] outline-none placeholder:text-[#b0b5be] disabled:cursor-not-allowed disabled:opacity-40 dark:text-white lg:text-[13px]"
              aria-label="Liczba godzin"
            />
          </label>

          <ProjectPicker
            projects={projects}
            value={projectId}
            onChange={onProjectChange}
            placement="top"
            disabled={isSaving}
          />

          <button
            type="submit"
            disabled={isSaving}
            className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#0f1115] text-white transition-[opacity,transform] duration-200 ease hover:-translate-y-px hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f7f7f4] dark:text-[#18181B] dark:focus:ring-white/10 lg:h-9 lg:w-9 lg:rounded-lg"
            title="Dodaj godziny"
          >
            <SendHorizontal size={15} />
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function StandaloneTimeEntryModal({
  workDate,
  projects,
  projectId,
  onProjectChange,
  onSubmit,
  onClose,
  isSaving,
}: {
  workDate: string;
  projects: Project[];
  projectId: string | null;
  onProjectChange: (projectId: string | null) => void;
  onSubmit: (input: TimeEntryDraftInput) => Promise<boolean>;
  onClose: () => void;
  isSaving: boolean;
}) {
  const [content, setContent] = useState('');
  const [hours, setHours] = useState('');
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (isSaving) return;

    if (!content.trim()) {
      setError('Opisz, co chcesz zapisać.');
      return;
    }

    if (!isValidDuration(parseDurationInput(hours))) {
      setError('Podaj czas pracy od 1 min do 24 h.');
      return;
    }

    setError(null);
    const saved = await onSubmit({ content, hours, projectId, workDate });
    if (saved) onClose();
    else setError('Nie udało się zapisać wpisu.');
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') onClose();
  }

  const dateLabel = new Date(`${workDate}T00:00:00`).toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.18)' }}
        onClick={onClose}
      />

      <form
        onSubmit={handleSubmit}
        className="relative z-10 flex w-full max-w-[460px] flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-[#27272A]"
        onClick={event => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Dodaj godziny</p>
            <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {dateLabel}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/10"
            title="Zamknij"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3 px-5 py-4">
          <label className="grid gap-1.5">
            <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
              <CalendarDays size={13} /> Wpis
            </span>
            <input
              ref={inputRef}
              type="text"
              value={content}
              onChange={event => setContent(event.target.value)}
              placeholder="Co robiłeś?"
              disabled={isSaving}
              className="h-10 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 text-[13px] font-medium text-[#0f1115] outline-none transition-colors duration-200 ease placeholder:text-[#b0b5be] hover:bg-[#f1f0ed] focus:bg-white focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#232326] dark:text-white dark:focus:ring-white/10"
            />
          </label>

          <div className="grid grid-cols-[1fr_auto] gap-3">
            <label className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                <Clock size={13} /> Czas pracy
              </span>
              <div className="flex h-10 items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 transition-colors duration-200 ease focus-within:border-[#9098a4] focus-within:bg-white dark:border-white/10 dark:bg-[#232326] dark:focus-within:border-white/15 dark:focus-within:bg-[#323238]">
                <input
                  type="text"
                  inputMode="decimal"
                  value={hours}
                  onChange={event => setHours(event.target.value)}
                  placeholder="0 h"
                  autoComplete="off"
                  disabled={isSaving}
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-[#0f1115] outline-none placeholder:text-[#b0b5be] disabled:cursor-not-allowed disabled:opacity-40 dark:text-white"
                />
                <span className="text-[12px] font-medium text-[#9098a4]">h</span>
              </div>
            </label>

            <div className="grid gap-1.5">
              <span className="text-[12px] font-medium text-[#9098a4]">Projekt</span>
              <ProjectPicker
                projects={projects}
                value={projectId}
                onChange={onProjectChange}
                disabled={isSaving}
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#f1f0ed] px-5 py-3 dark:border-white/8">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-3 py-2 text-[13px] font-medium text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/10"
          >
            Anuluj
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-xl bg-[#0f1115] px-4 py-2 text-[13px] font-semibold text-white transition-[opacity,transform] duration-200 ease hover:-translate-y-px hover:opacity-85 focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f7f7f4] dark:text-[#18181B] dark:focus:ring-white/10"
          >
            <Check size={14} />
            {isSaving ? 'Zapisuję...' : 'Zapisz'}
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}

export function InsightsView({
  projects,
  onTasksChanged,
}: {
  projects: Project[];
  onTasksChanged?: () => void | Promise<void>;
}) {
  const [mode, setMode] = useState<InsightMode>(getInitialInsightMode);
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [entries, setEntries] = useState<ApiTaskTimeEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingEntry, setEditingEntry] = useState<ApiTaskTimeEntry | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedWorkDate, setSelectedWorkDate] = useState<string | null>(null);
  const [defaultProjectId, setDefaultProjectId] = useState<string | null>(getStoredDefaultProjectId);
  const [quickProjectId, setQuickProjectId] = useState<string | null>(getStoredDefaultProjectId);
  const [isCreatingEntry, setIsCreatingEntry] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const timeGridRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const [hourHeight, setHourHeight] = useState(DEFAULT_HOUR_HEIGHT);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const syncMode = () => {
      if (media.matches) setMode('day');
    };
    syncMode();
    media.addEventListener('change', syncMode);
    return () => media.removeEventListener('change', syncMode);
  }, []);

  const days = useMemo(
    () => mode === 'month' ? getMonthDays(anchorDate) : mode === 'week' ? getWeekDays(anchorDate) : [anchorDate],
    [anchorDate, mode],
  );
  const projectIds = useMemo(() => new Set(projects.map(project => project.id)), [projects]);
  const effectiveDefaultProjectId = defaultProjectId && (projects.length === 0 || projectIds.has(defaultProjectId))
    ? defaultProjectId
    : null;
  const effectiveQuickProjectId = quickProjectId && (projects.length === 0 || projectIds.has(quickProjectId))
    ? quickProjectId
    : null;
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
    if (!defaultProjectId || projects.length === 0) return;
    if (projectIds.has(defaultProjectId)) return;

    localStorage.removeItem(DEFAULT_PROJECT_STORAGE_KEY);
  }, [defaultProjectId, projectIds, projects.length]);

  useEffect(() => {
    if (!showSettings) return;

    const handler = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSettings]);

  useEffect(() => {
    if (mode === 'month') return;

    const grid = timeGridRef.current;
    if (!grid) return;

    const updateHourHeight = () => {
      const availableHeight = grid.clientHeight - TIME_HEADER_HEIGHT;
      const hourCount = (DAY_END - DAY_START) / 60;
      const nextHourHeight = availableHeight > 0
        ? Math.max(MIN_HOUR_HEIGHT, availableHeight / hourCount)
        : DEFAULT_HOUR_HEIGHT;
      setHourHeight(nextHourHeight);
    };

    updateHourHeight();

    if (typeof ResizeObserver === 'undefined') return undefined;

    const observer = new ResizeObserver(updateHourHeight);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [entries.length, isLoading, mode]);

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
  const mobileEntries = useMemo(() => {
    const dateEntries = entriesByDate.get(toDateKey(anchorDate)) ?? [];
    return [...dateEntries].sort((a, b) => {
      const first = a.startAt ?? a.createdAt;
      const second = b.startAt ?? b.createdAt;
      return first.localeCompare(second);
    });
  }, [anchorDate, entriesByDate]);
  const mobileDateTitle = anchorDate.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const mobileIsToday = toDateKey(anchorDate) === todayKey;

  function shiftDate(amount: number) {
    if (mode === 'day') setAnchorDate(prev => addDays(prev, amount));
    if (mode === 'week') setAnchorDate(prev => addDays(prev, amount * 7));
    if (mode === 'month') setAnchorDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1, 12));
  }

  function handleMobileTouchStart(event: TouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    swipeStartRef.current = touch ? { x: touch.clientX, y: touch.clientY } : null;
  }

  function handleMobileTouchEnd(event: TouchEvent<HTMLDivElement>) {
    const start = swipeStartRef.current;
    const touch = event.changedTouches[0];
    swipeStartRef.current = null;
    if (!start || !touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY) * 1.2) return;

    // Zgodnie z mobilnym gestem produktu: w lewo = poprzedni, w prawo = następny dzień.
    shiftDate(deltaX < 0 ? -1 : 1);
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
    if (response.task) await onTasksChanged?.();
    setEditingEntry(null);
  }

  async function handleDeleteEntry(entry: ApiTaskTimeEntry) {
    if (deletingId) return;
    if (!window.confirm('Usunąć ten wpis czasu?')) return;

    setActionError(null);
    setDeletingId(entry.id);
    try {
      await deleteTimeEntry(entry.id);
      setEntries(prev => prev.filter(item => item.id !== entry.id));
      if (entry.taskId) await onTasksChanged?.();
    } catch (err) {
      console.warn('Failed to delete time entry', err);
      setActionError('Nie udało się usunąć wpisu czasu.');
    } finally {
      setDeletingId(null);
    }
  }

  function handleDefaultProjectChange(projectId: string | null) {
    setDefaultProjectId(projectId);
    setQuickProjectId(projectId);
    if (projectId) localStorage.setItem(DEFAULT_PROJECT_STORAGE_KEY, projectId);
    else localStorage.removeItem(DEFAULT_PROJECT_STORAGE_KEY);
  }

  async function handleCreateStandaloneEntry(input: TimeEntryDraftInput) {
    if (isCreatingEntry) return false;

    const content = input.content.trim();
    if (!content) {
      setActionError('Opisz, co chcesz zapisać.');
      return false;
    }

    const durationMinutes = parseDurationInput(input.hours);
    if (!isValidDuration(durationMinutes)) {
      setActionError('Podaj czas pracy od 1 min do 24 h.');
      return false;
    }

    setActionError(null);
    setIsCreatingEntry(true);

    try {
      const dto: CreateStandaloneTimeEntryDto = {
        content,
        projectId: input.projectId && projectIds.has(input.projectId) ? input.projectId : null,
        workDate: input.workDate,
        durationMinutes,
      };
      const created = await createStandaloneTimeEntry(dto);
      setEntries(prev => [...prev, created]);
      return true;
    } catch (err) {
      console.warn('Failed to create standalone time entry', err);
      setActionError('Nie udało się dodać godzin.');
      return false;
    } finally {
      setIsCreatingEntry(false);
    }
  }

  function renderEntryBlock(entry: PositionedEntry) {
    const meta = getPriorityMeta(entry.taskPriority);
    const project = getProject(entry);
    const start = minutesFromIso(entry.startAt) ?? entry.displayStartMinutes;
    const end = minutesFromIso(entry.endAt) ?? start + entry.durationMinutes;

    return (
      <article
        key={entry.id}
        onClick={event => event.stopPropagation()}
        className="group absolute left-1 right-1 overflow-hidden rounded-lg border px-2 py-2 text-left shadow-sm transition-[transform,box-shadow] duration-200 ease hover:-translate-y-0.5 hover:shadow-md"
        style={{ ...blockStyle(entry, hourHeight), color: meta.fg, background: meta.bg, borderColor: meta.ring }}
        title={`${entry.taskContent} · ${formatDuration(entry.durationMinutes)}`}
      >
        <div className="absolute right-1.5 top-1.5 z-10 flex items-center gap-1 opacity-0 transition-opacity duration-150 ease group-hover:opacity-100">
          <button
            type="button"
            onClick={event => { event.stopPropagation(); setEditingEntry(entry); }}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-[#5a606b] shadow-sm transition-colors hover:bg-white hover:text-[#0f1115]"
            title="Edytuj wpis czasu"
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            onClick={event => { event.stopPropagation(); void handleDeleteEntry(entry); }}
            disabled={deletingId === entry.id}
            className="flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-[#9098a4] shadow-sm transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
            title="Usuń wpis czasu"
          >
            <Trash2 size={12} />
          </button>
        </div>
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
    const hourCount = (DAY_END - DAY_START) / 60;
    const timeGridHeight = hourCount * hourHeight;

    return (
      <div ref={timeGridRef} className="flex h-full flex-1 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
        <div className="min-w-0 flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar">
          <div className="flex">
            <div className="sticky left-0 z-40 w-12 shrink-0 border-r border-[#f1f0ed] bg-[#f7f7f4] sm:w-16 dark:border-white/8 dark:bg-[#232326]">
              <div className="sticky top-0 z-[45] h-14 border-b border-[#f1f0ed] bg-[#f7f7f4] dark:border-white/8 dark:bg-[#232326]" />
              {Array.from({ length: hourCount }, (_, index) => (
                <div
                  key={index}
                  className="relative pr-1.5 text-right text-[9.5px] font-medium leading-none text-[#9098a4] sm:pr-3 sm:text-[10.5px]"
                  style={{ height: hourHeight }}
                >
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

              <div className={`grid ${weekGridClass}`} style={{ height: timeGridHeight }}>
                {days.map(day => {
                  const key = toDateKey(day);
                  const dayEntries = getPositionedEntries(entriesByDate.get(key) ?? []);
                  return (
                    <div
                      key={key}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedWorkDate(key)}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedWorkDate(key);
                        }
                      }}
                      className="relative border-r border-[#f1f0ed] bg-white outline-none transition-colors duration-200 ease last:border-r-0 hover:bg-[#fbfbf9] focus:ring-2 focus:ring-inset focus:ring-[#0f1115]/20 dark:border-white/8 dark:bg-[#27272A] dark:hover:bg-[#2f2f33] dark:focus:ring-white/10"
                    >
                      {Array.from({ length: hourCount }, (_, index) => (
                        <div key={index} className="border-b border-[#f1f0ed] dark:border-white/8" style={{ height: hourHeight }} />
                      ))}
                      {dayEntries.length === 0 && (
                        <div
                          className="pointer-events-none absolute left-2 right-2 rounded-lg border border-dashed border-[#e8e8e4] bg-white/75 px-2 py-2 text-center text-[11.5px] font-medium text-[#b0b5be] dark:border-white/10 dark:bg-white/5 dark:text-gray-500"
                          style={{ top: Math.max(8, hourHeight * 9) }}
                        >
                          Brak wpisów
                        </div>
                      )}
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
            <div
              key={key}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedWorkDate(key)}
              onKeyDown={event => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedWorkDate(key);
                }
              }}
              className={`min-h-[132px] border-r border-b border-[#f1f0ed] p-2 outline-none transition-colors duration-200 ease last:border-r-0 hover:bg-[#f7f7f4] focus:ring-2 focus:ring-inset focus:ring-[#0f1115]/20 dark:border-white/8 dark:hover:bg-[#323238] dark:focus:ring-white/10 ${muted ? 'bg-[#fbfbf9] text-[#b0b5be] dark:bg-[#232326]' : 'bg-white dark:bg-[#27272A]'}`}
            >
              <div className="mb-2 flex items-center justify-between gap-1">
                <span className={`inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[12px] font-semibold ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#5a606b] dark:text-gray-300'}`}>
                  {day.getDate()}
                </span>
                {dayTotal > 0 && <span className="rounded-md bg-[#f7f7f4] px-1.5 py-0.5 text-[10.5px] font-semibold text-[#5a606b] dark:bg-white/8 dark:text-gray-300">{formatTotal(dayTotal)}</span>}
              </div>
              <div className="space-y-1">
                {dayEntries.length === 0 && (
                  <p className="rounded-lg border border-dashed border-[#e8e8e4] px-2 py-2 text-center text-[11.5px] font-medium text-[#b0b5be] dark:border-white/10 dark:text-gray-500">
                    Brak wpisów
                  </p>
                )}
                {dayEntries.slice(0, 4).map(entry => {
                  const meta = getPriorityMeta(entry.taskPriority);
                  const project = getProject(entry);
                  return (
                    <div
                      key={entry.id}
                      onClick={event => event.stopPropagation()}
                      className="group/month flex min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-[11px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f7f7f4] dark:text-gray-100 dark:hover:bg-[#323238]"
                    >
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.fg }} />
                      <span className="truncate">{entry.taskContent}</span>
                      <span className="shrink-0 text-[#9098a4]">{formatDuration(entry.durationMinutes)}</span>
                      {project && <span className="hidden shrink-0 text-[#b0b5be] lg:inline">{project.name}</span>}
                      <span className="ml-auto hidden shrink-0 items-center gap-0.5 group-hover/month:inline-flex">
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); setEditingEntry(entry); }}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[#9098a4] transition-colors hover:bg-[#f1f0ed] hover:text-[#0f1115]"
                          title="Edytuj wpis czasu"
                        >
                          <Pencil size={11} />
                        </button>
                        <button
                          type="button"
                          onClick={event => { event.stopPropagation(); void handleDeleteEntry(entry); }}
                          disabled={deletingId === entry.id}
                          className="flex h-5 w-5 items-center justify-center rounded-md text-[#b0b5be] transition-colors hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-40"
                          title="Usuń wpis czasu"
                        >
                          <Trash2 size={11} />
                        </button>
                      </span>
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
    <div className="flex h-full min-h-0 flex-col gap-0 lg:gap-4">
      <div
        className="flex min-h-0 flex-1 flex-col pt-[max(0.75rem,env(safe-area-inset-top))] lg:hidden"
        onTouchStart={handleMobileTouchStart}
        onTouchEnd={handleMobileTouchEnd}
      >
        <div className="flex flex-none items-center border-b border-[#e8e8e4] pb-3 dark:border-white/10">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            aria-label="Poprzedni dzień"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[#5a606b] transition-colors hover:bg-[#f1f0ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:text-gray-300 dark:hover:bg-white/10"
          >
            <ChevronLeft size={20} />
          </button>

          <button
            type="button"
            onClick={() => setAnchorDate(new Date())}
            className="min-w-0 flex-1 px-2 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115]"
          >
            <span className="block truncate text-[17px] font-semibold capitalize tracking-[-0.015em] text-[#0f1115] dark:text-white">
              {mobileDateTitle}
            </span>
            <span className="mt-0.5 block text-[11.5px] font-medium text-[#9098a4]">
              {mobileIsToday ? 'Dzisiaj' : 'Dotknij, aby wrócić do dzisiaj'} · {formatTotal(totalMinutes)} h
            </span>
          </button>

          <button
            type="button"
            onClick={() => shiftDate(1)}
            aria-label="Następny dzień"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[#5a606b] transition-colors hover:bg-[#f1f0ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:text-gray-300 dark:hover:bg-white/10"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {(error || actionError) && (
          <div className="mt-3 border-l-2 border-red-500 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-600">
            {actionError ?? error}
          </div>
        )}

        <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto pb-28">
          {isLoading ? (
            <div className="divide-y divide-[#f1f0ed] dark:divide-white/8">
              {[1, 2, 3, 4].map(item => (
                <div key={item} className="flex min-h-[68px] animate-pulse items-center gap-3 py-3">
                  <span className="h-9 w-9 rounded-lg bg-[#f1f0ed] dark:bg-white/8" />
                  <span className="h-4 flex-1 rounded bg-[#f1f0ed] dark:bg-white/8" />
                  <span className="h-4 w-12 rounded bg-[#f1f0ed] dark:bg-white/8" />
                </div>
              ))}
            </div>
          ) : mobileEntries.length === 0 ? (
            <div className="flex min-h-[48vh] flex-col items-center justify-center px-8 text-center">
              <Clock size={25} strokeWidth={1.6} className="mb-3 text-[#b0b5be]" />
              <p className="text-[15px] font-semibold text-[#5a606b] dark:text-gray-300">Brak wpisów tego dnia</p>
              <p className="mt-1 max-w-[260px] text-[13px] leading-5 text-[#9098a4]">
                Wpisz poniżej, co robiłeś i ile czasu to zajęło.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#f1f0ed] dark:divide-white/8">
              {mobileEntries.map(entry => {
                const project = getProject(entry);
                const start = minutesFromIso(entry.startAt);
                const end = minutesFromIso(entry.endAt);
                const timeRange = start !== undefined && end !== undefined
                  ? `${formatMinutes(start)}–${formatMinutes(end)}`
                  : null;

                return (
                  <div
                    key={entry.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setEditingEntry(entry)}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setEditingEntry(entry);
                      }
                    }}
                    className="flex min-h-[66px] items-center gap-3 py-2.5 outline-none transition-colors active:bg-[#f7f7f4] focus-visible:bg-[#f7f7f4] dark:active:bg-white/5 dark:focus-visible:bg-white/5"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15.5px] font-medium leading-5 text-[#0f1115] dark:text-white">
                        {entry.taskContent}
                      </p>
                      <div className="mt-1 flex min-w-0 items-center gap-2 overflow-hidden whitespace-nowrap text-[12px] text-[#9098a4]">
                        {project && (
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: project.color || '#9098a4' }} />
                            <span className="truncate">{project.name}</span>
                          </span>
                        )}
                        {timeRange && <span className="flex-none">{timeRange}</span>}
                        {!project && !timeRange && <span>Bez projektu</span>}
                      </div>
                    </div>

                    <span className="flex-none text-[13px] font-semibold tabular-nums text-[#5a606b] dark:text-gray-300">
                      {formatDuration(entry.durationMinutes)}
                    </span>
                    <button
                      type="button"
                      aria-label={`Usuń wpis ${entry.taskContent}`}
                      onClick={event => {
                        event.stopPropagation();
                        void handleDeleteEntry(entry);
                      }}
                      disabled={deletingId === entry.id}
                      className="flex h-11 w-11 flex-none items-center justify-center rounded-lg text-[#b0b5be] transition-colors hover:bg-red-50 hover:text-red-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-500 disabled:opacity-40 dark:hover:bg-red-500/10"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 flex-col gap-4 lg:flex">
      <div className="flex flex-none flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
            <BarChart3 size={14} /> Ewidencja pracy
          </div>
          <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-[#0f1115] sm:text-2xl dark:text-white">{title}</h2>
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto">
          <div className="rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-semibold text-[#3a3f47] dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200">
            {formatTotal(totalMinutes)} h
          </div>
          <div ref={settingsRef} className="relative">
            <button
              type="button"
              onClick={() => setShowSettings(prev => !prev)}
              className={`flex h-10 w-10 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#27272A] dark:text-gray-300 dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/10 ${showSettings ? 'bg-[#f7f7f4] text-[#0f1115] dark:bg-[#323238] dark:text-white' : ''}`}
              title="Ustawienia Insights"
              aria-expanded={showSettings}
            >
              <Settings size={17} />
            </button>

            <div className={`absolute right-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-xl border border-[#e8e8e4] bg-white p-2 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] ${showSettings ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}>
              <div className="px-2 py-1.5">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                  <BookOpen size={13} /> Domyślny projekt
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  handleDefaultProjectChange(null);
                  setShowSettings(false);
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:focus:ring-white/10 ${effectiveDefaultProjectId === null ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}
              >
                <span className="h-2 w-2 rounded-full border border-[#c0c5cc]" />
                Bez projektu
              </button>

              <div className="max-h-60 overflow-y-auto custom-scrollbar">
                {projects.map(project => (
                  <button
                    key={project.id}
                    type="button"
                    onClick={() => {
                      handleDefaultProjectChange(project.id);
                      setShowSettings(false);
                    }}
                    className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12.5px] font-medium transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:focus:ring-white/10 ${effectiveDefaultProjectId === project.id ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}
                  >
                    <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: project.color || '#9098a4' }} />
                    <span className="truncate">{project.name}</span>
                  </button>
                ))}
              </div>
            </div>
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
        ) : mode === 'month' ? renderMonth() : renderTimeGrid()}
      </div>
      </div>

      <InsightQuickAddTime
        projects={projects}
        projectId={effectiveQuickProjectId}
        workDate={toDateKey(anchorDate)}
        onProjectChange={setQuickProjectId}
        onSubmit={handleCreateStandaloneEntry}
        isSaving={isCreatingEntry || isLoading}
      />

      {selectedWorkDate && (
        <StandaloneTimeEntryModal
          workDate={selectedWorkDate}
          projects={projects}
          projectId={effectiveQuickProjectId}
          onProjectChange={setQuickProjectId}
          onSubmit={handleCreateStandaloneEntry}
          onClose={() => setSelectedWorkDate(null)}
          isSaving={isCreatingEntry}
        />
      )}

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
