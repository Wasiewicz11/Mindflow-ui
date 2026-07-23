import { useState } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, Clock, FileText, Folder, TimerReset, X } from 'lucide-react';
import type { Project, Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import type { ApiTaskTimeEntry, CompleteTaskDto, CreateTaskTimeEntryDto, UpdateTaskTimeEntryDto } from '../api/timeEntriesApi';

type Mode = 'log' | 'complete' | 'edit';
type TaskTimeEntryTask = Pick<
  Task,
  'id' | 'content' | 'priority' | 'status' | 'dueDate' | 'estimatedHours' | 'loggedMinutes' | 'project_id' | 'description' | 'tags'
>;

interface Props {
  mode: Mode;
  task: TaskTimeEntryTask;
  entry?: ApiTaskTimeEntry;
  projects: Project[];
  onClose: () => void;
  onLogTime?: (taskId: string, dto: CreateTaskTimeEntryDto) => Promise<void> | void;
  onUpdateTime?: (entryId: string, dto: UpdateTaskTimeEntryDto) => Promise<void> | void;
  onComplete?: (taskId: string, dto: CompleteTaskDto) => Promise<void> | void;
}

const PRIORITY: Record<TaskPriority, { label: string; name: string; fg: string; bg: string }> = {
  [Priority.P1]: { label: 'P1', name: 'Pilne', fg: 'oklch(0.62 0.18 25)', bg: 'oklch(0.96 0.03 25)' },
  [Priority.P2]: { label: 'P2', name: 'Wysokie', fg: 'oklch(0.70 0.16 55)', bg: 'oklch(0.96 0.03 55)' },
  [Priority.P3]: { label: 'P3', name: 'Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)' },
  [Priority.P4]: { label: 'P4', name: 'Niskie', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const STATUS: Record<TaskStatus, { name: string; fg: string; bg: string; dot: string }> = {
  NotStarted: { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
  InProgress: { name: 'W trakcie', fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)', dot: 'oklch(0.60 0.18 230)' },
  Completed: { name: 'Ukończone', fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)', dot: 'oklch(0.55 0.18 145)' },
};

function toDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseDecimal(value: string, { allowZero = false }: { allowZero?: boolean } = {}): number | undefined {
  const normalized = value.replace(',', '.').trim();
  if (!normalized) return undefined;
  if (!/^(?:\d+|\d*[.]\d+)$/.test(normalized)) return undefined;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && (allowZero ? parsed >= 0 : parsed > 0) ? parsed : undefined;
}

function parseDurationMinutes(value: string): number | undefined {
  const hours = parseDecimal(value);
  if (hours === undefined) return undefined;
  const minutes = Math.round(hours * 60);
  return minutes > 0 ? minutes : undefined;
}

function minutesToHoursInput(minutes?: number | null) {
  if (!minutes || minutes <= 0) return '';
  const value = minutes / 60;
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

export function TaskTimeEntryModal({ mode, task, entry, projects, onClose, onLogTime, onUpdateTime, onComplete }: Props) {
  const [workDate, setWorkDate] = useState(entry?.workDate ?? toDateKey());
  const [estimatedHours, setEstimatedHours] = useState(
    entry?.estimatedHours != null ? String(entry.estimatedHours) : task.estimatedHours != null ? String(task.estimatedHours) : '',
  );
  const [durationHours, setDurationHours] = useState(minutesToHoursInput(entry?.durationMinutes));
  const [notes, setNotes] = useState(entry?.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const project = projects.find(p => p.id === task.project_id);
  const priority = PRIORITY[task.priority] ?? PRIORITY[Priority.P4];
  const status = STATUS[task.status] ?? STATUS.NotStarted;
  const isCompleteMode = mode === 'complete';
  const isEditMode = mode === 'edit';

  function buildPayload(): CompleteTaskDto | CreateTaskTimeEntryDto | UpdateTaskTimeEntryDto | null {
    setError(null);
    const dto: CompleteTaskDto = {};
    const estimate = parseDecimal(estimatedHours, { allowZero: true });
    const clearedEstimate = estimatedHours.trim() === '' && (task.estimatedHours != null || entry?.estimatedHours != null);
    const durationMinutes = parseDurationMinutes(durationHours);
    const normalizedNotes = notes.trim();

    if (!workDate) {
      setError('Podaj datę pracy.');
      return null;
    }

    if (estimate !== undefined) dto.estimatedHours = estimate;
    if (clearedEstimate) dto.clearEstimatedHours = true;

    if (workDate) dto.workDate = workDate;
    if (durationMinutes !== undefined) dto.durationMinutes = durationMinutes;
    if (normalizedNotes || isEditMode) dto.notes = normalizedNotes;

    if (!isCompleteMode && !dto.durationMinutes) {
      setError('Podaj czas pracy.');
      return null;
    }

    return dto;
  }

  async function handleSave() {
    if (isSaving) return;
    const payload = buildPayload();
    if (!payload) return;

    setIsSaving(true);
    try {
      if (isCompleteMode) {
        await onComplete?.(task.id, payload as CompleteTaskDto);
      } else if (isEditMode) {
        if (!entry) {
          setError('Brakuje wpisu czasu do edycji.');
          return;
        }
        await onUpdateTime?.(entry.id, payload as UpdateTaskTimeEntryDto);
      } else {
        await onLogTime?.(task.id, payload as CreateTaskTimeEntryDto);
      }
      onClose();
    } catch (err) {
      console.warn('Failed to save task time entry:', err);
      setError(isCompleteMode ? 'Nie udało się zamknąć zadania.' : isEditMode ? 'Nie udało się zaktualizować czasu.' : 'Nie udało się zapisać czasu.');
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void handleSave();
  }

  const title = isCompleteMode ? 'Potwierdzenie wykonania' : isEditMode ? 'Edycja czasu' : 'Rejestracja czasu';
  const submit = isCompleteMode ? 'Oznacz jako wykonane' : isEditMode ? 'Zapisz zmiany' : 'Zapisz czas';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div
        className="absolute inset-0 bg-[#0f1115]/[0.18] backdrop-blur-[2px]"
        onClick={onClose}
      />

      <div
        className="relative z-10 flex max-h-[90vh] w-full max-w-[460px] flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-[#27272A]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex flex-none items-center justify-between border-b border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">{title}</p>
            <h2 className="mt-1 truncate text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {task.content}
            </h2>
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
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold"
              style={{ color: priority.fg, background: priority.bg }}
            >
              {priority.label} — {priority.name}
            </span>
            <span
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11.5px] font-semibold"
              style={{ color: status.fg, background: status.bg }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: status.dot }} />
              {status.name}
            </span>
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-[#f7f7f4] px-2 py-1 text-[11.5px] font-medium text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
              <Folder size={12} />
              <span className="truncate">{project?.name ?? 'Bez projektu'}</span>
            </span>
          </div>

          <div className="grid gap-3">
            <label className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                <TimerReset size={13} /> Estymanta
              </span>
              <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 transition-colors duration-200 ease focus-within:border-[#9098a4] focus-within:bg-white dark:border-white/10 dark:bg-[#232326]">
                <input
                  type="text"
                  inputMode="decimal"
                  value={estimatedHours}
                  onChange={e => setEstimatedHours(e.target.value)}
                  placeholder="Opcjonalnie"
                  autoComplete="off"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0f1115] outline-none placeholder:text-[#b0b5be] dark:text-white"
                />
                <span className="text-[12px] font-medium text-[#9098a4]">h</span>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr]">
              <label className="grid gap-1.5">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                  <CalendarDays size={13} /> Data pracy
                </span>
                <input
                  type="date"
                  value={workDate}
                  onChange={e => setWorkDate(e.target.value)}
                  className="h-10 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 text-[13px] font-medium text-[#0f1115] outline-none transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:bg-white focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#232326] dark:text-white"
                />
              </label>

              <label className="grid gap-1.5">
                <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                  <Clock size={13} /> Czas pracy
                </span>
                <div className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 transition-colors duration-200 ease focus-within:border-[#9098a4] focus-within:bg-white dark:border-white/10 dark:bg-[#232326]">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={durationHours}
                    onChange={e => setDurationHours(e.target.value)}
                    placeholder="Opcjonalnie"
                    autoComplete="off"
                    className="min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#0f1115] outline-none placeholder:text-[#b0b5be] dark:text-white"
                  />
                  <span className="text-[12px] font-medium text-[#9098a4]">h</span>
                </div>
              </label>
            </div>

            <label className="grid gap-1.5">
              <span className="flex items-center gap-1.5 text-[12px] font-medium text-[#9098a4]">
                <FileText size={13} /> Notatki
              </span>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Opcjonalnie"
                rows={4}
                className="min-h-[96px] resize-none rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 text-[13px] font-medium text-[#0f1115] outline-none transition-colors duration-200 ease placeholder:text-[#b0b5be] hover:bg-[#f1f0ed] focus:bg-white focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#232326] dark:text-white"
              />
            </label>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] font-medium text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-none items-center justify-between border-t border-[#f1f0ed] px-5 py-3 dark:border-white/8">
          <span className="text-[11.5px] text-[#c0c5cc]">⌘ + Enter aby zapisać</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-3 py-2 text-[13px] font-medium text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] dark:hover:bg-[#323238] dark:hover:text-white"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#0f1115] px-4 py-2 text-[13px] font-semibold text-white transition-opacity duration-200 ease hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f7f7f4] dark:text-[#18181B]"
            >
              <Check size={14} />
              {isSaving ? 'Zapisuję...' : submit}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
