import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Filter,
  ListFilter,
  PanelRightClose,
  PanelRightOpen,
  Search,
} from 'lucide-react';
import type { Project, Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { TaskPriority as Priority } from '../../../shared/types';
import { getToken } from '../../../shared/api/client';
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

type CalendarMode = 'day' | 'week' | 'month';

type CalendarBlock = {
  id: string;
  taskId: string;
  date: string;
  startMinutes: number;
  durationMinutes: number;
  provider: CalendarProvider;
  syncStatus: CalendarSyncStatus;
};

type DragState =
  | { type: 'sidebar'; taskId: string }
  | { type: 'move'; taskId: string; blockId: string; offsetMinutes: number }
  | null;

interface CalendarViewProps {
  tasks: Task[];
  projects: Project[];
  onEdit: (id: string, updates: Partial<Task>) => void;
  onToggle: (id: string) => void;
  onDelete?: (id: string) => void;
}

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
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function durationLabel(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} godz. ${m} min` : `${h} godz.`;
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
    date: toDateKey(start),
    startMinutes: start.getHours() * 60 + start.getMinutes(),
    durationMinutes: block.durationMinutes,
    provider: block.provider,
    syncStatus: block.syncStatus,
  };
}

function getWeekDays(anchor: Date) {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function getMonthDays(anchor: Date) {
  const start = startOfMonthGrid(anchor);
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

export function CalendarView({ tasks, projects, onEdit, onToggle, onDelete }: CalendarViewProps) {
  const [mode, setMode] = useState<CalendarMode>('week');
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [blocks, setBlocks] = useState<Record<string, CalendarBlock>>({});
  const [dragState, setDragState] = useState<DragState>(null);
  const [drawerOpen, setDrawerOpen] = useState(true);
  const [query, setQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [dropPreview, setDropPreview] = useState<{ date: string; startMinutes: number; durationMinutes: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const suppressBlockClickUntilRef = useRef(0);

  const activeTasks = useMemo(() => tasks.filter(task => !task.isCompleted), [tasks]);
  const taskById = useMemo(() => new Map(tasks.map(task => [task.id, task])), [tasks]);
  const days = mode === 'month' ? getMonthDays(anchorDate) : mode === 'week' ? getWeekDays(anchorDate) : [anchorDate];
  const todayKey = toDateKey(new Date());
  const fromKey = toDateKey(days[0]);
  const toKey = toDateKey(days[days.length - 1]);

  const upsertApiBlock = useCallback((apiBlock: ApiCalendarBlock) => {
    const mapped = mapApiBlock(apiBlock);
    setBlocks(prev => ({ ...prev, [mapped.id]: mapped }));
  }, []);

  useEffect(() => {
    let cancelled = false;

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
      });

    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey]);

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
      .filter(task => (projectFilter === 'all' ? true : (task.project_id ?? 'none') === projectFilter))
      .filter(task => (statusFilter === 'all' ? true : task.status === statusFilter))
      .filter(task => (priorityFilter === 'all' ? true : task.priority === priorityFilter))
      .sort((a, b) => {
        const byPriority = getPriorityMeta(a.priority).rank - getPriorityMeta(b.priority).rank;
        if (byPriority !== 0) return byPriority;
        if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
        if (a.dueDate) return -1;
        if (b.dueDate) return 1;
        return b.createdAt.getTime() - a.createdAt.getTime();
      });
  }, [activeTasks, priorityFilter, projectFilter, query, statusFilter]);

  const visibleBlocks = useMemo(() => {
    const dayKeys = new Set(days.map(toDateKey));
    return Object.values(blocks).filter(block => dayKeys.has(block.date) && taskById.has(block.taskId));
  }, [blocks, days, taskById]);

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
        taskId: block.taskId,
        startAt: toLocalIsoWithOffset(block.date, block.startMinutes),
        durationMinutes: block.durationMinutes,
      });
      upsertApiBlock(updated);
    } catch (error) {
      console.error('Failed to update calendar block', error);
    }
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

  function handleDrop(e: React.DragEvent<HTMLDivElement>, date: string) {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('application/mindflow-task') || (dragState?.taskId ?? '');
    if (!taskId) return;
    const existing = dragState?.type === 'move' ? blocks[dragState.blockId] : getBlockForTask(taskId);
    const offset = dragState?.type === 'move' ? dragState.offsetMinutes : 0;
    scheduleTask(taskId, date, getDropMinutes(e) - offset, existing?.durationMinutes ?? DEFAULT_BLOCK);
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

  const renderBlock = (block: CalendarBlock) => {
    const task = taskById.get(block.taskId);
    if (!task) return null;
    const project = projects.find(p => p.id === task.project_id);
    const meta = getPriorityMeta(task.priority);
    const top = ((block.startMinutes - DAY_START) / 60) * HOUR_HEIGHT;
    const height = Math.max(42, (block.durationMinutes / 60) * HOUR_HEIGHT);

    return (
      <button
        key={block.id}
        draggable
        onClick={() => {
          if (Date.now() < suppressBlockClickUntilRef.current) {
            return;
          }
          setEditingTask(task);
        }}
        onDragStart={(e) => {
          suppressBlockClickUntilRef.current = Date.now() + 800;
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('application/mindflow-task', block.taskId);
          e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
          const rect = e.currentTarget.getBoundingClientRect();
          const offsetMinutes = ((e.clientY - rect.top) / HOUR_HEIGHT) * 60;
          setDragState({ type: 'move', taskId: block.taskId, blockId: block.id, offsetMinutes });
        }}
        onDragEnd={() => {
          suppressBlockClickUntilRef.current = Date.now() + 500;
          setDragState(null);
          setDropPreview(null);
        }}
        className="group absolute left-1 right-1 overflow-hidden rounded-lg border text-left shadow-sm transition-[opacity,transform,box-shadow] duration-200 ease hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20"
        style={{
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
              {task.content}
            </span>
            <span className="mt-1 block text-[10.5px] font-medium leading-snug text-[#5a606b]">
              {formatMinutes(block.startMinutes)}-{formatMinutes(block.startMinutes + block.durationMinutes)}
              <span className="block">{durationLabel(block.durationMinutes)}</span>
            </span>
          </span>
          {project && <span className="mt-auto block truncate text-[10.5px] font-medium text-[#5a606b]">{project.name}</span>}
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

  const renderTimeGrid = () => (
    <div className="flex min-w-[760px] flex-1 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm">
      <div className="w-16 shrink-0 border-r border-[#f1f0ed] bg-[#f7f7f4]">
        <div className="h-14 border-b border-[#f1f0ed]" />
        {Array.from({ length: (DAY_END - DAY_START) / 60 + 1 }, (_, index) => (
          <div key={index} className="relative h-[72px] pr-3 text-right text-[11px] font-medium text-[#9098a4]">
            {formatMinutes(DAY_START + index * 60)}
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-auto custom-scrollbar" ref={gridRef}>
        <div className={`grid h-14 border-b border-[#f1f0ed] bg-white ${mode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`}>
          {days.map(day => {
            const key = toDateKey(day);
            return (
              <div key={key} className="flex items-center justify-center border-r border-[#f1f0ed] last:border-r-0">
                <div className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 transition-colors duration-200 ease ${key === todayKey ? 'bg-[#0f1115] text-white' : 'text-[#0f1115]'}`}>
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">{day.toLocaleDateString('pl-PL', { weekday: 'short' })}</span>
                  <span className="ml-1.5 text-[13px] font-semibold">{day.getDate()}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className={`grid ${mode === 'day' ? 'grid-cols-1' : 'grid-cols-7'}`} style={{ height: ((DAY_END - DAY_START) / 60) * HOUR_HEIGHT }}>
          {days.map(day => {
            const key = toDateKey(day);
            return (
              <div
                key={key}
                className="relative border-r border-[#f1f0ed] bg-white last:border-r-0"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  updateDropPreview(e, key);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropPreview(null);
                }}
                onDrop={(e) => handleDrop(e, key)}
              >
                {Array.from({ length: (DAY_END - DAY_START) / 60 }, (_, index) => (
                  <div key={index} className="h-[72px] border-b border-[#f1f0ed]" />
                ))}
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
                {visibleBlocks.filter(block => block.date === key).map(renderBlock)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const renderMonth = () => (
    <div className="grid min-h-[680px] grid-cols-7 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm">
      {days.map(day => {
        const key = toDateKey(day);
        const dayTasks = activeTasks.filter(task => task.dueDate === key || Object.values(blocks).some(block => block.taskId === task.id && block.date === key));
        const inMonth = day.getMonth() === anchorDate.getMonth();
        return (
          <div
            key={key}
            className={`min-h-[112px] border-r border-b border-[#f1f0ed] p-2 transition-colors duration-200 ease hover:bg-[#f7f7f4] ${inMonth ? 'bg-white' : 'bg-[#f7f7f4]/70'}`}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
            onDrop={(e) => {
              e.preventDefault();
              const taskId = e.dataTransfer.getData('application/mindflow-task') || (dragState?.taskId ?? '');
              if (taskId) moveMonthTask(taskId, key);
              setDragState(null);
            }}
          >
            <div className={`mb-2 inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-[12px] font-semibold ${key === todayKey ? 'bg-[#0f1115] text-white' : 'text-[#5a606b]'}`}>
              {day.getDate()}
            </div>
            <div className="space-y-1">
              {dayTasks.slice(0, 4).map(task => {
                const block = getBlockForTask(task.id);
                const meta = getPriorityMeta(task.priority);
                return (
                  <button
                    key={task.id}
                    draggable
                    onClick={() => setEditingTask(task)}
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
              {dayTasks.length > 4 && <div className="px-1.5 text-[10.5px] font-medium text-[#9098a4]">+{dayTasks.length - 4} więcej</div>}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="flex h-full min-h-0 gap-4">
        <section className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-none flex-wrap items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                <CalendarDays size={14} /> Kalendarz i timeblocking
              </div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em] text-[#0f1115]">{title}</h2>
            </div>

            <div className="flex items-center gap-2">
              <button onClick={() => setAnchorDate(new Date())} className="rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20">Dzisiaj</button>
              <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1">
                <button onClick={() => shiftDate(-1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20" title="Poprzedni okres"><ChevronLeft size={17} /></button>
                <button onClick={() => shiftDate(1)} className="flex h-8 w-8 items-center justify-center rounded-lg text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20" title="Następny okres"><ChevronRight size={17} /></button>
              </div>
              <div className="flex rounded-lg border border-[#e8e8e4] bg-white p-1">
                {(['day', 'week', 'month'] as CalendarMode[]).map(item => (
                  <button
                    key={item}
                    onClick={() => setMode(item)}
                    className={`rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 ${mode === item ? 'bg-[#0f1115] text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed]'}`}
                  >
                    {{ day: 'Dzień', week: 'Tydzień', month: 'Miesiąc' }[item]}
                  </button>
                ))}
              </div>
              <button onClick={() => setDrawerOpen(open => !open)} className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20" title="Lista zadań">
                {drawerOpen ? <PanelRightClose size={17} /> : <PanelRightOpen size={17} />}
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto custom-scrollbar pb-6">
            {mode === 'month' ? renderMonth() : renderTimeGrid()}
          </div>
        </section>

        <aside
          className="hidden w-[330px] shrink-0 flex-col rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm transition-[opacity,transform,width] duration-200 ease lg:flex"
          style={{
            opacity: drawerOpen ? 1 : 0,
            transform: drawerOpen ? 'translateX(0) scale(1)' : 'translateX(12px) scale(0.97)',
            pointerEvents: drawerOpen ? 'auto' : 'none',
            width: drawerOpen ? 330 : 0,
            overflow: 'hidden',
          }}
        >
          <div className="border-b border-[#f1f0ed] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[13px] font-semibold text-[#0f1115]">
                <ListFilter size={16} /> Zadania do zaplanowania
              </div>
              <span className="rounded-full bg-[#f7f7f4] px-2 py-1 text-[11px] font-medium text-[#9098a4]">{filteredTasks.length}</span>
            </div>
            <label className="flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-[#FDFDFD] px-3 py-2 transition-colors duration-200 ease focus-within:border-[#9098a4] focus-within:bg-white">
              <Search size={15} className="text-[#9098a4]" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Szukaj zadań..." className="min-w-0 flex-1 bg-transparent text-[13px] text-[#0f1115] outline-none placeholder:text-[#b0b5be]" />
            </label>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <select value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="rounded-lg border border-[#e8e8e4] bg-white px-2 py-2 text-[12px] font-medium text-[#5a606b] outline-none transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:ring-2 focus:ring-[#0f1115]/20">
                <option value="all">Wszystkie projekty</option>
                <option value="none">Bez projektu</option>
                {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
              <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value as TaskPriority | 'all')} className="rounded-lg border border-[#e8e8e4] bg-white px-2 py-2 text-[12px] font-medium text-[#5a606b] outline-none transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:ring-2 focus:ring-[#0f1115]/20">
                <option value="all">Priorytety</option>
                {(Object.keys(PRIORITY_META) as TaskPriority[]).map(priority => <option key={priority} value={priority}>{priority}</option>)}
              </select>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as TaskStatus | 'all')} className="col-span-2 rounded-lg border border-[#e8e8e4] bg-white px-2 py-2 text-[12px] font-medium text-[#5a606b] outline-none transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:ring-2 focus:ring-[#0f1115]/20">
                <option value="all">Wszystkie statusy</option>
                {(Object.keys(STATUS_LABEL) as TaskStatus[]).map(status => <option key={status} value={status}>{STATUS_LABEL[status]}</option>)}
              </select>
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
                  draggable
                  onClick={() => setEditingTask(task)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('application/mindflow-task', task.id);
                    if (block) e.dataTransfer.setData('application/mindflow-calendar-block', block.id);
                    setDragState({ type: 'sidebar', taskId: task.id });
                  }}
                  onDragEnd={() => setDragState(null)}
                  className="group w-full rounded-lg border border-[#e8e8e4] bg-white p-3 text-left transition-[background,box-shadow,transform] duration-200 ease hover:-translate-y-0.5 hover:bg-[#f7f7f4] hover:shadow-sm focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20"
                >
                  <div className="mb-2 flex items-start gap-2">
                    <span className="mt-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold" style={{ color: meta.fg, background: meta.bg }}>{meta.label}</span>
                    <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug tracking-[-0.01em] text-[#0f1115]">{task.content}</span>
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
              <div className="rounded-[18px] border border-dashed border-[#e8e8e4] p-6 text-center text-[13px] font-medium text-[#9098a4]">
                Brak zadań dla wybranych filtrów.
              </div>
            )}
          </div>

          <div className="border-t border-[#f1f0ed] p-3 text-[11px] font-medium leading-relaxed text-[#9098a4]">
            Przeciągnij zadanie na dzień lub godzinę. W widoku dnia i tygodnia blok dostaje domyślnie 1 godz. i można go przesuwać oraz rozciągać.
          </div>
        </aside>
      </div>

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projects={projects}
          onSave={(updates) => { onEdit(editingTask.id, updates); setEditingTask(null); }}
          onDelete={() => { onDelete?.(editingTask.id); clearBlocksForTask(editingTask.id); setEditingTask(null); }}
          onToggleComplete={() => { onToggle(editingTask.id); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
