import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { Task, TaskStatus, Project } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';
import { TaskAddModal } from './TaskAddModal';
import { TaskEditModal } from './TaskEditModal';
import { BoardViewSkeleton } from '../../../shared/ui/LoadingSkeletons';

const STATUSES = [
  { key: 'NotStarted' as const, label: 'Nie rozpoczęto', accent: 'oklch(0.75 0.01 260)', dot: 'oklch(0.75 0.01 260)', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)' },
  { key: 'InProgress'  as const, label: 'W trakcie',     accent: 'oklch(0.60 0.18 230)', dot: 'oklch(0.60 0.18 230)', fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)'  },
  { key: 'Completed'   as const, label: 'Ukończone',     accent: 'oklch(0.55 0.18 145)', dot: 'oklch(0.55 0.18 145)', fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)'  },
];

const PRIORITIES = [
  { key: TaskPriority.P1, label: 'P1 — Pilne',   accent: 'oklch(0.62 0.18 25)',  dot: 'oklch(0.62 0.18 25)',  fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  { key: TaskPriority.P2, label: 'P2 — Wysokie',  accent: 'oklch(0.70 0.16 55)',  dot: 'oklch(0.70 0.16 55)',  fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  { key: TaskPriority.P3, label: 'P3 — Średnie',  accent: 'oklch(0.70 0.13 230)', dot: 'oklch(0.70 0.13 230)', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  { key: TaskPriority.P4, label: 'P4 — Niskie',   accent: 'oklch(0.65 0.01 260)', dot: 'oklch(0.65 0.01 260)', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
];

const PRIORITY_SHORT: Record<TaskPriority, { label: string; fg: string; bg: string }> = {
  [TaskPriority.P1]: { label: 'P1', fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  [TaskPriority.P2]: { label: 'P2', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  [TaskPriority.P3]: { label: 'P3', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  [TaskPriority.P4]: { label: 'P4', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const STATUS_SHORT: Record<string, { label: string; fg: string; bg: string; dot: string }> = {
  NotStarted: { label: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
  InProgress:  { label: 'W trakcie',     fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
  Completed:   { label: 'Ukończone',     fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
};

function formatDue(dateStr: string): string {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return `${Math.abs(diff)}d temu`;
  if (diff === 0)  return 'Dzisiaj';
  if (diff === 1)  return 'Jutro';
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string) {
  const d = new Date(dateStr); d.setHours(0, 0, 0, 0);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return d < today;
}

function CalIcon() {
  return <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/></svg>;
}

function PlusIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

interface CardProps {
  task: Task;
  groupBy: 'status' | 'priority';
  isDragging: boolean;
  onOpen: (task: Task) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

function Card({ task, groupBy, isDragging, onOpen, onDragStart, onDragEnd }: CardProps) {
  const p = PRIORITY_SHORT[task.priority] ?? PRIORITY_SHORT[TaskPriority.P4];
  const s = STATUS_SHORT[task.status ?? 'NotStarted'] ?? STATUS_SHORT.NotStarted;
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;
  const [dragReady, setDragReady] = useState(false);
  const pressTimerRef = useRef<number | null>(null);
  const suppressClickRef = useRef(false);

  useEffect(() => {
    return () => {
      if (pressTimerRef.current !== null) {
        window.clearTimeout(pressTimerRef.current);
      }
    };
  }, []);

  function clearPressTimer() {
    if (pressTimerRef.current !== null) {
      window.clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    suppressClickRef.current = false;
    clearPressTimer();
    pressTimerRef.current = window.setTimeout(() => {
      setDragReady(true);
    }, 180);
  }

  function handlePointerRelease() {
    clearPressTimer();
    if (!isDragging) {
      setDragReady(false);
    }
  }

  function handleClick() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onOpen(task);
  }

  function handleDragStartInternal(e: React.DragEvent<HTMLElement>) {
    if (!dragReady) {
      e.preventDefault();
      return;
    }
    suppressClickRef.current = true;
    onDragStart(e, task.id);
  }

  function handleDragEndInternal() {
    clearPressTimer();
    setDragReady(false);
    suppressClickRef.current = true;
    onDragEnd();
  }

  return (
    <article
      draggable={dragReady}
      data-mf-task-card="true"
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerRelease}
      onPointerLeave={handlePointerRelease}
      onPointerCancel={handlePointerRelease}
      onDragStart={handleDragStartInternal}
      onDragEnd={handleDragEndInternal}
      className={`border rounded-xl transition-all duration-150 select-none ${
        isDragging
          ? 'bg-gray-50 border-dashed border-gray-300 opacity-40 shadow-none scale-[0.98] cursor-grabbing dark:bg-[#232326] dark:border-white/10'
          : dragReady
            ? 'bg-white cursor-grab hover:shadow-md hover:-translate-y-0.5 dark:bg-[#27272A] dark:hover:bg-[#323238] dark:hover:shadow-none'
            : 'bg-white cursor-pointer hover:shadow-md hover:-translate-y-0.5 dark:bg-[#27272A] dark:hover:bg-[#323238] dark:hover:shadow-none'
      }`}
      style={{
        borderColor: isDragging ? undefined : '#ececec',
        padding: '12px 13px 11px',
        boxShadow: isDragging ? 'none' : '0 1px 0 rgba(15,17,21,.02)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        {/* When grouped by priority, show status badge — and vice versa */}
        {groupBy === 'status' ? (
          <span
            data-mf-priority={task.priority}
            className="inline-flex items-center gap-[5px] text-[10.5px] font-semibold rounded-md"
            style={{ padding: '3px 7px 3px 6px', letterSpacing: '0.04em', color: p.fg, background: p.bg }}
          >
            <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: p.fg }} />
            {p.label}
          </span>
        ) : (
          <span
            data-mf-status={task.status ?? 'NotStarted'}
            className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold rounded-md"
            style={{ padding: '3px 7px 3px 6px', letterSpacing: '0.03em', color: s.fg, background: s.bg }}
          >
            <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: s.dot }} />
            {s.label}
          </span>
        )}

        {/* Tags */}
        {task.tags?.slice(0, 2).map(tag => (
          <span
            key={tag}
            className="inline-flex text-[10px] font-medium rounded-md"
            style={{ padding: '2px 6px', color: '#5a606b', background: '#f1f0ed', letterSpacing: '0.02em' }}
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-[14px] font-medium leading-[1.4] text-[#0f1115] dark:text-white">{task.content}</p>

      {task.dueDate && (
        <div className={`flex items-center gap-1.5 mt-2 text-[11.5px] ${overdue ? 'text-red-500' : 'text-[#9098a4]'}`}>
          <CalIcon />
          {formatDue(task.dueDate)}{task.dueTime ? ` · ${task.dueTime}` : ''}
        </div>
      )}
    </article>
  );
}

interface Props {
  tasks: Task[];
  projects: Project[];
  activeProjectId?: string | null;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: TaskStatus, description?: string, tags?: string[], subtasks?: import('../../../shared/types').Subtask[], estimatedHours?: number, dueTime?: string) => void;
  isLoading?: boolean;
}

export function TaskKanbanView({ tasks, projects, activeProjectId, onEdit, onToggle, onDelete, onAdd, isLoading = false }: Props) {
  const [groupBy, setGroupBy] = useState<'status' | 'priority'>('status');
  const [search, setSearch] = useState('');
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [addingInKey, setAddingInKey] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    if (!search.trim()) return tasks;
    const q = search.toLowerCase();
    return tasks.filter(t =>
      t.content.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  }, [tasks, search]);

  function handleDragStart(e: React.DragEvent, id: string) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    setTimeout(() => setDraggingId(id), 0);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverKey(null);
  }

  function handleDragEnter(e: React.DragEvent, key: string) {
    e.preventDefault();
    if (!draggingId) return;
    setDragOverKey(key);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }

  function handleDrop(e: React.DragEvent, key: string) {
    e.preventDefault();
    setDragOverKey(null);
    if (!draggingId) return;
    const task = tasks.find(t => t.id === draggingId);
    if (!task) { setDraggingId(null); return; }

    if (groupBy === 'status') {
      const status = key as TaskStatus;
      if (task.status !== status) onEdit(draggingId, { status });
    } else {
      const priority = key as TaskPriority;
      if (task.priority !== priority) onEdit(draggingId, { priority });
    }
    setDraggingId(null);
  }

  const columns = groupBy === 'status' ? STATUSES : PRIORITIES;

  if (isLoading) return <BoardViewSkeleton columns={groupBy === 'status' ? 3 : 4} />;

  return (
    <>
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 flex-wrap"
        style={{ padding: '0 18px 14px', marginBottom: 2 }}
      >
        {/* Group by toggle */}
        <div className="mf-segmented">
          {(['status', 'priority'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setGroupBy(mode)}
              className={`mf-segmented-option ${groupBy === mode ? 'is-active' : ''}`}
            >
              {{ status: 'Statusy', priority: 'Priorytety' }[mode]}
            </button>
          ))}
        </div>

        {/* Search */}
        <div
          data-mf-board-control="true"
          className="flex items-center gap-2 transition-all duration-150"
          style={{
            padding: '5px 10px',
            background: '#fff',
            border: `1px solid ${search ? '#9098a4' : '#ececec'}`,
            borderRadius: 7,
            minWidth: 180,
          }}
        >
          <span style={{ color: '#9098a4', flexShrink: 0 }}><SearchIcon /></span>
          <input
            type="text"
            placeholder="Szukaj po nazwie lub etykiecie…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="bg-transparent outline-none w-full"
            style={{ fontSize: 12.5, color: '#0f1115', caretColor: '#0f1115' }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ color: '#9098a4', flexShrink: 0, lineHeight: 1 }}
              className="hover:text-[#3a3f47] transition-colors"
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        {search && (
          <span style={{ fontSize: 12, color: '#9098a4' }}>
            {filteredTasks.length} {filteredTasks.length === 1 ? 'zadanie' : filteredTasks.length < 5 ? 'zadania' : 'zadań'}
          </span>
        )}
      </div>

      {/* Columns */}
      <div
        className="flex h-full min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar"
        style={{ paddingBottom: 220 }}
      >
        <div className="flex h-full min-w-min mx-auto">
          {columns.map((col, i) => {
            const colTasks = filteredTasks.filter(t =>
              groupBy === 'status'
                ? (t.status ?? 'NotStarted') === col.key
                : t.priority === col.key
            );
            const isOver = dragOverKey === col.key;

            return (
              <section
                key={col.key}
                data-mf-column="true"
                className="flex-none flex flex-col h-full min-h-0 relative"
                style={{
                  width: 288,
                  padding: '0 18px',
                  borderLeft: i === 0 ? 'none' : '1px solid #ececec',
                }}
                onDragEnter={e => handleDragEnter(e, col.key)}
                onDragOver={handleDragOver}
                onDrop={e => handleDrop(e, col.key)}
              >
                {/* accent bar */}
                <span
                  className="absolute rounded-sm transition-opacity duration-150"
                  style={{ top: 2, left: 18, right: 18, height: 2, background: col.accent, opacity: isOver ? 1 : 0.6 }}
                />

                {/* header */}
                <div className="flex items-center gap-2" style={{ padding: '14px 0 8px' }}>
                  <span
                    data-mf-priority={groupBy === 'priority' ? col.key : undefined}
                    data-mf-status={groupBy === 'status' ? col.key : undefined}
                    className="inline-flex items-center gap-[5px] text-[11px] font-semibold rounded-md"
                    style={{ padding: '3px 8px 3px 7px', letterSpacing: '0.03em', color: col.fg, background: col.bg }}
                  >
                    <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: col.dot }} />
                    {col.label}
                  </span>
                  <span className="text-[11px] text-[#9098a4]">{colTasks.length}</span>
                </div>

                {/* cards */}
                <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pb-3 custom-scrollbar">
                  {colTasks.length === 0 && !isOver && (
                    <div
                      data-mf-empty-state="true"
                      className="text-center text-[13px] text-[#b8bcc4] rounded-xl py-8"
                      style={{ border: '1.5px dashed #e3e3df' }}
                    >
                      Brak zadań
                    </div>
                  )}

                  {colTasks.map(task => (
                    <Card
                      key={task.id}
                      task={task}
                      groupBy={groupBy}
                      isDragging={draggingId === task.id}
                      onOpen={setEditingTask}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                    />
                  ))}

                  {isOver && draggingId && (
                    <div data-mf-empty-state="true" className="p-4 h-[52px] rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 flex items-center justify-center animate-pulse">
                      <span className="text-[11px] font-semibold text-gray-400">Upuść tutaj</span>
                    </div>
                  )}

                  <button
                    onClick={() => setAddingInKey(col.key)}
                    className="flex items-center gap-2 text-[13px] text-[#9098a4] rounded-xl border border-dashed border-transparent hover:border-[#e3e3df] transition-colors text-left"
                    style={{ padding: '9px 12px' }}
                  >
                    <PlusIcon /> Dodaj zadanie
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      </div>

      {addingInKey && (
        <TaskAddModal
          projects={projects}
          initialStatus={groupBy === 'status' ? (addingInKey as TaskStatus) : undefined}
          initialPriority={groupBy === 'priority' ? (addingInKey as TaskPriority) : undefined}
          initialProjectId={activeProjectId ?? undefined}
          onAdd={onAdd}
          onClose={() => setAddingInKey(null)}
        />
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projects={projects}
          onSave={(updates) => onEdit(editingTask.id, updates)}
          onDelete={() => { onDelete(editingTask.id); setEditingTask(null); }}
          onToggleComplete={() => { onToggle(editingTask.id); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}
    </>
  );
}
