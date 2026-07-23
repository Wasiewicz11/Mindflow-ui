import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Filter,
  ListFilter,
  ListTodo,
  PanelRightClose,
  PanelRightOpen,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import type { Project, Subtask, Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import { getToken } from '../../../shared/api/client';
import type { CompleteTaskDto } from '../api/timeEntriesApi';
import {
  createCalendarBlock,
  deleteCalendarBlock,
  getCalendarBlocks,
  updateCalendarBlock,
  type ApiCalendarBlock,
  type CalendarProvider,
  type CalendarSyncStatus,
} from '../api/calendarApi';
import { TaskEditModal } from './TaskEditModal';
import { TomatoIcon, type PomodoroLaunchRequest } from '../../pomodoro';
import { CalendarSkeleton } from '../../../shared/ui/LoadingSkeletons';
import { TimePickerField } from '../../../shared/ui/TimePickerField';

type CalendarMode = 'day' | 'week' | 'month';
type FilterMenu = 'projects' | 'priorities' | 'statuses' | null;

type CalendarBlock = {
  id: string;
  taskId?: string | null;
  title?: string | null;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  provider: CalendarProvider;
  syncStatus: CalendarSyncStatus;
};

type DragState =
  | { type: 'sidebar'; taskId: string }
  | { type: 'move'; taskId?: string | null; blockId: string; offsetMinutes: number; duplicate: boolean }
  | null;

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  onAdd: (
    content: string,
    priority: TaskPriority,
    dueDate?: string,
    projectId?: string,
    status?: TaskStatus,
    description?: string,
    tags?: string[],
    subtasks?: Subtask[],
  ) => Promise<Task | void> | Task | void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onComplete?: (id: string, dto: CompleteTaskDto) => void | Promise<void>;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
  onStartFocus: (request: PomodoroLaunchRequest) => void;
  isLoading?: boolean;
}

type CalendarAddSlot = {
  date: string;
  startMinutes: number;
  durationMinutes: number;
};

type SlotSelection = {
  date: string;
  anchorMinutes: number;
  currentMinutes: number;
};

const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const DAY_START = 6 * 60;
const DAY_END = 23 * 60;
const HOUR_HEIGHT = 72;
const MIN_BLOCK = 30;
const DEFAULT_BLOCK = 60;

const PRIORITY_META: Record<TaskPriority, { label: string; fg: string; bg: string; ring: string; rank: number }> = {
  [Priority.P1]: { label: 'P1', fg: 'oklch(0.62 0.18 25)', bg: 'oklch(0.96 0.03 25)', ring: 'oklch(0.78 0.12 25)', rank: 1 },
  [Priority.P2]: { label: 'P2', fg: 'oklch(0.70 0.16 55)', bg: 'oklch(0.96 0.03 55)', ring: 'oklch(0.82 0.10 55)', rank: 2 },
  [Priority.P3]: { label: 'P3', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)', ring: 'oklch(0.78 0.10 230)', rank: 3 },
  [Priority.P4]: { label: 'P4', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)', ring: 'oklch(0.78 0.01 260)', rank: 4 },
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  NotStarted: 'Nie rozpoczęto',
  InProgress: 'W trakcie',
  Completed: 'Ukończone',
};

const MODAL_PRIORITY: Record<TaskPriority, { label: string; name: string; fg: string; bg: string }> = {
  [Priority.P1]: { label: 'P1', name: 'Pilne', fg: 'oklch(0.62 0.18 25)', bg: 'oklch(0.96 0.03 25)' },
  [Priority.P2]: { label: 'P2', name: 'Wysokie', fg: 'oklch(0.70 0.16 55)', bg: 'oklch(0.96 0.03 55)' },
  [Priority.P3]: { label: 'P3', name: 'Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)' },
  [Priority.P4]: { label: 'P4', name: 'Niskie', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const MODAL_STATUS: Record<TaskStatus, { name: string; fg: string; bg: string; dot: string }> = {
  NotStarted: { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
  InProgress: { name: 'W trakcie', fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)', dot: 'oklch(0.60 0.18 230)' },
  Completed: { name: 'Ukończone', fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)', dot: 'oklch(0.55 0.18 145)' },
};

function ClockIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>;
}

function FolderIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" /></svg>;
}

function FlagSmall({ color }: { color: string }) {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ color }}><path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd" /></svg>;
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function StatusIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>;
}

function getPriorityMeta(priority: TaskPriority | undefined) {
  return priority && PRIORITY_META[priority] ? PRIORITY_META[priority] : PRIORITY_META[Priority.P4];
}

function getStatusLabel(status: TaskStatus | undefined) {
  return status && STATUS_LABEL[status] ? STATUS_LABEL[status] : STATUS_LABEL.NotStarted;
}

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
  const first = new Date(date.getFullYear(), date.getMonth(), 1, 12);
  return startOfWeek(first);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundToQuarter(minutes: number) {
  return Math.round(minutes / 15) * 15;
}

function formatMinutes(minutes: number) {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function parseTimeToMinutes(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return 9 * 60;
  return clamp(hours * 60 + minutes, 0, 24 * 60 - 1);
}

function minutesFromDate(date: Date) {
  return date.getHours() * 60 + date.getMinutes();
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} godz. ${m} min` : `${h} godz.`;
}

function formatRemaining(minutes: number) {
  const total = Math.max(0, minutes);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

function toLocalIsoWithOffset(date: string, minutes: number) {
  const [year, month, day] = date.split('-').map(Number);
  const localDate = new Date(year, month - 1, day, Math.floor(minutes / 60), minutes % 60, 0, 0);
  const offsetMinutes = -localDate.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = String(Math.floor(absOffset / 60)).padStart(2, '0');
  const offsetMins = String(absOffset % 60).padStart(2, '0');

  return `${localDate.getFullYear()}-${String(localDate.getMonth() + 1).padStart(2, '0')}-${String(localDate.getDate()).padStart(2, '0')}T${String(localDate.getHours()).padStart(2, '0')}:${String(localDate.getMinutes()).padStart(2, '0')}:00${sign}${offsetHours}:${offsetMins}`;
}

function mapApiBlock(block: ApiCalendarBlock): CalendarBlock {
  const start = new Date(block.startAt);
  return {
    id: block.id,
    taskId: block.taskId,
    title: block.title,
    date: toDateKey(start),
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    durationMinutes: block.durationMinutes,
    // API serializes the enum in PascalCase ("Google"/"Local"); normalize to our lowercase union
    provider: (block.provider?.toLowerCase() as CalendarProvider) ?? 'local',
    syncStatus: (block.syncStatus?.toLowerCase() as CalendarSyncStatus) ?? 'local',
  };
}

type BlockColumn = { index: number; count: number };

// Lay overlapping blocks side by side: group blocks that overlap (transitively),
// assign each the first free lane, and give the whole group the same column count.
function getDayBlockLayout(dayBlocks: CalendarBlock[]): Map<string, BlockColumn> {
  const sorted = [...dayBlocks].sort(
    (a, b) => a.startMinutes - b.startMinutes || b.durationMinutes - a.durationMinutes,
  );
  const result = new Map<string, BlockColumn>();
  let group: { id: string; col: number }[] = [];
  let laneEnds: number[] = [];
  let groupMaxEnd = -1;

  const flush = () => {
    const count = laneEnds.length;
    for (const item of group) result.set(item.id, { index: item.col, count });
    group = [];
    laneEnds = [];
    groupMaxEnd = -1;
  };

  for (const block of sorted) {
    const end = block.startMinutes + block.durationMinutes;
    if (group.length && block.startMinutes >= groupMaxEnd) flush();
    let col = laneEnds.findIndex(laneEnd => laneEnd <= block.startMinutes);
    if (col === -1) {
      col = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[col] = end;
    }
    group.push({ id: block.id, col });
    groupMaxEnd = Math.max(groupMaxEnd, end);
  }
  if (group.length) flush();
  return result;
}

function blockColumnStyle(layout?: BlockColumn): CSSProperties {
  if (!layout || layout.count <= 1) return { left: 4, right: 4 };
  const widthPct = 100 / layout.count;
  return { left: `calc(${layout.index * widthPct}% + 2px)`, width: `calc(${widthPct}% - 4px)` };
}

function getWeekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthDays(anchor: Date) {
  const start = startOfMonthGrid(anchor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function CalendarTaskAddModal({
  slot,
  projects,
  onClose,
  onAdd,
}: {
  slot: CalendarAddSlot;
  projects: Project[];
  onClose: () => void;
  onAdd: (input: {
    content: string;
    addAsTask: boolean;
    priority: TaskPriority;
    status: TaskStatus;
    projectId?: string;
    description?: string;
    tags?: string[];
    subtasks?: Subtask[];
    date: string;
    startMinutes: number;
    durationMinutes: number;
  }) => Promise<void>;
}) {
  const [content, setContent]         = useState('');
  const [addAsTask, setAddAsTask]     = useState(false);
  const [description, setDescription] = useState('');
  const [priority, setPriority]       = useState<TaskPriority>(Priority.P4);
  const [status, setStatus]           = useState<TaskStatus>('NotStarted');
  const [projectId, setProjectId]     = useState('');
  const [startMinutes, setStartMinutes] = useState(slot.startMinutes);
  const [durationMinutes, setDurationMinutes] = useState(slot.durationMinutes);
  const [tags, setTags] = useState<string[]>([]);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newTag, setNewTag] = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [isSaving, setIsSaving]       = useState(false);

  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker]     = useState(false);
  const [showProjectPicker, setShowProjectPicker]   = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [content]);

  const safeDuration = clamp(durationMinutes, MIN_BLOCK, DAY_END - startMinutes);
  const endMinutes = startMinutes + safeDuration;
  const activeProject = projects.find(p => p.id === projectId);
  const p = MODAL_PRIORITY[priority] ?? MODAL_PRIORITY[Priority.P4];
  const s = MODAL_STATUS[status] ?? MODAL_STATUS.NotStarted;
  const completedSubtasks = subtasks.filter(subtask => subtask.isCompleted).length;
  const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

  async function handleSave() {
    if (!content.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onAdd({
        content: content.trim(),
        addAsTask,
        priority,
        status,
        projectId: projectId || undefined,
        description: description.trim() || undefined,
        tags: tags.length > 0 ? tags : undefined,
        subtasks: subtasks.length > 0 ? subtasks : undefined,
        date: slot.date,
        startMinutes,
        durationMinutes: safeDuration,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  function addTag() {
    const tag = newTag.trim();
    if (tag && !tags.includes(tag)) setTags(prev => [...prev, tag]);
    setNewTag('');
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(item => item !== tag));
  }

  function addSubtask() {
    const content = newSubtask.trim();
    if (!content) return;
    setSubtasks(prev => [...prev, { id: crypto.randomUUID(), content, isCompleted: false, status: 'NotStarted' }]);
    setNewSubtask('');
  }

  function toggleSubtask(id: string) {
    setSubtasks(prev => prev.map(subtask => subtask.id === id ? { ...subtask, isCompleted: !subtask.isCompleted } : subtask));
  }

  const ROW   = 'flex items-start gap-3 py-2.5 border-b border-[#f1f0ed] cursor-pointer';
  const LABEL = 'flex items-center gap-1.5 text-[12.5px] text-[#9098a4] flex-none w-[88px]';
  const VALUE = 'flex-1 text-[13px] text-[#0f1115]';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.18)' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 420,
          maxHeight: '90vh',
          background: '#fff',
          border: '1px solid #e8e8e4',
          borderRadius: 18,
          boxShadow: '0 24px 48px -12px rgba(15,17,21,.22)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-none flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f1f0ed' }}>
          <span className="text-[13px] font-semibold text-[#0f1115]">{addAsTask ? 'Nowe zadanie' : 'Nowy blok czasu'}</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-[#0f1115] hover:bg-[#f1f1ef]"
            style={{ width: 28, height: 28 }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-1">
          <textarea
            ref={titleRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={1}
            autoFocus
            placeholder={addAsTask ? 'Nazwa zadania' : 'Nazwa bloku czasu'}
            className="w-full resize-none outline-none bg-transparent leading-snug"
            style={{ fontSize: 20, fontWeight: 650, color: '#0f1115', letterSpacing: '-0.01em', minHeight: 32 }}
          />

          <div style={{ marginTop: 12 }}>
            <button
              type="button"
              aria-pressed={addAsTask}
              onClick={() => setAddAsTask(value => !value)}
              className={`${ROW} w-full text-left`}
            >
              <span className={LABEL}><Check size={13} /> Zadanie</span>
              <span className={`${VALUE} flex items-center`}>
                <span
                  className="relative inline-flex h-[22px] w-[38px] flex-none items-center rounded-full border transition-colors duration-200 ease"
                  style={{
                    background: addAsTask ? '#0f1115' : '#f1f0ed',
                    borderColor: addAsTask ? '#0f1115' : '#deded9',
                  }}
                >
                  <span
                    className="absolute h-[16px] w-[16px] rounded-full bg-white shadow-sm transition-transform duration-200 ease"
                    style={{
                      left: 2,
                      transform: addAsTask ? 'translateX(16px)' : 'translateX(0)',
                    }}
                  />
                </span>
              </span>
            </button>

            {addAsTask && (
              <>
            <div className="relative">
              <div className={ROW} onClick={() => { setShowStatusPicker(o => !o); setShowPriorityPicker(false); setShowProjectPicker(false); }}>
                <span className={LABEL}><StatusIcon /> Status</span>
                <span className={VALUE}>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-[5px]" style={{ padding: '2px 7px', color: s.fg, background: s.bg }}>
                    <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: s.dot }} />
                    {s.name}
                  </span>
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 170,
                  opacity: showStatusPicker ? 1 : 0,
                  transform: showStatusPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showStatusPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                {(Object.entries(MODAL_STATUS) as [TaskStatus, typeof MODAL_STATUS.NotStarted][]).map(([k, v]) => (
                  <button key={k} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: k === status ? v.fg : '#0f1115' }} onClick={() => { setStatus(k); setShowStatusPicker(false); }}>
                    <span className="rounded-full flex-none" style={{ width: 7, height: 7, background: v.dot }} />
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className={ROW} onClick={() => { setShowPriorityPicker(o => !o); setShowStatusPicker(false); setShowProjectPicker(false); }}>
                <span className={LABEL}><FlagSmall color={p.fg} /> Priorytet</span>
                <span className={VALUE}>
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-[5px]" style={{ padding: '2px 7px', color: p.fg, background: p.bg }}>
                    {p.label} — {p.name}
                  </span>
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 160,
                  opacity: showPriorityPicker ? 1 : 0,
                  transform: showPriorityPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showPriorityPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                {(Object.entries(MODAL_PRIORITY) as [TaskPriority, (typeof MODAL_PRIORITY)[TaskPriority]][]).map(([k, v]) => (
                  <button key={k} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: k === priority ? v.fg : '#0f1115' }} onClick={() => { setPriority(k); setShowPriorityPicker(false); }}>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-[4px] flex-none" style={{ padding: '1px 5px', color: v.fg, background: v.bg }}>{v.label}</span>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className={ROW} onClick={() => { setShowProjectPicker(o => !o); setShowPriorityPicker(false); setShowStatusPicker(false); }}>
                <span className={LABEL}><FolderIcon /> Projekt</span>
                <span className={VALUE}>
                  {activeProject ? (
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full inline-block" style={{ width: 7, height: 7, background: activeProject.color || '#9aa0aa', flexShrink: 0 }} />
                      {activeProject.name}
                    </span>
                  ) : (
                    <span className="text-[#b0b5be]">Bez projektu</span>
                  )}
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 180,
                  opacity: showProjectPicker ? 1 : 0,
                  transform: showProjectPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showProjectPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                <button className="w-full flex items-center gap-2.5 text-[13px] text-[#9098a4] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px' }} onClick={() => { setProjectId(''); setShowProjectPicker(false); }}>Bez projektu</button>
                {projects.map(proj => (
                  <button key={proj.id} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: proj.id === projectId ? '#0f1115' : '#3a3f47', fontWeight: proj.id === projectId ? 600 : 400 }} onClick={() => { setProjectId(proj.id); setShowProjectPicker(false); }}>
                    <span className="rounded-full flex-none" style={{ width: 7, height: 7, background: proj.color || '#9aa0aa' }} />
                    {proj.name}
                  </button>
                ))}
              </div>
            </div>
              </>
            )}

            <div className={ROW} style={{ cursor: 'default' }}>
              <span className={LABEL}><ClockIcon /> Czas</span>
              <span className={`${VALUE} grid grid-cols-3 gap-2`}>
                <TimePickerField
                  label="Od"
                  value={formatMinutes(startMinutes)}
                  onChange={value => setStartMinutes(clamp(parseTimeToMinutes(value), DAY_START, DAY_END - MIN_BLOCK))}
                  clearable={false}
                  minMinutes={DAY_START}
                  maxMinutes={DAY_END - MIN_BLOCK}
                  size="compact"
                />
                <label className="text-[10.5px] font-medium text-[#9098a4]">
                  Czas
                  <input
                    type="number"
                    min={MIN_BLOCK}
                    step={15}
                    value={safeDuration}
                    onChange={e => setDurationMinutes(clamp(Number(e.target.value) || MIN_BLOCK, MIN_BLOCK, DAY_END - startMinutes))}
                    className="mt-1 w-full rounded-[6px] border border-[#ececec] bg-[#f7f7f4] px-2 py-1.5 text-[12px] font-medium text-[#0f1115] outline-none transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:bg-white focus:ring-2 focus:ring-[#0f1115]/20"
                  />
                </label>
                <TimePickerField
                  label="Do"
                  value={formatMinutes(endMinutes)}
                  onChange={() => undefined}
                  clearable={false}
                  readOnly
                  size="compact"
                />
              </span>
            </div>

            {addAsTask && (
            <div className={`${ROW} flex-wrap`} style={{ borderBottom: 'none' }}>
              <span className={LABEL} style={{ paddingTop: 1 }}><TagIcon /> Etykiety</span>
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium rounded-[5px]"
                    style={{ padding: '2px 6px 2px 8px', background: '#f1f0ed', color: '#5a606b' }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-[#9098a4] hover:text-[#0f1115] transition-colors"
                      style={{ lineHeight: 1, marginLeft: 1 }}
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder="+ Etykieta"
                  className="text-[11.5px] outline-none bg-transparent placeholder:text-[#b0b5be]"
                  style={{ color: '#9098a4', minWidth: 70, maxWidth: 100 }}
                />
              </div>
            </div>
            )}
          </div>

          {addAsTask && (
            <>
          <div style={{ height: 1, background: '#f1f0ed', margin: '4px 0 12px' }} />

          <div>
            <p className="text-[11.5px] font-medium text-[#b0b5be] mb-1.5 uppercase tracking-wider">Opis</p>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Dodaj kontekst, linki, kroki..."
              maxLength={500}
              className="w-full resize-none outline-none text-[13.5px] text-[#0f1115] rounded-xl leading-relaxed placeholder:text-[#b0b5be]"
              style={{ background: '#f7f7f4', border: '1px solid #ececec', padding: '10px 12px', minHeight: 80 }}
            />
          </div>

          <div style={{ paddingTop: 6 }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] font-medium text-[#b0b5be] uppercase tracking-wider">
                Podzadania{subtasks.length > 0 ? ` ${completedSubtasks}/${subtasks.length}` : ''}
              </p>
            </div>

            {subtasks.length > 0 && (
              <div className="rounded-full overflow-hidden mb-3" style={{ height: 3, background: '#ececec' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${subtaskProgress}%`, background: '#0f1115' }}
                />
              </div>
            )}

            <div className="space-y-0.5">
              {subtasks.map(subtask => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-2.5 py-1.5 group/sub"
                >
                  <button
                    onClick={() => toggleSubtask(subtask.id)}
                    className="flex-none rounded-full border transition-all"
                    style={{
                      width: 16, height: 16,
                      borderColor: subtask.isCompleted ? '#0f1115' : '#d4d4d0',
                      background: subtask.isCompleted ? '#0f1115' : 'transparent',
                      flexShrink: 0,
                    }}
                  >
                    {subtask.isCompleted && (
                      <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                        <path d="M5 13l4 4L19 7"/>
                      </svg>
                    )}
                  </button>
                  <span
                    className="text-[13px] flex-1"
                    style={{
                      color: subtask.isCompleted ? '#9098a4' : '#0f1115',
                      textDecoration: subtask.isCompleted ? 'line-through' : 'none',
                    }}
                  >
                    {subtask.content}
                  </span>
                  <button
                    onClick={() => setSubtasks(prev => prev.filter(item => item.id !== subtask.id))}
                    className="opacity-0 group-hover/sub:opacity-100 transition-opacity text-[#9098a4] hover:text-red-500"
                  >
                    <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M18 6 6 18M6 6l12 12"/>
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            <div
              className="flex items-center gap-2 mt-1.5 rounded-xl border border-dashed transition-colors"
              style={{ padding: '7px 10px', borderColor: '#e3e3df' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c8c8c0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e3e3df'; }}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#9098a4" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <input
                type="text"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                placeholder="Dodaj podzadanie..."
                className="flex-1 text-[12.5px] outline-none bg-transparent placeholder:text-[#b0b5be]"
                style={{ color: '#9098a4' }}
              />
            </div>
          </div>
            </>
          )}
        </div>

        <div className="flex-none flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f1f0ed' }}>
          <p className="text-[11.5px] text-[#c0c5cc]">⌘ + Enter aby zapisać</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[13px] font-medium text-[#9098a4] hover:text-[#0f1115] rounded-xl transition-colors" style={{ padding: '8px 14px' }}>
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim() || isSaving}
              className="flex items-center gap-2 text-[13px] font-semibold text-white rounded-xl transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ padding: '8px 16px', background: '#0f1115' }}
            >
              {isSaving ? 'Tworzę...' : addAsTask ? 'Dodaj zadanie' : 'Dodaj blok'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

function CalendarBlockEditModal({
  block,
  onClose,
  onSave,
}: {
  block: CalendarBlock;
  onClose: () => void;
  onSave: (input: {
    title: string;
    startMinutes: number;
    durationMinutes: number;
  }) => Promise<void>;
}) {
  const [title, setTitle] = useState(block.title ?? 'Blok czasu');
  const [startMinutes, setStartMinutes] = useState(block.startMinutes);
  const [durationMinutes, setDurationMinutes] = useState(block.durationMinutes);
  const [isSaving, setIsSaving] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [title]);

  const safeDuration = clamp(durationMinutes, MIN_BLOCK, DAY_END - startMinutes);
  const endMinutes = startMinutes + safeDuration;
  const ROW = 'flex items-start gap-3 py-2.5 border-b border-[#f1f0ed] cursor-default';
  const LABEL = 'flex items-center gap-1.5 text-[12.5px] text-[#9098a4] flex-none w-[88px]';
  const VALUE = 'flex-1 text-[13px] text-[#0f1115]';

  async function handleSave() {
    if (!title.trim() || isSaving) return;
    setIsSaving(true);
    try {
      await onSave({
        title: title.trim(),
        startMinutes,
        durationMinutes: safeDuration,
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.18)' }}
        onClick={onClose}
      />

      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 420,
          maxHeight: '90vh',
          background: '#fff',
          border: '1px solid #e8e8e4',
          borderRadius: 18,
          boxShadow: '0 24px 48px -12px rgba(15,17,21,.22)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex-none flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f1f0ed' }}>
          <span className="text-[13px] font-semibold text-[#0f1115]">Edytuj blok czasu</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-[#0f1115] hover:bg-[#f1f1ef]"
            style={{ width: 28, height: 28 }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4">
          <textarea
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            rows={1}
            autoFocus
            placeholder="Nazwa bloku czasu"
            className="w-full resize-none outline-none bg-transparent leading-snug"
            style={{ fontSize: 20, fontWeight: 650, color: '#0f1115', letterSpacing: '-0.01em', minHeight: 32 }}
          />

          <div style={{ marginTop: 12 }}>
            <div className={ROW}>
              <span className={LABEL}><ClockIcon /> Czas</span>
              <span className={`${VALUE} grid grid-cols-3 gap-2`}>
                <TimePickerField
                  label="Od"
                  value={formatMinutes(startMinutes)}
                  onChange={value => setStartMinutes(clamp(parseTimeToMinutes(value), DAY_START, DAY_END - MIN_BLOCK))}
                  clearable={false}
                  minMinutes={DAY_START}
                  maxMinutes={DAY_END - MIN_BLOCK}
                  size="compact"
                />
                <label className="text-[10.5px] font-medium text-[#9098a4]">
                  Czas
                  <input
                    type="number"
                    min={MIN_BLOCK}
                    step={15}
                    value={safeDuration}
                    onChange={e => setDurationMinutes(clamp(Number(e.target.value) || MIN_BLOCK, MIN_BLOCK, DAY_END - startMinutes))}
                    className="mt-1 w-full rounded-[6px] border border-[#ececec] bg-[#f7f7f4] px-2 py-1.5 text-[12px] font-medium text-[#0f1115] outline-none transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:bg-white focus:ring-2 focus:ring-[#0f1115]/20"
                  />
                </label>
                <TimePickerField
                  label="Do"
                  value={formatMinutes(endMinutes)}
                  onChange={() => undefined}
                  clearable={false}
                  readOnly
                  size="compact"
                />
              </span>
            </div>
          </div>
        </div>

        <div className="flex-none flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f1f0ed' }}>
          <p className="text-[11.5px] text-[#c0c5cc]">⌘ + Enter aby zapisać</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[13px] font-medium text-[#9098a4] hover:text-[#0f1115] rounded-xl transition-colors" style={{ padding: '8px 14px' }}>
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={!title.trim() || isSaving}
              className="flex items-center gap-2 text-[13px] font-semibold text-white rounded-xl transition-opacity hover:opacity-80 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ padding: '8px 16px', background: '#0f1115' }}
            >
              {isSaving ? 'Zapisuję...' : 'Zapisz'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

const MOBILE_QUERY = '(max-width: 1023px)';

function getIsMobile() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches;
}

export function CalendarView({ tasks, projects, onAdd, onEdit, onComplete, onToggle, onDelete, onStartFocus, isLoading = false }: CalendarViewProps) {
  const [isMobile, setIsMobile] = useState(getIsMobile);
  const [mode, setMode] = useState<CalendarMode>(() => (getIsMobile() ? 'day' : 'week'));
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [now, setNow] = useState(() => new Date());
  const [blocks, setBlocks] = useState<Record<string, CalendarBlock>>({});
  const [isBlocksLoading, setIsBlocksLoading] = useState(true);
  const [showGoogleEvents, setShowGoogleEvents] = useState<boolean>(
    () => localStorage.getItem('mindflow_show_google_events') !== 'false',
  );
  const [dragState, setDragState] = useState<DragState>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const modeTouchedRef = useRef(false);
  const [query, setQuery] = useState('');
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<TaskStatus[]>([]);
  const [selectedPriorities, setSelectedPriorities] = useState<TaskPriority[]>([]);
  const [openFilterMenu, setOpenFilterMenu] = useState<FilterMenu>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingBlock, setEditingBlock] = useState<CalendarBlock | null>(null);
  const [blockContextMenu, setBlockContextMenu] = useState<{ blockId: string; x: number; y: number } | null>(null);
  const [addingSlot, setAddingSlot] = useState<CalendarAddSlot | null>(null);
  const [dropPreview, setDropPreview] = useState<{ date: string; startMinutes: number; durationMinutes: number } | null>(null);
  const [slotSelection, setSlotSelection] = useState<SlotSelection | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const suppressBlockClickUntilRef = useRef(0);

  const activeTasks = useMemo(() => tasks.filter(task => !task.isCompleted), [tasks]);
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const days = useMemo(
    () => mode === 'month' ? getMonthDays(anchorDate) : mode === 'week' ? getWeekDays(anchorDate) : [anchorDate],
    [anchorDate, mode],
  );
  const todayKey = toDateKey(now);
  const currentMinutes = minutesFromDate(now);
  const currentTimeTop = ((currentMinutes - DAY_START) / 60) * HOUR_HEIGHT;
  const showCurrentTimeIndicator = currentMinutes >= DAY_START && currentMinutes <= DAY_END;
  const currentTimeLabel = formatMinutes(currentMinutes);
  const fromKey = toDateKey(days[0]);
  const toKey = toDateKey(days[days.length - 1]);

  const upsertApiBlock = useCallback((apiBlock: ApiCalendarBlock) => {
    const mapped = mapApiBlock(apiBlock);
    setBlocks(prev => ({ ...prev, [mapped.id]: mapped }));
  }, []);

  useEffect(() => {
    if (mode === 'month') return;
    const todayInRange = fromKey <= todayKey && todayKey <= toKey;
    if (!todayInRange) return;
    const id = window.requestAnimationFrame(() => {
      const grid = gridRef.current;
      if (!grid) return;
      const headerHeight = 56;
      const target = headerHeight + currentTimeTop - grid.clientHeight * 0.28;
      grid.scrollTo({ top: Math.max(0, target), behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, anchorDate, fromKey, toKey, todayKey]);

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setIsBlocksLoading(true);
    });

    getCalendarBlocks(fromKey, toKey)
      .then(apiBlocks => {
        if (cancelled) return;
        setBlocks(prev => {
          const next = Object.fromEntries(
            Object.entries(prev).filter(([, block]) => block.date < fromKey || block.date > toKey)
          );
          for (const block of apiBlocks) {
            const mapped = mapApiBlock(block);
            next[mapped.id] = mapped;
          }
          return next;
        });
      })
      .catch(error => {
        console.error('Failed to fetch calendar blocks', error);
      })
      .finally(() => {
        if (!cancelled) setIsBlocksLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey]);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobile(event.matches);
      if (!modeTouchedRef.current) {
        setMode(prev => {
          if (event.matches) return prev === 'week' ? 'day' : prev;
          return prev === 'day' ? 'week' : prev;
        });
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

  const selectMode = useCallback((next: CalendarMode) => {
    modeTouchedRef.current = true;
    setMode(next);
  }, []);

  useEffect(() => {
    let intervalId: number | undefined;
    const syncNow = () => setNow(new Date());
    const current = new Date();
    const msToNextMinute = (60 - current.getSeconds()) * 1000 - current.getMilliseconds();
    const timeoutId = window.setTimeout(() => {
      syncNow();
      intervalId = window.setInterval(syncNow, 60_000);
    }, Math.max(msToNextMinute, 250));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!blockContextMenu) return;

    const closeOnOutsideInteraction = (event: Event) => {
      const target = event.target;
      if (target instanceof Element && target.closest('[data-block-context-menu="true"]')) return;
      setBlockContextMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBlockContextMenu(null);
    };

    document.addEventListener('pointerdown', closeOnOutsideInteraction, true);
    document.addEventListener('contextmenu', closeOnOutsideInteraction, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideInteraction, true);
      document.removeEventListener('contextmenu', closeOnOutsideInteraction, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [blockContextMenu]);

  useEffect(() => {
    const token = getToken();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/tasks${token ? `?access_token=${token}` : ''}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('CalendarBlockCreated', upsertApiBlock);
    connection.on('CalendarBlockUpdated', upsertApiBlock);
    connection.on('CalendarBlockDeleted', (payload: { id: string }) => {
      setBlocks(prev => {
        const next = { ...prev };
        delete next[payload.id];
        return next;
      });
    });

    connection.start().catch(error => {
      console.warn('Calendar SignalR connection failed:', error);
    });

    connectionRef.current = connection;

    return () => {
      connection.stop();
      connectionRef.current = null;
    };
  }, [upsertApiBlock]);

  const filteredTasks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activeTasks
      .filter(task => (q ? task.content.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q) : true))
      .filter(task => selectedProjectIds.length === 0 || selectedProjectIds.includes(task.project_id ?? 'none'))
      .filter(task => selectedStatuses.length === 0 || selectedStatuses.includes(task.status))
      .filter(task => selectedPriorities.length === 0 || selectedPriorities.includes(task.priority))
      .sort((a, b) => {
        const byPriority = getPriorityMeta(a.priority).rank - getPriorityMeta(b.priority).rank;
        if (byPriority !== 0) return byPriority;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [activeTasks, query, selectedPriorities, selectedProjectIds, selectedStatuses]);

  const visibleBlocks = useMemo(() => {
    const dayKeys = new Set(days.map(toDateKey));
    return Object.values(blocks).filter(block =>
      dayKeys.has(block.date)
      && (!block.taskId || taskById.has(block.taskId))
      && (showGoogleEvents || block.provider !== 'google'));
  }, [blocks, days, taskById, showGoogleEvents]);

  const hasGoogleBlocks = useMemo(
    () => Object.values(blocks).some(block => block.provider === 'google'),
    [blocks],
  );

  const isCalendarLoading = isLoading || isBlocksLoading;

  if (isCalendarLoading) return <CalendarSkeleton />;

  function getBlockForTask(taskId: string) {
    return Object.values(blocks)
      .filter(block => block.taskId === taskId)
      .sort((a, b) => `${a.date}-${a.startMinutes}`.localeCompare(`${b.date}-${b.startMinutes}`))[0];
  }

  function updateLocalBlock(blockId: string, patch: Partial<CalendarBlock>) {
    setBlocks(prev => {
      const existing = prev[blockId];
      if (!existing) return prev;
      return {
        ...prev,
        [blockId]: {
          ...existing,
          ...patch,
          durationMinutes: Math.max(MIN_BLOCK, patch.durationMinutes ?? existing.durationMinutes),
        },
      };
    });
  }

  async function persistBlock(block: CalendarBlock) {
    try {
      const updated = await updateCalendarBlock(block.id, {
        taskId: block.taskId ?? null,
        title: block.title ?? null,
        startAt: toLocalIsoWithOffset(block.date, block.startMinutes),
        durationMinutes: block.durationMinutes,
      });
      upsertApiBlock(updated);
    } catch (error) {
      console.error('Failed to update calendar block', error);
    }
  }

  async function moveCalendarBlock(block: CalendarBlock, date: string, startMinutes: number) {
    const safeStart = clamp(roundToQuarter(startMinutes), DAY_START, DAY_END - MIN_BLOCK);
    const safeDuration = clamp(block.durationMinutes, MIN_BLOCK, DAY_END - safeStart);
    const optimistic = { ...block, date, startMinutes: safeStart, durationMinutes: safeDuration };

    updateLocalBlock(block.id, optimistic);
    persistBlock(optimistic);

    if (block.taskId) onEdit(block.taskId, { dueDate: date });
  }

  function getDraggedBlock(e: React.DragEvent<HTMLDivElement>) {
    const blockId = e.dataTransfer.getData('application/mindflow-calendar-block')
      || (dragState?.type === 'move' ? dragState.blockId : '');
    if (!blockId) return null;

    const block = blocks[blockId];
    if (!block) return null;

    const rawOffset = e.dataTransfer.getData('application/mindflow-calendar-offset');
    const offsetMinutes = rawOffset !== '' && Number.isFinite(Number(rawOffset))
      ? Number(rawOffset)
      : dragState?.type === 'move'
        ? dragState.offsetMinutes
        : 0;
    const duplicate = e.dataTransfer.getData('application/mindflow-calendar-duplicate') === 'true'
      || (dragState?.type === 'move' ? dragState.duplicate : false);

    return { block, offsetMinutes, duplicate };
  }

  async function saveStandaloneBlock(block: CalendarBlock, input: { title: string; startMinutes: number; durationMinutes: number }) {
    const safeStart = clamp(roundToQuarter(input.startMinutes), DAY_START, DAY_END - MIN_BLOCK);
    const safeDuration = clamp(input.durationMinutes, MIN_BLOCK, DAY_END - safeStart);
    const optimistic = {
      ...block,
      title: input.title,
      startMinutes: safeStart,
      durationMinutes: safeDuration,
    };

    updateLocalBlock(block.id, optimistic);

    try {
      const updated = await updateCalendarBlock(block.id, {
        taskId: null,
        title: input.title,
        startAt: toLocalIsoWithOffset(block.date, safeStart),
        durationMinutes: safeDuration,
      });
      upsertApiBlock(updated);
    } catch (error) {
      console.error('Failed to update calendar block', error);
    }
  }

  async function deleteBlock(blockId: string) {
    setBlocks(prev => {
      const next = { ...prev };
      delete next[blockId];
      return next;
    });
    setEditingBlock(null);
    setBlockContextMenu(null);

    try {
      await deleteCalendarBlock(blockId);
    } catch (error) {
      console.error('Failed to delete calendar block', error);
    }
  }

  function startFocusForBlock(blockId: string) {
    const block = blocks[blockId];
    if (!block) return;
    const task = block.taskId ? taskById.get(block.taskId) : undefined;
    const startAt = new Date(`${block.date}T00:00:00`);
    startAt.setMinutes(block.startMinutes);
    const endAt = new Date(startAt.getTime() + block.durationMinutes * 60_000);
    const isActiveNow = now.getTime() >= startAt.getTime() && now.getTime() < endAt.getTime();

    onStartFocus({
      requestId: `${block.id}-${Date.now()}`,
      taskId: block.taskId,
      title: task?.content ?? block.title ?? 'Blok czasu',
      taskEndsAt: isActiveNow ? endAt.toISOString() : undefined,
    });
    setBlockContextMenu(null);
  }

  function openBlockContextMenu(event: React.MouseEvent, blockId: string) {
    event.preventDefault();
    event.stopPropagation();
    const menuWidth = 176;
    const menuHeight = blocks[blockId]?.provider === 'google' ? 52 : 98;
    setBlockContextMenu({
      blockId,
      x: clamp(event.clientX, 8, window.innerWidth - menuWidth - 8),
      y: clamp(event.clientY, 8, window.innerHeight - menuHeight - 8),
    });
  }

  async function scheduleTask(taskId: string, date: string, startMinutes: number, duration = DEFAULT_BLOCK) {
    const safeStart = clamp(roundToQuarter(startMinutes), DAY_START, DAY_END - MIN_BLOCK);
    const safeDuration = clamp(duration, MIN_BLOCK, DAY_END - safeStart);
    const existing = getBlockForTask(taskId);

    if (existing) {
      const optimistic = { ...existing, date, startMinutes: safeStart, durationMinutes: safeDuration };
      updateLocalBlock(existing.id, optimistic);
      persistBlock(optimistic);
    } else {
      try {
        const created = await createCalendarBlock({
          taskId,
          title: null,
          startAt: toLocalIsoWithOffset(date, safeStart),
          durationMinutes: safeDuration,
        });
        upsertApiBlock(created);
      } catch (error) {
        console.error('Failed to create calendar block', error);
      }
    }

    onEdit(taskId, { dueDate: date });
  }

  async function duplicateCalendarBlock(block: CalendarBlock, date: string, startMinutes = block.startMinutes) {
    if (block.date === date) return;

    const safeStart = clamp(roundToQuarter(startMinutes), DAY_START, DAY_END - MIN_BLOCK);
    const safeDuration = clamp(block.durationMinutes, MIN_BLOCK, DAY_END - safeStart);

    try {
      const created = await createCalendarBlock({
        taskId: block.taskId ?? null,
        title: block.taskId ? block.title ?? null : block.title ?? 'Blok czasu',
        startAt: toLocalIsoWithOffset(date, safeStart),
        durationMinutes: safeDuration,
      });
      upsertApiBlock(created);
    } catch (error) {
      console.error('Failed to duplicate calendar block', error);
    }
  }

  async function handleAddTaskFromSlot(input: {
    content: string;
    addAsTask: boolean;
    priority: TaskPriority;
    status: TaskStatus;
    projectId?: string;
    description?: string;
    tags?: string[];
    subtasks?: Subtask[];
    date: string;
    startMinutes: number;
    durationMinutes: number;
  }) {
    if (!input.addAsTask) {
      try {
        const createdBlock = await createCalendarBlock({
          taskId: null,
          title: input.content,
          startAt: toLocalIsoWithOffset(input.date, input.startMinutes),
          durationMinutes: input.durationMinutes,
        });
        upsertApiBlock(createdBlock);
      } catch (error) {
        console.error('Failed to create calendar block', error);
      }
      return;
    }

    const createdTask = await onAdd(
      input.content,
      input.priority,
      input.date,
      input.projectId,
      input.status,
      input.description,
      input.tags,
      input.subtasks,
    );

    if (!createdTask?.id) return;

    try {
      const createdBlock = await createCalendarBlock({
        taskId: createdTask.id,
        title: null,
        startAt: toLocalIsoWithOffset(input.date, input.startMinutes),
        durationMinutes: input.durationMinutes,
      });
      upsertApiBlock(createdBlock);
    } catch (error) {
      console.error('Failed to create calendar block for new task', error);
    }
  }

  async function clearBlocksForTask(taskId: string) {
    const taskBlocks = Object.values(blocks).filter(block => block.taskId === taskId);
    if (taskBlocks.length === 0) return;

    setBlocks(prev => {
      const next = { ...prev };
      for (const block of taskBlocks) delete next[block.id];
      return next;
    });

    await Promise.all(taskBlocks.map(block => deleteCalendarBlock(block.id).catch(error => {
      console.error('Failed to delete calendar block', error);
    })));
  }

  function getDropMinutes(e: React.DragEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    return DAY_START + (y / HOUR_HEIGHT) * 60;
  }

  function getClickMinutes(e: React.MouseEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = clamp(e.clientY - rect.top, 0, rect.height);
    return DAY_START + (y / HOUR_HEIGHT) * 60;
  }

  function getSelectionSlot(selection: SlotSelection): CalendarAddSlot {
    const distance = Math.abs(selection.currentMinutes - selection.anchorMinutes);
    if (distance < 15) {
      const startMinutes = clamp(roundToQuarter(selection.anchorMinutes), DAY_START, DAY_END - MIN_BLOCK);
      return {
        date: selection.date,
        startMinutes,
        durationMinutes: Math.min(DEFAULT_BLOCK, DAY_END - startMinutes),
      };
    }

    const startMinutes = clamp(roundToQuarter(Math.min(selection.anchorMinutes, selection.currentMinutes)), DAY_START, DAY_END - MIN_BLOCK);
    const endMinutes = clamp(roundToQuarter(Math.max(selection.anchorMinutes, selection.currentMinutes)), startMinutes + MIN_BLOCK, DAY_END);

    return {
      date: selection.date,
      startMinutes,
      durationMinutes: Math.max(MIN_BLOCK, endMinutes - startMinutes),
    };
  }

  function handleGridMouseDown(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (e.button !== 0 || dragState) return;
    if ((e.target as HTMLElement).closest('[data-calendar-block="true"]')) return;
    const anchorMinutes = clamp(roundToQuarter(getClickMinutes(e)), DAY_START, DAY_END - MIN_BLOCK);
    setSlotSelection({ date, anchorMinutes, currentMinutes: anchorMinutes });
  }

  function handleGridMouseMove(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (!slotSelection || slotSelection.date !== date) return;
    const currentMinutes = clamp(roundToQuarter(getClickMinutes(e)), DAY_START, DAY_END);
    setSlotSelection(selection => selection ? { ...selection, currentMinutes } : selection);
  }

  function handleGridMouseUp(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if (!slotSelection || slotSelection.date !== date) return;
    e.preventDefault();
    const finalSelection = {
      ...slotSelection,
      currentMinutes: clamp(roundToQuarter(getClickMinutes(e)), DAY_START, DAY_END),
    };
    setAddingSlot(getSelectionSlot(finalSelection));
    setSlotSelection(null);
  }

  function handleGridTap(e: React.MouseEvent<HTMLDivElement>, date: string) {
    if ((e.target as HTMLElement).closest('[data-calendar-block="true"]')) return;
    const startMinutes = clamp(roundToQuarter(getClickMinutes(e)), DAY_START, DAY_END - MIN_BLOCK);
    if (schedulingTaskId) {
      const existing = getBlockForTask(schedulingTaskId);
      scheduleTask(schedulingTaskId, date, startMinutes, existing?.durationMinutes ?? DEFAULT_BLOCK);
      setSchedulingTaskId(null);
      return;
    }
    setAddingSlot({
      date,
      startMinutes,
      durationMinutes: Math.min(DEFAULT_BLOCK, DAY_END - startMinutes),
    });
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>, date: string) {
    e.preventDefault();
    const draggedBlock = getDraggedBlock(e);

    if (draggedBlock) {
      const startMinutes = getDropMinutes(e) - draggedBlock.offsetMinutes;

      if (draggedBlock.duplicate) {
        duplicateCalendarBlock(draggedBlock.block, date, startMinutes);
        setDragState(null);
        setDropPreview(null);
        return;
      }

      moveCalendarBlock(draggedBlock.block, date, startMinutes);
      setDragState(null);
      setDropPreview(null);
      return;
    }

    const taskId = e.dataTransfer.getData('application/mindflow-task') || (dragState?.taskId ?? '');
    if (!taskId) return;
    const existing = getBlockForTask(taskId);
    scheduleTask(taskId, date, getDropMinutes(e), existing?.durationMinutes ?? DEFAULT_BLOCK);
    setDragState(null);
    setDropPreview(null);
  }

  function updateDropPreview(e: React.DragEvent<HTMLDivElement>, date: string) {
    if (!dragState) return;
    const existing = dragState.type === 'move' ? blocks[dragState.blockId] : getBlockForTask(dragState.taskId);
    const offset = dragState.type === 'move' ? dragState.offsetMinutes : 0;
    const startMinutes = clamp(roundToQuarter(getDropMinutes(e) - offset), DAY_START, DAY_END - MIN_BLOCK);
    const durationMinutes = clamp(existing?.durationMinutes ?? DEFAULT_BLOCK, MIN_BLOCK, DAY_END - startMinutes);
    setDropPreview({ date, startMinutes, durationMinutes });
  }

  function moveMonthTask(taskId: string, date: string) {
    const existing = getBlockForTask(taskId);
    scheduleTask(taskId, date, existing?.startMinutes ?? 9 * 60, existing?.durationMinutes ?? DEFAULT_BLOCK);
  }

  function resizeBlock(blockId: string, initialDuration: number, deltaY: number) {
    const existing = blocks[blockId];
    if (!existing) return;
    const deltaMinutes = roundToQuarter((deltaY / HOUR_HEIGHT) * 60);
    const durationMinutes = clamp(initialDuration + deltaMinutes, MIN_BLOCK, DAY_END - existing.startMinutes);
    updateLocalBlock(blockId, { durationMinutes });
  }

  function shiftDate(amount: number) {
    if (mode === 'day') setAnchorDate(prev => addDays(prev, amount));
    if (mode === 'week') setAnchorDate(prev => addDays(prev, amount * 7));
    if (mode === 'month') setAnchorDate(prev => new Date(prev.getFullYear(), prev.getMonth() + amount, 1, 12));
  }

  const title = mode === 'month'
    ? anchorDate.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    : mode === 'week'
      ? `${days[0].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })} - ${days[6].toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}`
      : anchorDate.toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  function toggleArrayValue<T extends string>(values: T[], value: T, setter: (next: T[]) => void) {
    setter(values.includes(value) ? values.filter(item => item !== value) : [...values, value]);
  }

  function renderFilterMenu<T extends string>({
    id,
    label,
    summary,
    options,
    values,
    onToggle,
    onClear,
    className = '',
  }: {
    id: Exclude<FilterMenu, null>;
    label: string;
    summary: string;
    options: { id: T; label: string; color?: string }[];
    values: T[];
    onToggle: (value: T) => void;
    onClear: () => void;
    className?: string;
  }) {
    const isOpen = openFilterMenu === id;

    return (
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={() => setOpenFilterMenu(isOpen ? null : id)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-[#e8e8e4] bg-white px-2.5 py-2 text-left transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#27272A] dark:hover:bg-[#323238] dark:focus:ring-white/10"
        >
          <span className="min-w-0">
            <span className="block text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">{label}</span>
            <span className="block truncate text-[12px] font-medium text-[#5a606b] dark:text-gray-300">{summary}</span>
          </span>
          <span className="text-[12px] font-semibold text-[#9098a4]">{values.length || 'all'}</span>
        </button>
        <div
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-52 overflow-y-auto rounded-lg border border-[#e8e8e4] bg-white p-1.5 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease custom-scrollbar dark:border-white/10 dark:bg-[#27272A] dark:shadow-none"
          style={{
            opacity: isOpen ? 1 : 0,
            transform: isOpen ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
            pointerEvents: isOpen ? 'auto' : 'none',
          }}
        >
          <button
            type="button"
            onClick={onClear}
            className="mb-1 flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:focus:ring-white/10"
          >
            Wszystkie
            {values.length === 0 && <Check size={13} />}
          </button>
          {options.map(option => {
            const active = values.includes(option.id);
            return (
              <button
                type="button"
                key={option.id}
                onClick={() => onToggle(option.id)}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:text-gray-200 dark:hover:bg-[#323238] dark:focus:ring-white/10"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors duration-200 ease ${active ? 'border-[#0f1115] bg-[#0f1115] text-white dark:border-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'border-[#c0c5cc] bg-white text-transparent dark:border-white/15 dark:bg-[#3F3F46]'}`}>
                  <Check size={11} />
                </span>
                {option.color && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: option.color }} />}
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const projectOptions = [
    { id: 'none', label: 'Bez projektu', color: '#c0c5cc' },
    ...projects.map(project => ({ id: project.id, label: project.name, color: project.color || '#9098a4' })),
  ];
  const selectedProjectSummary = selectedProjectIds.length === 0
    ? 'Wszystkie projekty'
    : selectedProjectIds.length === 1
      ? projectOptions.find(option => option.id === selectedProjectIds[0])?.label ?? '1 projekt'
      : `${selectedProjectIds.length} projekty`;
  const selectedPrioritySummary = selectedPriorities.length === 0
    ? 'Wszystkie'
    : selectedPriorities.length === 1
      ? selectedPriorities[0]
      : `${selectedPriorities.length} priorytety`;
  const selectedStatusSummary = selectedStatuses.length === 0
    ? 'Wszystkie'
    : selectedStatuses.length === 1
      ? getStatusLabel(selectedStatuses[0])
      : `${selectedStatuses.length} statusy`;

  const renderGoogleBlock = (block: CalendarBlock, layout?: BlockColumn) => {
    const top = ((block.startMinutes - DAY_START) / 60) * HOUR_HEIGHT;
    const height = Math.max(42, (block.durationMinutes / 60) * HOUR_HEIGHT);
    const title = block.title ?? 'Wydarzenie Google';
    return (
      <div
        key={block.id}
        data-calendar-block="true"
        title={`${title} · Google Calendar`}
        onContextMenu={(e) => openBlockContextMenu(e, block.id)}
        className="absolute cursor-default overflow-hidden rounded-lg border border-dashed border-[#9aa6c4] pl-2.5 text-left dark:border-[#5b6b8f]"
        style={{
          ...blockColumnStyle(layout),
          top,
          height,
          borderLeft: '3px solid #4285F4',
          color: '#3a3f47',
          backgroundColor: 'rgba(66,133,244,0.10)',
          backgroundImage:
            'repeating-linear-gradient(135deg, rgba(66,133,244,0.16) 0, rgba(66,133,244,0.16) 5px, transparent 5px, transparent 11px)',
        }}
      >
        <span className="flex h-full min-h-0 flex-col px-1.5 py-1.5">
          <span className="flex items-center gap-1">
            <svg viewBox="0 0 24 24" width="11" height="11" aria-hidden className="shrink-0">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
            </svg>
            <span className="block break-words text-[12px] font-semibold leading-tight tracking-[-0.01em] text-[#27324d] dark:text-[#c7d2ea]">
              {title}
            </span>
          </span>
          <span className="mt-1 block text-[10.5px] font-medium leading-snug text-[#5a6b8f]">
            {formatMinutes(block.startMinutes)}-{formatMinutes(block.startMinutes + block.durationMinutes)}
          </span>
          <span className="mt-auto block text-[10px] font-semibold uppercase tracking-[0.05em] text-[#5b6b8f] dark:text-[#8a97b8]">Google</span>
        </span>
      </div>
    );
  };

  const renderBlock = (block: CalendarBlock, layout?: BlockColumn) => {
    if (block.provider === 'google') return renderGoogleBlock(block, layout);
    const task = block.taskId ? taskById.get(block.taskId) : undefined;
    if (block.taskId && !task) return null;
    const project = task ? projects.find(p => p.id === task.project_id) : undefined;
    const meta = task
      ? getPriorityMeta(task.priority)
      : { fg: 'oklch(0.46 0.12 185)', bg: 'oklch(0.96 0.035 185)', ring: 'oklch(0.76 0.08 185)' };
    const title = task?.content ?? block.title ?? 'Blok czasu';
    const top = ((block.startMinutes - DAY_START) / 60) * HOUR_HEIGHT;
    const height = Math.max(42, (block.durationMinutes / 60) * HOUR_HEIGHT);
    const blockEnd = block.startMinutes + block.durationMinutes;
    const isActiveNow = block.date === todayKey && currentMinutes >= block.startMinutes && currentMinutes < blockEnd;

    return (
      <button
        key={block.id}
        data-calendar-block="true"
        draggable
        onClick={(e) => {
          e.stopPropagation();
          if (Date.now() < suppressBlockClickUntilRef.current) {
            return;
          }
          if (task) setEditingTask(task);
          else setEditingBlock(block);
        }}
        onContextMenu={(e) => {
          openBlockContextMenu(e, block.id);
        }}
        onDragStart={(e) => {
          suppressBlockClickUntilRef.current = Date.now() + 800;
          e.dataTransfer.effectAllowed = e.altKey ? 'copyMove' : 'move';
          if (block.taskId) e.dataTransfer.setData('application/mindflow-task', block.taskId);
          e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
          const rect = e.currentTarget.getBoundingClientRect();
          const offsetMinutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
          e.dataTransfer.setData('application/mindflow-calendar-offset', String(offsetMinutes));
          e.dataTransfer.setData('application/mindflow-calendar-duplicate', String(e.altKey));
          setDragState({ type: 'move', taskId: block.taskId, blockId: block.id, offsetMinutes, duplicate: e.altKey });
        }}
        onDragEnd={() => {
          suppressBlockClickUntilRef.current = Date.now() + 500;
          setDragState(null);
          setDropPreview(null);
        }}
        className="group absolute overflow-hidden rounded-lg border text-left shadow-sm transition-[opacity,transform,box-shadow] duration-200 ease hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20"
        style={{
          ...blockColumnStyle(layout),
          top,
          height,
          color: meta.fg,
          background: meta.bg,
          borderColor: meta.ring,
        }}
      >
        <span className="flex h-full min-h-0 flex-col px-2 py-2">
          <span className="min-w-0">
            <span className="block break-words text-[12.5px] font-semibold leading-tight tracking-[-0.01em] text-[#0f1115]">
              {title}
            </span>
            <span className="mt-1 block text-[10.5px] font-medium leading-snug text-[#5a606b]">
              {formatMinutes(block.startMinutes)}-{formatMinutes(block.startMinutes + block.durationMinutes)}
              <span className="block">{durationLabel(block.durationMinutes)}</span>
            </span>
          </span>
          {project && <span className="mt-auto block truncate text-[10.5px] font-medium text-[#5a606b]">{project.name}</span>}
          {!task && <span className="mt-auto block truncate text-[10.5px] font-semibold text-[#0f766e]">Blok czasu</span>}
          {isActiveNow && (
            <span
              className="mt-auto flex items-center gap-1 self-start rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-white"
              style={{ background: meta.fg }}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" strokeLinecap="round" /></svg>
              {formatRemaining(blockEnd - currentMinutes)} do końca
            </span>
          )}
        </span>
        <span
          role="button"
          tabIndex={0}
          aria-label="Usuń z kalendarza"
          title="Usuń z kalendarza"
          onClick={(e) => { e.stopPropagation(); deleteBlock(block.id); }}
          onMouseDown={(e) => e.stopPropagation()}
          onDragStart={(e) => { e.preventDefault(); e.stopPropagation(); }}
          className="absolute right-1 top-1 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-white/75 text-[#5a606b] shadow-sm transition-[opacity,background-color,color] duration-200 ease hover:bg-white hover:text-[#0f1115] lg:opacity-0 lg:group-hover:opacity-100"
        >
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
        </span>
        <span
          role="presentation"
          className="absolute inset-x-2 bottom-1 h-2 cursor-ns-resize rounded-full opacity-0 transition-opacity duration-200 ease group-hover:opacity-100"
          style={{ background: meta.fg }}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
            suppressBlockClickUntilRef.current = Date.now() + 800;
            const startY = e.clientY;
            const initialDuration = block.durationMinutes;
            let latestDuration = block.durationMinutes;
            const handleMove = (moveEvent: MouseEvent) => {
              const deltaMinutes = roundToQuarter(((moveEvent.clientY - startY) / HOUR_HEIGHT) * 60);
              latestDuration = clamp(initialDuration + deltaMinutes, MIN_BLOCK, DAY_END - block.startMinutes);
              resizeBlock(block.id, initialDuration, moveEvent.clientY - startY);
            };
            const handleUp = () => {
              suppressBlockClickUntilRef.current = Date.now() + 500;
              window.removeEventListener('mousemove', handleMove);
              window.removeEventListener('mouseup', handleUp);
              persistBlock({ ...block, durationMinutes: latestDuration });
            };
            window.addEventListener('mousemove', handleMove);
            window.addEventListener('mouseup', handleUp);
          }}
        />
      </button>
    );
  };

  const weekGridClass = mode === 'week'
    ? 'grid-cols-7 min-w-[700px] sm:min-w-[760px] lg:min-w-0'
    : 'grid-cols-1';

  const renderTimeGrid = () => (
    <div className="flex h-full flex-1 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
      <div className={`min-w-0 flex-1 overflow-auto custom-scrollbar ${mode === 'week' ? 'snap-x lg:snap-none' : ''}`} ref={gridRef}>
        <div className="flex">
          <div className="sticky left-0 z-40 w-12 shrink-0 border-r border-[#f1f0ed] bg-[#f7f7f4] sm:w-16 dark:border-white/8 dark:bg-[#232326]">
            <div className="sticky top-0 z-[45] h-14 border-b border-[#f1f0ed] bg-[#f7f7f4] dark:border-white/8 dark:bg-[#232326]" />
            {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, index) => (
              <div key={index} className="relative h-[72px] pr-1.5 text-right text-[10.5px] font-medium text-[#9098a4] sm:pr-3 sm:text-[11px]">
                {formatMinutes(DAY_START + index * 60)}
              </div>
            ))}
          </div>

          <div className="flex-1">
            <div className={`sticky top-0 z-[35] grid h-14 border-b border-[#f1f0ed] bg-white dark:border-white/8 dark:bg-[#27272A] ${weekGridClass}`}>
          {days.map(day => {
            const key = toDateKey(day);
            return (
              <div key={key} className="flex items-center justify-center border-r border-[#f1f0ed] last:border-r-0 dark:border-white/8">
                <div className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 transition-colors duration-200 ease ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#0f1115] dark:text-gray-100'}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</span>
                  <span className="ml-1.5 text-[13px] font-semibold">{day.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`grid ${weekGridClass}`} style={{ height: ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT }}>
          {days.map(day => {
            const key = toDateKey(day);
            const selectionSlot = slotSelection?.date === key ? getSelectionSlot(slotSelection) : null;
            return (
              <div
                key={key}
                className={`relative select-none border-r border-[#f1f0ed] bg-white last:border-r-0 dark:border-white/8 dark:bg-[#27272A] ${isMobile ? 'cursor-pointer' : 'cursor-crosshair'} ${mode === 'week' ? 'snap-start' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = dragState?.type === 'move' && dragState.duplicate ? 'copy' : 'move';
                  updateDropPreview(e, key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null);
                }}
                onDrop={(e) => handleDrop(e, key)}
                onClick={isMobile ? (e) => handleGridTap(e, key) : undefined}
                onMouseDown={isMobile ? undefined : (e) => handleGridMouseDown(e, key)}
                onMouseMove={isMobile ? undefined : (e) => handleGridMouseMove(e, key)}
                onMouseUp={isMobile ? undefined : (e) => handleGridMouseUp(e, key)}
              >
                {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, index) => (
                  <div key={index} className="h-[72px] border-b border-[#f1f0ed] dark:border-white/8" />
                ))}
                {selectionSlot && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 rounded-lg border border-[#0f1115] bg-[#f7f7f4]/90 px-2 py-1.5 text-left shadow-sm transition-[top,height,opacity] duration-200 ease"
                    style={{
                      top: ((selectionSlot.startMinutes - DAY_START) / 60) * HOUR_HEIGHT,
                      height: Math.max(42, (selectionSlot.durationMinutes / 60) * HOUR_HEIGHT),
                    }}
                  >
                    <span className="block text-[11px] font-semibold tracking-[-0.01em] text-[#0f1115]">Nowy blok czasu</span>
                    <span className="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#5a606b]">
                      {formatMinutes(selectionSlot.startMinutes)}-{formatMinutes(selectionSlot.startMinutes + selectionSlot.durationMinutes)}
                      <span className="block">{durationLabel(selectionSlot.durationMinutes)}</span>
                    </span>
                  </div>
                )}
                {dropPreview?.date === key && (
                  <div
                    className="pointer-events-none absolute left-1 right-1 rounded-lg border border-dashed border-[#9098a4] bg-[#f7f7f4]/85 px-2 py-1.5 text-left shadow-sm transition-[top,height,opacity] duration-200 ease"
                    style={{
                      top: ((dropPreview.startMinutes - DAY_START) / 60) * HOUR_HEIGHT,
                      height: Math.max(42, (dropPreview.durationMinutes / 60) * HOUR_HEIGHT),
                    }}
                  >
                    <span className="block text-[11px] font-semibold tracking-[-0.01em] text-[#0f1115]">Upuść tutaj</span>
                    <span className="mt-0.5 block text-[10.5px] font-medium leading-snug text-[#5a606b]">
                      {formatMinutes(dropPreview.startMinutes)}-{formatMinutes(dropPreview.startMinutes + dropPreview.durationMinutes)}
                      <span className="block">{durationLabel(dropPreview.durationMinutes)}</span>
                    </span>
                  </div>
                )}
                {(() => {
                  const dayBlocks = visibleBlocks.filter(block => block.date === key);
                  const layout = getDayBlockLayout(dayBlocks);
                  return dayBlocks.map(block => renderBlock(block, layout.get(block.id)));
                })()}
                {key === todayKey && showCurrentTimeIndicator && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-30"
                    style={{ top: currentTimeTop }}
                    aria-hidden="true"
                  >
                    <div className="absolute left-1 right-1 top-0 h-0.5 rounded-full bg-[#f97316] shadow-[0_0_0_1px_rgba(249,115,22,.14),0_4px_10px_rgba(249,115,22,.24)]" />
                    <div className="absolute left-1 top-0 h-2 w-2 -translate-y-[3px] rounded-full bg-[#f97316] ring-2 ring-white dark:ring-[#27272A]" />
                    <div className="absolute left-3 top-0 -translate-y-1/2 rounded-full bg-[#f97316] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white shadow-sm">
                      {currentTimeLabel}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMonth = () => (
    <div className="grid min-h-[560px] min-w-[640px] grid-cols-7 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm sm:min-h-[680px] sm:min-w-0 dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
      {days.map(day => {
        const key = toDateKey(day);
        const dayTasks = activeTasks.filter(task => task.dueDate === key || Object.values(blocks).some(block => block.taskId === task.id && block.date === key));
        const dayStandaloneBlocks = visibleBlocks
          .filter(block => block.date === key && !block.taskId)
          .sort((a, b) => a.startMinutes - b.startMinutes);
        const visibleStandaloneBlocks = dayStandaloneBlocks.slice(0, 4);
        const visibleDayTasks = dayTasks.slice(0, Math.max(0, 4 - visibleStandaloneBlocks.length));
        const hiddenCount = dayStandaloneBlocks.length + dayTasks.length - visibleStandaloneBlocks.length - visibleDayTasks.length;
        const inMonth = day.getMonth() === anchorDate.getMonth();
        return (
          <div
            key={key}
            className={`min-h-[112px] border-r border-b border-[#f1f0ed] p-2 transition-colors duration-200 ease hover:bg-[#f7f7f4] dark:border-white/8 dark:hover:bg-[#323238] ${inMonth ? 'bg-white dark:bg-[#27272A]' : 'bg-[#f7f7f4]/70 dark:bg-[#232326]'}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = dragState?.type === 'move' && dragState.duplicate ? 'copy' : 'move';
            }}
            onDrop={(e) => {
              e.preventDefault();
              const draggedBlock = getDraggedBlock(e);

              if (draggedBlock) {
                if (draggedBlock.duplicate) {
                  duplicateCalendarBlock(draggedBlock.block, key);
                  setDragState(null);
                  return;
                }

                moveCalendarBlock(draggedBlock.block, key, draggedBlock.block.startMinutes);
                setDragState(null);
                return;
              }

              const taskId = e.dataTransfer.getData('application/mindflow-task') || (dragState?.taskId ?? '');
              if (taskId) moveMonthTask(taskId, key);
              setDragState(null);
            }}
          >
            <div className={`mb-2 inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[12px] font-semibold ${key === todayKey ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#5a606b] dark:text-gray-300'}`}>
              {day.getDate()}
            </div>
            <div className="space-y-1">
              {visibleStandaloneBlocks.map(block => (
                <button
                  key={block.id}
                  draggable
                  onClick={() => setEditingBlock(block)}
                  onContextMenu={(e) => openBlockContextMenu(e, block.id)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = e.altKey ? 'copyMove' : 'move';
                    e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
                    e.dataTransfer.setData('application/mindflow-calendar-offset', '0');
                    e.dataTransfer.setData('application/mindflow-calendar-duplicate', String(e.altKey));
                    setDragState({ type: 'move', taskId: null, blockId: block.id, offsetMinutes: 0, duplicate: e.altKey });
                  }}
                  onDragEnd={() => setDragState(null)}
                  className="flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-medium text-[#0f766e] transition-colors duration-200 ease hover:bg-[#ecfdf5] focus:outline-none focus:ring-2 focus:ring-[#0f766e]/20"
                >
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#0f766e]" />
                  <span className="truncate">{formatMinutes(block.startMinutes)} {block.title ?? 'Blok czasu'}</span>
                </button>
              ))}
              {visibleDayTasks.map(task => {
                const block = getBlockForTask(task.id);
                const meta = getPriorityMeta(task.priority);
                return (
                  <button
                    key={task.id}
                    draggable
                    onClick={() => setEditingTask(task)}
                    onContextMenu={(e) => {
                      if (!block) return;
                      openBlockContextMenu(e, block.id);
                    }}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/mindflow-task', task.id);
                      if (block) e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
                      setDragState({ type: 'sidebar', taskId: task.id });
                    }}
                    onDragEnd={() => setDragState(null)}
                    className="flex w-full items-center gap-1.5 truncate rounded-lg px-1.5 py-1 text-left text-[11px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: meta.fg }} />
                    <span className="truncate">{block ? `${formatMinutes(block.startMinutes)} ` : ''}{task.content}</span>
                  </button>
                );
              })}
              {hiddenCount > 0 && <div className="px-1.5 text-[10.5px] font-medium text-[#9098a4]">+{hiddenCount} więcej</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  const renderDrawerContent = (mobile: boolean) => (
    <>
      <div className="border-b border-[#f1f0ed] p-4 dark:border-white/8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0f1115] dark:text-white">
            <ListFilter size={16} /> Zadania do zaplanowania
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#f7f7f4] px-2 py-1 text-[11px] font-medium text-[#9098a4] dark:bg-[#323238]">{filteredTasks.length}</span>
            {mobile && (
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/10"
                title="Zamknij"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#FDFDFD] px-3 py-2 transition-colors duration-200 ease focus-within:border-[#9098a4] focus-within:bg-white dark:border-white/10 dark:bg-[#232326] dark:focus-within:border-white/15 dark:focus-within:bg-[#323238]">
          <Search size={15} className="text-[#9098a4]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj zadań..." className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1115] outline-none placeholder:text-[#b0b5be] dark:text-white" />
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {renderFilterMenu({
            id: 'projects',
            label: 'Projekty',
            summary: selectedProjectSummary,
            options: projectOptions,
            values: selectedProjectIds,
            onToggle: value => toggleArrayValue(selectedProjectIds, value, setSelectedProjectIds),
            onClear: () => setSelectedProjectIds([]),
            className: 'col-span-2',
          })}
          {renderFilterMenu({
            id: 'priorities',
            label: 'Priorytet',
            summary: selectedPrioritySummary,
            options: (Object.keys(PRIORITY_META) as TaskPriority[]).map(priority => ({
              id: priority,
              label: priority,
              color: getPriorityMeta(priority).fg,
            })),
            values: selectedPriorities,
            onToggle: value => toggleArrayValue(selectedPriorities, value, setSelectedPriorities),
            onClear: () => setSelectedPriorities([]),
          })}
          {renderFilterMenu({
            id: 'statuses',
            label: 'Status',
            summary: selectedStatusSummary,
            options: (Object.keys(STATUS_LABEL) as TaskStatus[]).map(status => ({
              id: status,
              label: getStatusLabel(status),
            })),
            values: selectedStatuses,
            onToggle: value => toggleArrayValue(selectedStatuses, value, setSelectedStatuses),
            onClear: () => setSelectedStatuses([]),
          })}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 custom-scrollbar">
        {filteredTasks.map(task => {
          const project = projects.find(p => p.id === task.project_id);
          const meta = getPriorityMeta(task.priority);
          const block = getBlockForTask(task.id);
          return (
            <button
              key={task.id}
              draggable={!mobile}
              onClick={() => {
                if (mobile) { setSchedulingTaskId(task.id); setMobileDrawerOpen(false); }
                else setEditingTask(task);
              }}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('application/mindflow-task', task.id);
                if (block) e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
                setDragState({ type: 'sidebar', taskId: task.id });
              }}
              onDragEnd={() => setDragState(null)}
              className="group w-full rounded-lg border border-[#e8e8e4] bg-white p-3 text-left transition-[background,box-shadow,transform] duration-200 ease hover:-translate-y-0.5 hover:bg-[#f7f7f4] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#232326] dark:hover:bg-[#323238] dark:hover:shadow-none dark:focus:ring-white/10"
            >
              <div className="mb-2 flex items-start gap-2">
                <span className="mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug tracking-[-0.01em] text-[#0f1115] dark:text-white">{task.content}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-[#9098a4]">
                <span className="flex items-center gap-1"><Filter size={11} />{getStatusLabel(task.status)}</span>
                {project && <span className="truncate">{project.name}</span>}
                {block && <span>{block.date} · {durationLabel(block.durationMinutes)}</span>}
              </div>
            </button>
          );
        })}
        {filteredTasks.length === 0 && (
          <div className="rounded-[18px] border border-dashed border-[#e8e8e4] p-6 text-center text-[13px] font-medium text-[#9098a4] dark:border-white/10">
            Brak zadań dla wybranych filtrów.
          </div>
        )}
      </div>

      <div className="border-t border-[#f1f0ed] p-3 text-[11px] font-medium leading-relaxed text-[#9098a4] dark:border-white/8">
        {mobile
          ? 'Dotknij wolnego miejsca w siatce, aby dodać blok 1 godz. Dotknij zadania, aby je otworzyć.'
          : 'Przeciągnij zadanie na dzień lub godzinę. W widoku dnia i tygodnia blok dostaje domyślnie 1 godz. i można go przesuwać oraz rozciągać.'}
      </div>
    </>
  );

  return (
    <>
      <div className="flex h-full min-h-0 gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-none flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                <CalendarDays size={14} /> Kalendarz i timeblocking
              </div>
              <h2 className="truncate text-xl font-semibold tracking-[-0.02em] text-[#0f1115] sm:text-2xl dark:text-white">{title}</h2>
            </div>

            <div className="flex w-full items-center gap-2 lg:w-auto">
              <button onClick={() => setAnchorDate(new Date())} className="rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200 dark:hover:bg-[#323238] dark:focus:ring-white/10">Dziś</button>
              <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1 dark:border-white/10 dark:bg-[#27272A]">
                <button onClick={() => shiftDate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:text-gray-300 dark:hover:bg-[#323238] dark:focus:ring-white/10" title="Poprzedni okres"><ChevronLeft size={17} /></button>
                <button onClick={() => shiftDate(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:text-gray-300 dark:hover:bg-[#323238] dark:focus:ring-white/10" title="Następny okres"><ChevronRight size={17} /></button>
              </div>
              <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1 dark:border-white/10 dark:bg-[#27272A]">
                {(['day', 'week', 'month'] as CalendarMode[]).map(item => (
                  <button
                    key={item}
                    onClick={() => selectMode(item)}
                    className={`rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 sm:px-3 dark:focus:ring-white/10 ${mode === item ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-300 dark:hover:bg-[#323238]'}`}
                  >
                    <span className="hidden sm:inline">{{ day: 'Dzień', week: 'Tydzień', month: 'Miesiąc' }[item]}</span>
                    <span className="sm:hidden">{{ day: 'D', week: 'T', month: 'M' }[item]}</span>
                  </button>
                ))}
              </div>
              {hasGoogleBlocks && (
                <button
                  onClick={() => setShowGoogleEvents(v => {
                    localStorage.setItem('mindflow_show_google_events', String(!v));
                    return !v;
                  })}
                  aria-pressed={showGoogleEvents}
                  title={showGoogleEvents ? 'Ukryj wydarzenia Google' : 'Pokaż wydarzenia Google'}
                  className={`flex h-10 items-center gap-1.5 rounded-lg border px-2.5 text-[12.5px] font-medium transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/10 ${showGoogleEvents
                    ? 'border-[#cdd7ee] bg-[#eef3fd] text-[#2c4a8a] dark:border-[#3b4a6e] dark:bg-[#1e2536] dark:text-[#aebfe6]'
                    : 'border-[#e8e8e4] bg-white text-[#5a606b] hover:bg-[#f7f7f4] dark:border-white/10 dark:bg-[#27272A] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                >
                  {showGoogleEvents ? <Eye size={15} /> : <EyeOff size={15} />}
                  <span className="hidden sm:inline">Google</span>
                </button>
              )}
              <button
                onClick={() => (isMobile ? setMobileDrawerOpen(true) : setDrawerOpen(open => !open))}
                className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 lg:ml-0 dark:border-white/10 dark:bg-[#27272A] dark:text-gray-300 dark:hover:bg-[#323238] dark:focus:ring-white/10"
                title="Zadania do zaplanowania"
              >
                {isMobile ? <ListTodo size={17} /> : drawerOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              </button>
            </div>
          </div>

          {schedulingTaskId && (
            <div className="lg:hidden flex items-center gap-2 rounded-lg bg-[#0f1115] px-3 py-2 text-white dark:bg-white dark:text-[#18181B]">
              <CalendarDays size={15} className="flex-none opacity-80" />
              <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                Wybierz miejsce: {taskById.get(schedulingTaskId)?.content ?? 'zadanie'}
              </span>
              <button
                onClick={() => setSchedulingTaskId(null)}
                className="flex-none rounded-md px-2 py-1 text-[12px] font-semibold text-white/80 transition-colors duration-200 ease hover:bg-white/15 hover:text-white dark:text-[#18181B]/70 dark:hover:bg-black/10 dark:hover:text-[#18181B]"
              >
                Anuluj
              </button>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto custom-scrollbar pb-6">
            {mode === 'month' ? renderMonth() : renderTimeGrid()}
          </div>
        </section>

        <aside
          className="hidden w-[330px] shrink-0 flex-col rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm transition-[opacity,transform,width] duration-200 ease lg:flex dark:border-white/10 dark:bg-[#27272A] dark:shadow-none"
          style={{
            opacity: drawerOpen ? 1 : 0,
            transform: drawerOpen ? 'translateX(0) scale(1)' : 'translateX(12px) scale(0.97)',
            pointerEvents: drawerOpen ? 'auto' : 'none',
            width: drawerOpen ? 330 : 0,
            overflow: drawerOpen ? 'visible' : 'hidden',
          }}
        >
          {renderDrawerContent(false)}
        </aside>
      </div>

      {createPortal(
        <div
          className="fixed inset-0 z-[55] lg:hidden"
          style={{ pointerEvents: mobileDrawerOpen ? 'auto' : 'none' }}
          aria-hidden={!mobileDrawerOpen}
        >
          <div
            className="absolute inset-0 backdrop-blur-[2px] transition-opacity duration-200 ease"
            style={{ background: 'rgba(15,17,21,.18)', opacity: mobileDrawerOpen ? 1 : 0 }}
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[82vh] flex-col rounded-t-[18px] border-t border-[#e8e8e4] bg-white shadow-[0_-24px_48px_-12px_rgba(15,17,21,.22)] transition-transform duration-[0.22s] dark:border-white/10 dark:bg-[#27272A]"
            style={{
              transform: mobileDrawerOpen ? 'translateY(0)' : 'translateY(100%)',
              transitionTimingFunction: 'cubic-bezier(0.34,1.2,0.64,1)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }}
          >
            <div className="flex-none pt-2.5 pb-1">
              <div className="mx-auto h-1 w-9 rounded-full bg-[#e3e3df] dark:bg-white/15" />
            </div>
            {renderDrawerContent(true)}
          </div>
        </div>,
        document.body,
      )}

      {blockContextMenu && blocks[blockContextMenu.blockId] && createPortal(
        <div
          role="menu"
          data-block-context-menu="true"
          className="fixed z-[60] min-w-[168px] animate-calendar-reveal rounded-[10px] border border-[#e8e8e4] bg-white p-1 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] dark:border-white/10 dark:bg-[#27272A] dark:shadow-none"
          style={{ left: blockContextMenu.x, top: blockContextMenu.y }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => startFocusForBlock(blockContextMenu.blockId)}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[oklch(0.96_0.03_25)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.18_25)]/20 dark:text-white dark:hover:bg-[oklch(0.62_0.18_25)]/10"
          >
            <TomatoIcon className="h-4 w-4" />
            Focus
          </button>
          {blocks[blockContextMenu.blockId].provider === 'local' && (
            <>
              <div className="mx-1 my-1 h-px bg-[#f1f0ed] dark:bg-white/8" />
              <button
                type="button"
                role="menuitem"
                onClick={() => deleteBlock(blockContextMenu.blockId)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-red-600 transition-colors duration-200 ease hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500/20"
              >
                <Trash2 size={13} strokeWidth={2} />
                Usuń
              </button>
            </>
          )}
        </div>,
        document.body
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projects={projects}
          onSave={(updates) => onEdit(editingTask.id, updates)}
          onDelete={() => { onDelete?.(editingTask.id); clearBlocksForTask(editingTask.id); setEditingTask(null); }}
          onToggleComplete={() => { onToggle(editingTask.id); setEditingTask(null); }}
          onComplete={onComplete}
          onClose={() => setEditingTask(null)}
        />
      )}

      {editingBlock && (
        <CalendarBlockEditModal
          block={editingBlock}
          onSave={(input) => saveStandaloneBlock(editingBlock, input)}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {addingSlot && (
        <CalendarTaskAddModal
          slot={addingSlot}
          projects={projects}
          onAdd={handleAddTaskFromSlot}
          onClose={() => setAddingSlot(null)}
        />
      )}
    </>
  );
}
