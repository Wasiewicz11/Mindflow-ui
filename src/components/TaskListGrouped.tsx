import { useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Project, TaskStatus } from '../types';
import { TaskPriority } from '../types';
import { TaskEditModal } from './TaskEditModal';
import { TaskAddModal } from './TaskAddModal';
import { CalendarDatePicker } from './CalendarDatePicker';

const STATUS_META: Record<string, { label: string; dot: string; fg: string; bg: string }> = {
  NotStarted: { label: 'Nie rozpoczęto', dot: 'oklch(0.75 0.01 260)', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)' },
  InProgress:  { label: 'W trakcie',     dot: 'oklch(0.60 0.18 230)', fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)'  },
  Completed:   { label: 'Ukończone',     dot: 'oklch(0.55 0.18 145)', fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)'  },
};

interface Props {
  tasks: Task[];
  projects: Project[];
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../types').TaskStatus, description?: string) => void;
  onBulkEdit?: (ids: string[], updates: Partial<Task>) => void;
  onClearCompleted?: () => void;
  isLoading?: boolean;
  activeProjectId?: string | null;
}

const PRIORITY: Record<TaskPriority, { label: string; name: string; fg: string; bg: string }> = {
  [TaskPriority.P1]: { label: 'P1', name: 'Pilne',   fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  [TaskPriority.P2]: { label: 'P2', name: 'Wysokie', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  [TaskPriority.P3]: { label: 'P3', name: 'Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  [TaskPriority.P4]: { label: 'P4', name: 'Niskie',  fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const PRIORITY_ORDER: Record<TaskPriority, number> = {
  [TaskPriority.P1]: 0,
  [TaskPriority.P2]: 1,
  [TaskPriority.P3]: 2,
  [TaskPriority.P4]: 3,
};

interface Group {
  key: string;
  label: string;
  sublabel?: string;
  tasks: Task[];
  variant?: 'overdue';
}

function parseLocalDate(dateStr: string): Date {
  // "2026-05-21" → local midnight (avoids UTC offset shifting the day)
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function getDateLabel(dateStr: string): string {
  const d = parseLocalDate(dateStr);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return `${Math.abs(diff)}d temu`;
  if (diff === 0) return 'Dzisiaj';
  if (diff === 1) return 'Jutro';
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function groupTasks(tasks: Task[]): Group[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + (6 - today.getDay() + 7) % 7 + 1);

  const buckets: Group[] = [
    { key: 'overdue',  label: 'Zaległe',          variant: 'overdue', tasks: [] },
    { key: 'today',    label: 'Dzisiaj',           sublabel: 'Zaplanowane na dziś', tasks: [] },
    { key: 'tomorrow', label: 'Jutro',             tasks: [] },
    { key: 'week',     label: 'W tym tygodniu',    tasks: [] },
    { key: 'later',    label: 'Później',           tasks: [] },
    { key: 'none',     label: 'Bez terminu',       tasks: [] },
  ];

  const open = tasks.filter(t => !t.isCompleted);

  open.forEach(t => {
    if (!t.dueDate) { buckets[5].tasks.push(t); return; }
    const d = parseLocalDate(t.dueDate);
    if (d < today)                                buckets[0].tasks.push(t);
    else if (d.getTime() === today.getTime())     buckets[1].tasks.push(t);
    else if (d.getTime() === tomorrow.getTime())  buckets[2].tasks.push(t);
    else if (d < endOfWeek)                       buckets[3].tasks.push(t);
    else                                          buckets[4].tasks.push(t);
  });

  buckets.forEach(b => b.tasks.sort((a, b) => (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3)));

  return buckets.filter(b => b.tasks.length > 0);
}

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2"/>
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>
    </svg>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
      style={{ transform: open ? 'rotate(0)' : 'rotate(-90deg)', transition: 'transform .15s' }}>
      <path d="m6 9 6 6 6-6"/>
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M12 5v14M5 12h14"/>
    </svg>
  );
}

function TaskRow({ task, project, onToggle, onClick, onEdit, isSelectionMode, isSelected, onSelect }: {
  task: Task;
  project?: Project;
  onToggle: () => void;
  onClick: () => void;
  onEdit?: (updates: Partial<Task>) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const p = PRIORITY[task.priority] ?? PRIORITY[TaskPriority.P4];
  const st = STATUS_META[task.status ?? 'NotStarted'] ?? STATUS_META.NotStarted;
  const dateLabel = task.dueDate ? getDateLabel(task.dueDate) : '';
  const overdue = task.dueDate
    ? new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)
    : false;

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [priorityRect, setPriorityRect] = useState<DOMRect | null>(null);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const [dateRect, setDateRect] = useState<DOMRect | null>(null);

  const closeAll = () => { setPriorityOpen(false); setStatusOpen(false); setDateOpen(false); };

  const handleRowClick = () => {
    if (isSelectionMode) { onSelect?.(); return; }
    onClick();
  };

  const handlePriorityClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (isSelectionMode || !onEdit) return;
    setPriorityRect(e.currentTarget.getBoundingClientRect());
    setStatusOpen(false); setDateOpen(false);
    setPriorityOpen(o => !o);
  };

  const handleStatusClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (isSelectionMode || !onEdit) return;
    setStatusRect(e.currentTarget.getBoundingClientRect());
    setPriorityOpen(false); setDateOpen(false);
    setStatusOpen(o => !o);
  };

  const handleDateClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (isSelectionMode || !onEdit) return;
    setDateRect(e.currentTarget.getBoundingClientRect());
    setPriorityOpen(false); setStatusOpen(false);
    setDateOpen(o => !o);
  };

  return (
    <>
    <div
      onClick={handleRowClick}
      className="flex items-center cursor-pointer group select-none transition-opacity"
      style={{
        padding: '9px 0',
        borderBottom: '1px solid #f1f0ed',
        gap: 10,
        background: isSelected ? '#eef2ff' : 'transparent',
        opacity: isSelectionMode && !isSelected ? 0.45 : 1,
        borderRadius: isSelected ? 6 : 0,
      }}
      onMouseEnter={e => { if (!isSelected) { e.currentTarget.style.background = '#faf9f7'; e.currentTarget.style.opacity = isSelectionMode ? '0.65' : '1'; } }}
      onMouseLeave={e => { e.currentTarget.style.background = isSelected ? '#eef2ff' : 'transparent'; e.currentTarget.style.opacity = isSelectionMode && !isSelected ? '0.45' : '1'; }}
    >
      {/* Checkbox / selection circle */}
      {isSelectionMode ? (
        <button
          onClick={e => { e.stopPropagation(); onSelect?.(); }}
          className="flex-none flex items-center justify-center rounded-full border-2 transition-all"
          style={{
            width: 20, height: 20, flexShrink: 0,
            borderColor: isSelected ? '#0f1115' : '#d4d4d0',
            background: isSelected ? '#0f1115' : 'transparent',
          }}
        >
          {isSelected && (
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          )}
        </button>
      ) : (
        <button
          onClick={e => { e.stopPropagation(); onToggle(); }}
          className="flex-none rounded-full border transition-colors hover:border-[#9098a4]"
          style={{ width: 20, height: 20, borderColor: '#d4d4d0', background: 'transparent', flexShrink: 0 }}
        />
      )}

      {/* Priority badge — clickable */}
      <button
        onClick={handlePriorityClick}
        className="flex-none text-[10.5px] font-semibold rounded-[5px] transition-opacity"
        style={{
          padding: '2px 6px',
          color: p.fg,
          background: p.bg,
          letterSpacing: '0.03em',
          minWidth: 26,
          textAlign: 'center',
          flexShrink: 0,
          cursor: onEdit && !isSelectionMode ? 'pointer' : 'default',
          border: 'none',
        }}
        title={onEdit && !isSelectionMode ? 'Zmień priorytet' : undefined}
      >
        {p.label}
      </button>

      {/* Status badge — clickable */}
      <button
        onClick={handleStatusClick}
        className="flex-none inline-flex items-center gap-[4px] text-[10.5px] font-semibold rounded-[5px]"
        title={onEdit && !isSelectionMode ? 'Zmień status' : st.label}
        style={{
          padding: '2px 7px', color: st.fg, background: st.bg, letterSpacing: '0.02em', flexShrink: 0,
          border: 'none', cursor: onEdit && !isSelectionMode ? 'pointer' : 'default',
        }}
      >
        <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: st.dot }} />
        {st.label}
      </button>

      {/* Title */}
      <span
        className="flex-1 text-[14px] text-[#0f1115] truncate min-w-0"
        style={{ fontWeight: 450 }}
      >
        {task.content}
      </span>

      {/* Right meta — project + date */}
      <div className="flex items-center gap-5 flex-none" style={{ color: '#9098a4' }}>
        {project && (
          <div className="flex items-center gap-1.5 text-[13px]" style={{ minWidth: 88 }}>
            <span
              className="rounded-full flex-none"
              style={{ width: 6, height: 6, background: project.color || '#9aa0aa' }}
            />
            <span className="truncate">{project.name}</span>
          </div>
        )}

        {/* Date — clickable */}
        <button
          onClick={handleDateClick}
          className={`flex items-center gap-1.5 text-[13px] transition-opacity ${overdue ? 'text-red-400' : ''}`}
          style={{
            minWidth: 76,
            color: task.dueDate ? (overdue ? undefined : '#9098a4') : '#d4d4d0',
            background: 'none',
            border: 'none',
            padding: 0,
            cursor: onEdit && !isSelectionMode ? 'pointer' : 'default',
            fontFamily: 'inherit',
          }}
          title={onEdit && !isSelectionMode ? 'Zmień termin' : undefined}
        >
          <CalIcon />
          <span>{task.dueDate ? dateLabel : '—'}</span>
        </button>
      </div>
    </div>

    {/* Priority picker portal */}
    {priorityOpen && priorityRect && typeof document !== 'undefined' && createPortal(
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setPriorityOpen(false)}
        />
        <div
          className="animate-calendar-reveal"
          style={{
            position: 'fixed',
            top: priorityRect.bottom + 4,
            left: priorityRect.left,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #e8e8e4',
            borderRadius: 10,
            boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
            padding: 4,
            minWidth: 158,
          }}
          onClick={e => e.stopPropagation()}
        >
          {([TaskPriority.P1, TaskPriority.P2, TaskPriority.P3, TaskPriority.P4] as TaskPriority[]).map(priority => {
            const pr = PRIORITY[priority];
            const isActive = task.priority === priority;
            return (
              <button
                key={priority}
                onClick={e => { e.stopPropagation(); onEdit?.({ priority }); setPriorityOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '5px 8px', borderRadius: 7,
                  background: isActive ? '#f7f7f4' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f7f7f4'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span style={{
                  padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 600,
                  color: pr.fg, background: pr.bg, letterSpacing: '0.03em',
                  minWidth: 26, textAlign: 'center', flexShrink: 0,
                }}>{pr.label}</span>
                <span style={{ fontSize: 13, color: '#3a3f47', fontWeight: isActive ? 600 : 400 }}>{pr.name}</span>
                {isActive && (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#0f1115" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </>,
      document.body
    )}

    {/* Status picker portal */}
    {statusOpen && statusRect && typeof document !== 'undefined' && createPortal(
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setStatusOpen(false)}
        />
        <div
          className="animate-calendar-reveal"
          style={{
            position: 'fixed',
            top: statusRect.bottom + 4,
            left: statusRect.left,
            zIndex: 9999,
            background: '#fff',
            border: '1px solid #e8e8e4',
            borderRadius: 10,
            boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
            padding: 4,
            minWidth: 178,
          }}
          onClick={e => e.stopPropagation()}
        >
          {(Object.keys(STATUS_META) as TaskStatus[]).map(s => {
            const sm = STATUS_META[s];
            const isActive = (task.status ?? 'NotStarted') === s;
            return (
              <button
                key={s}
                onClick={e => { e.stopPropagation(); onEdit?.({ status: s }); setStatusOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  width: '100%', padding: '5px 8px', borderRadius: 7,
                  background: isActive ? '#f7f7f4' : 'transparent',
                  border: 'none', cursor: 'pointer', textAlign: 'left',
                }}
                onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#f7f7f4'; }}
                onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                <span
                  className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold rounded-[5px] flex-none"
                  style={{ padding: '2px 7px', color: sm.fg, background: sm.bg, letterSpacing: '0.02em' }}
                >
                  <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: sm.dot }} />
                  {sm.label}
                </span>
                {isActive && (
                  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#0f1115" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                    <path d="M5 13l4 4L19 7"/>
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      </>,
      document.body
    )}

    {/* Date picker portal */}
    {dateOpen && dateRect && typeof document !== 'undefined' && createPortal(
      <>
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
          onClick={() => setDateOpen(false)}
        />
        <div
          className="animate-calendar-reveal"
          style={{
            position: 'fixed',
            top: dateRect.bottom + 4,
            left: Math.max(8, dateRect.right - 240),
            zIndex: 9999,
            width: 240,
            boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
            borderRadius: 16,
            overflow: 'hidden',
          }}
          onClick={e => e.stopPropagation()}
        >
          <CalendarDatePicker
            value={task.dueDate ?? ''}
            onChange={date => { onEdit?.({ dueDate: date || undefined }); setDateOpen(false); }}
            onClose={() => setDateOpen(false)}
          />
        </div>
      </>,
      document.body
    )}
    </>
  );
}

function GroupBlock({ group, projects, onToggle, onEdit, onDelete, onAdd, isSelectionMode, selectedIds, onSelect, activeProjectId }: {
  group: Group;
  projects: Project[];
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../types').TaskStatus, description?: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  activeProjectId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);

  const isOverdue = group.variant === 'overdue';

  return (
    <div className="mb-8">
      {/* Group header */}
      <div
        className="flex items-center gap-2 cursor-pointer select-none mb-1"
        onClick={() => setOpen(o => !o)}
        style={{ padding: '4px 0 6px' }}
      >
        <span style={{ color: isOverdue ? '#e05050' : '#9098a4' }} className="flex-none">
          <ChevronIcon open={open} />
        </span>
        <span
          className="text-[15px] font-semibold"
          style={{ color: isOverdue ? '#e05050' : '#0f1115' }}
        >
          {group.label}
        </span>
        <span
          className="text-[13px] font-semibold rounded-full px-1.5"
          style={isOverdue
            ? { color: '#fff', background: '#e05050', fontSize: 11, padding: '1px 7px' }
            : { color: '#9098a4' }
          }
        >
          {group.tasks.length}
        </span>
        {group.sublabel && (
          <span className="ml-auto text-[12.5px] text-[#b0b5be]">{group.sublabel}</span>
        )}
      </div>

      {open && (
        <>
          {group.tasks.map(task => (
            <TaskRow
              key={task.id}
              task={task}
              project={projects.find(p => p.id === task.project_id)}
              onToggle={() => onToggle(task.id)}
              onClick={() => { if (!isSelectionMode) setEditingTask(task); }}
              onEdit={updates => onEdit(task.id, updates)}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds?.includes(task.id)}
              onSelect={() => onSelect?.(task.id)}
            />
          ))}

          <button
            className="flex items-center gap-2 text-[13px] transition-colors mt-1 py-2"
            style={{ color: '#c0c5cc' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#c0c5cc'; }}
            onClick={() => setAddingOpen(true)}
          >
            <PlusIcon /> Dodaj zadanie
          </button>
        </>
      )}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projects={projects}
          onSave={updates => { onEdit(editingTask.id, updates); setEditingTask(null); }}
          onDelete={() => { onDelete(editingTask.id); setEditingTask(null); }}
          onToggleComplete={() => { onToggle(editingTask.id); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {addingOpen && (
        <TaskAddModal
          projects={projects}
          initialProjectId={activeProjectId ?? undefined}
          onAdd={(content, priority, dueDate, projectId, status, description) => onAdd(content, priority, dueDate, projectId, status, description)}
          onClose={() => setAddingOpen(false)}
        />
      )}
    </div>
  );
}


export function TaskListGrouped({ tasks, projects, onToggle, onEdit, onDelete, onAdd, onBulkEdit, onClearCompleted, isLoading, activeProjectId }: Props) {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingCompleted, setEditingCompleted] = useState<Task | null>(null);

  const activeTasks = tasks.filter(t => !t.isCompleted);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const exitSelection = () => { setIsSelectionMode(false); setSelectedIds([]); };

  const floatingToolbar = isSelectionMode && selectedIds.length > 0 && typeof document !== 'undefined'
    ? createPortal(
      <div className="fixed z-[100] bottom-0 left-0 right-0 w-full lg:w-max lg:bottom-10 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 bg-white/98 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t lg:border border-gray-200/60 dark:border-white/10 rounded-t-3xl lg:rounded-full shadow-[0_-20px_40px_rgba(0,0,0,0.1)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.08)] px-4 pb-8 pt-5 lg:px-5 lg:py-2.5">
        {/* Mobile header row */}
        <div className="flex lg:hidden justify-between items-center mb-4 w-full px-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedIds.length} zaznaczonych</span>
            <button
              onClick={() => selectedIds.length === activeTasks.length ? setSelectedIds([]) : setSelectedIds(activeTasks.map(t => t.id))}
              className="text-xs text-gray-400 hover:text-gray-700 transition-colors"
            >
              {selectedIds.length === activeTasks.length ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
            </button>
          </div>
          <button onClick={exitSelection} className="p-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-500 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:flex items-center gap-3 lg:gap-4 w-full lg:w-auto">
          {/* Zaznacz wszystko — desktop only */}
          <button
            onClick={() => selectedIds.length === activeTasks.length ? setSelectedIds([]) : setSelectedIds(activeTasks.map(t => t.id))}
            className="hidden lg:flex items-center justify-center bg-gray-100/80 hover:bg-gray-200/80 px-3 py-1.5 rounded-full text-xs font-semibold text-gray-700 whitespace-nowrap transition-colors"
          >
            {selectedIds.length === activeTasks.length ? 'Odznacz wszystko' : `${selectedIds.length} / ${activeTasks.length}`}
          </button>
          <div className="hidden lg:block h-5 w-px bg-gray-200"></div>

          {/* Ukończ */}
          <button
            onClick={() => { onBulkEdit?.(selectedIds, { status: 'Completed' }); exitSelection(); }}
            className="col-span-1 flex items-center justify-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200/60 lg:border-none lg:bg-transparent lg:hover:bg-emerald-50 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
            <span>Ukończ</span>
          </button>

          {/* Usuń */}
          <button
            onClick={() => {
              if (!window.confirm(`Czy na pewno chcesz usunąć ${selectedIds.length} zadań?`)) return;
              selectedIds.forEach(id => onDelete(id));
              exitSelection();
            }}
            className="col-span-1 flex items-center justify-center gap-1.5 bg-red-50 hover:bg-red-100 text-red-500 border border-red-200/60 lg:border-none lg:bg-transparent lg:hover:bg-red-50 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span>Usuń</span>
          </button>

          {/* Termin */}
          <div className="col-span-1 relative flex items-center justify-center bg-gray-50 hover:bg-gray-100 border border-gray-100/80 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 py-2 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors">
            <svg className="w-4 h-4 text-gray-400 flex-shrink-0 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <input
              type="date"
              value={bulkDueDate}
              onChange={e => {
                const chosen = e.target.value;
                setBulkDueDate(chosen);
                if (selectedIds.length > 0) onBulkEdit?.(selectedIds, { dueDate: chosen || undefined });
                exitSelection();
                setBulkDueDate('');
              }}
              className="bg-transparent text-xs font-semibold text-gray-700 outline-none cursor-pointer w-28 lg:w-24"
            />
          </div>

          <div className="hidden lg:block h-5 w-px bg-gray-200"></div>
          <button onClick={exitSelection} className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-colors items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  if (isLoading) {
    return (
      <div className="space-y-3 pt-4">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-3 py-2.5" style={{ borderBottom: '1px solid #f1f0ed' }}>
            <div className="flex-none w-5 h-5 rounded-full animate-pulse" style={{ background: '#f0f0ed' }} />
            <div className="flex-none w-7 h-5 rounded animate-pulse" style={{ background: '#f0f0ed' }} />
            <div className="flex-1 h-4 rounded animate-pulse" style={{ background: '#f0f0ed' }} />
          </div>
        ))}
      </div>
    );
  }

  const groups = groupTasks(tasks);
  const completedTasks = tasks.filter(t => t.isCompleted);

  if (groups.length === 0 && completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <p className="text-[14px] text-[#9098a4]">Brak zadań. Dodaj pierwsze za pomocą panelu na dole!</p>
        <button
          className="flex items-center gap-2 text-[13px] font-medium transition-colors rounded-lg px-3 py-1.5"
          style={{ color: '#9098a4', background: '#f5f4f1' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0f1115'; (e.currentTarget as HTMLElement).style.background = '#eceae6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; (e.currentTarget as HTMLElement).style.background = '#f5f4f1'; }}
          onClick={() => setAddModalOpen(true)}
        >
          <PlusIcon /> Nowe zadanie
        </button>
        {addModalOpen && (
          <TaskAddModal
            projects={projects}
            initialProjectId={activeProjectId ?? undefined}
            onAdd={(content, priority, dueDate, projectId, status, description) => { onAdd(content, priority, dueDate, projectId, status, description); setAddModalOpen(false); }}
            onClose={() => setAddModalOpen(false)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="pt-2">
      {floatingToolbar}

      {/* Top-level add button + Wybierz wiele */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-[13px] font-medium transition-colors rounded-lg px-3 py-1.5"
          style={{ color: '#9098a4', background: '#f5f4f1' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0f1115'; (e.currentTarget as HTMLElement).style.background = '#eceae6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; (e.currentTarget as HTMLElement).style.background = '#f5f4f1'; }}
          onClick={() => setAddModalOpen(true)}
        >
          <PlusIcon /> Nowe zadanie
        </button>
        {activeTasks.length > 0 && (
          <button
            onClick={() => { setIsSelectionMode(m => !m); setSelectedIds([]); }}
            className="text-[12px] font-semibold transition-colors rounded-lg px-3 py-1.5"
            style={{
              background: isSelectionMode ? '#0f1115' : '#f5f4f1',
              color: isSelectionMode ? '#fff' : '#9098a4',
            }}
          >
            {isSelectionMode ? 'Gotowe' : 'Wybierz'}
          </button>
        )}
      </div>

      {addModalOpen && (
        <TaskAddModal
          projects={projects}
          initialProjectId={activeProjectId ?? undefined}
          onAdd={(content, priority, dueDate, projectId, status, description) => { onAdd(content, priority, dueDate, projectId, status, description); setAddModalOpen(false); }}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {groups.map(group => (
        <GroupBlock
          key={group.key}
          group={group}
          projects={projects}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdd={onAdd}
          isSelectionMode={isSelectionMode}
          selectedIds={selectedIds}
          onSelect={toggleSelect}
          activeProjectId={activeProjectId}
        />
      ))}

      {/* Completed section */}
      {completedTasks.length > 0 && (
        <div className="mt-2">
          {/* Header */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{ padding: '4px 0 6px' }}
            onClick={() => setCompletedOpen(o => !o)}
          >
            <span className="text-[#9098a4] flex-none"><ChevronIcon open={completedOpen} /></span>
            <span className="text-[15px] font-semibold text-[#9098a4]">Wykonane</span>
            <span className="text-[13px] text-[#b0b5be]">{completedTasks.length}</span>
            {onClearCompleted && (
              <button
                className="ml-auto text-[12px] font-medium transition-colors"
                style={{ color: '#c0c5cc' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#e05050'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#c0c5cc'; }}
                onClick={e => { e.stopPropagation(); onClearCompleted(); }}
              >
                Wyczyść
              </button>
            )}
          </div>

          {/* Completed rows */}
          {completedOpen && (
            <>
              {completedTasks.map(task => (
                <div
                  key={task.id}
                  className="flex items-center cursor-pointer"
                  style={{ padding: '9px 0', borderBottom: '1px solid #f1f0ed', gap: 10, opacity: 0.6 }}
                  onClick={() => setEditingCompleted(task)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Checked circle */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggle(task.id); }}
                    className="flex-none flex items-center justify-center rounded-full border-2 transition-colors hover:opacity-70"
                    style={{ width: 20, height: 20, borderColor: '#0f1115', background: '#0f1115', flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  </button>

                  {/* Priority badge — dimmed */}
                  <span
                    className="flex-none text-[10.5px] font-semibold rounded-[5px]"
                    style={{
                      padding: '2px 6px',
                      color: '#b0b5be',
                      background: '#f1f0ed',
                      letterSpacing: '0.03em',
                      minWidth: 26,
                      textAlign: 'center',
                      flexShrink: 0,
                    }}
                  >
                    {(PRIORITY[task.priority] ?? PRIORITY[TaskPriority.P4]).label}
                  </span>

                  {/* Title strikethrough */}
                  <span
                    className="flex-1 text-[14px] text-[#9098a4] truncate min-w-0"
                    style={{ fontWeight: 450, textDecoration: 'line-through' }}
                  >
                    {task.content}
                  </span>

                  {/* Date placeholder to keep alignment */}
                  <div className="flex items-center gap-5 flex-none" style={{ color: '#d4d4d0' }}>
                    <div className="flex items-center gap-1.5 text-[13px]" style={{ minWidth: 76 }}>
                      <CalIcon />
                      <span>{task.dueDate ? getDateLabel(task.dueDate) : '—'}</span>
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Edit modal for completed tasks */}
          {editingCompleted && (
            <TaskEditModal
              task={editingCompleted}
              projects={projects}
              onSave={updates => { onEdit(editingCompleted.id, updates); setEditingCompleted(null); }}
              onDelete={() => { onDelete(editingCompleted.id); setEditingCompleted(null); }}
              onToggleComplete={() => { onToggle(editingCompleted.id); setEditingCompleted(null); }}
              onClose={() => setEditingCompleted(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
