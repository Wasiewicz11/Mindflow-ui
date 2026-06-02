import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, ChevronDown, CircleDot, Flag } from 'lucide-react';
import type { Task, Project, TaskStatus } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';
import { TaskEditModal } from './TaskEditModal';
import { TaskAddModal } from './TaskAddModal';
import { CalendarDatePicker } from '../../../shared/ui/CalendarDatePicker';

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
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../../../shared/types').TaskStatus, description?: string) => void;
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

type GroupMode = 'dueDate' | 'priority' | 'status';

const GROUP_MODE_OPTIONS: Array<{ value: GroupMode; label: string; icon: typeof CalendarDays }> = [
  { value: 'dueDate', label: 'Terminy', icon: CalendarDays },
  { value: 'priority', label: 'Priorytety', icon: Flag },
  { value: 'status', label: 'Statusy', icon: CircleDot },
];

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

function getDueRank(task: Task): number {
  if (!task.dueDate) return Number.MAX_SAFE_INTEGER;
  return parseLocalDate(task.dueDate).getTime();
}

function sortByDueThenPriority(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const dueDiff = getDueRank(a) - getDueRank(b);
    if (dueDiff !== 0) return dueDiff;
    return (PRIORITY_ORDER[a.priority] ?? 3) - (PRIORITY_ORDER[b.priority] ?? 3);
  });
}

function getSubtaskProgress(task: Task) {
  const total = task.subtaskTotalCount ?? task.subtasks?.length ?? 0;
  const completed = task.subtaskCompletedCount ?? task.subtasks?.filter(subtask => subtask.isCompleted).length ?? 0;
  return { completed, total };
}

function groupTasksByDueDate(tasks: Task[]): Group[] {
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

function groupTasksByPriority(tasks: Task[]): Group[] {
  const open = tasks.filter(t => !t.isCompleted);
  return ([TaskPriority.P1, TaskPriority.P2, TaskPriority.P3, TaskPriority.P4] as TaskPriority[])
    .map(priority => {
      const meta = PRIORITY[priority];
      return {
        key: `priority-${priority}`,
        label: `${meta.label} ${meta.name}`,
        tasks: sortByDueThenPriority(open.filter(t => t.priority === priority)),
      };
    })
    .filter(group => group.tasks.length > 0);
}

function groupTasksByStatus(tasks: Task[]): Group[] {
  const open = tasks.filter(t => !t.isCompleted);
  return (['NotStarted', 'InProgress'] as TaskStatus[])
    .map(status => {
      const meta = STATUS_META[status];
      return {
        key: `status-${status}`,
        label: meta.label,
        tasks: sortByDueThenPriority(open.filter(t => (t.status ?? 'NotStarted') === status)),
      };
    })
    .filter(group => group.tasks.length > 0);
}

function groupTasks(tasks: Task[], mode: GroupMode): Group[] {
  if (mode === 'priority') return groupTasksByPriority(tasks);
  if (mode === 'status') return groupTasksByStatus(tasks);
  return groupTasksByDueDate(tasks);
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}

interface FilterOption { value: string; label: string; fg?: string; bg?: string; dot?: string }

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const isActive = value !== 'all';
  const active = options.find(o => o.value === value);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          padding: '5px 10px',
          borderRadius: 7,
          fontSize: 12,
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          background: isActive ? (active?.bg ?? '#f1f0ed') : '#fff',
          color: isActive ? (active?.fg ?? '#0f1115') : '#5a606b',
          border: `1px solid ${isActive ? 'transparent' : '#ececec'}`,
          transition: 'all 0.15s',
        }}
      >
        {isActive && active?.dot && (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: active.dot, flexShrink: 0 }} />
        )}
        {isActive ? (active?.label ?? label) : label}
        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="m6 9 6 6 6-6"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onClick={() => setOpen(false)} />
          <div
            className="animate-calendar-reveal"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              marginTop: 4,
              zIndex: 99,
              background: '#fff',
              border: '1px solid #e8e8e4',
              borderRadius: 10,
              boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
              padding: 4,
              minWidth: 170,
            }}
          >
            {options.map(opt => {
              const sel = value === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '5px 8px', borderRadius: 7,
                    background: sel ? '#f7f7f4' : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                  }}
                  onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = '#f7f7f4'; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  {opt.dot && <span style={{ width: 7, height: 7, borderRadius: '50%', background: opt.dot, flexShrink: 0 }} />}
                  {opt.bg && opt.fg && opt.value !== 'all' ? (
                    <span style={{ padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, color: opt.fg, background: opt.bg, letterSpacing: '0.03em' }}>
                      {opt.label}
                    </span>
                  ) : (
                    <span style={{ fontSize: 13, color: sel ? '#0f1115' : '#3a3f47', fontWeight: sel ? 600 : 400 }}>
                      {opt.label}
                    </span>
                  )}
                  {sel && (
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="#0f1115" strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 'auto' }}>
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function GroupModeSelect({ value, onChange }: {
  value: GroupMode;
  onChange: (value: GroupMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const active = GROUP_MODE_OPTIONS.find(option => option.value === value) ?? GROUP_MODE_OPTIONS[0];
  const ActiveIcon = active.icon;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(isOpen => !isOpen)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#e8e8e4] bg-white px-3 text-[12px] font-medium text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115]"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <ActiveIcon size={13} strokeWidth={2} />
        <span>Grupuj: {active.label}</span>
        <ChevronDown size={13} strokeWidth={2} className={`transition-transform duration-200 ease ${open ? 'rotate-180' : ''}`} />
      </button>

      <div className={`absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-[10px] border border-[#e8e8e4] bg-white p-1 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-all duration-200 ease ${open ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}>
        {GROUP_MODE_OPTIONS.map(option => {
          const Icon = option.icon;
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => { onChange(option.value); setOpen(false); }}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition-colors duration-200 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${
                selected
                  ? 'bg-[#f7f7f4] font-medium text-[#0f1115]'
                  : 'font-normal text-[#5a606b] hover:bg-[#f1f0ed] hover:text-[#0f1115]'
              }`}
            >
              <Icon size={13} strokeWidth={2} />
              <span>{option.label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
        />
      )}
    </div>
  );
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

function TaskRow({ task, project, onToggle, onClick, onEdit, isSelectionMode, isSelected, onSelect, closingPhase }: {
  task: Task;
  project?: Project;
  onToggle: () => void;
  onClick: () => void;
  onEdit?: (updates: Partial<Task>) => void;
  isSelectionMode?: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
  closingPhase?: 'fading' | 'collapsing';
}) {
  const p = PRIORITY[task.priority] ?? PRIORITY[TaskPriority.P4];
  const st = STATUS_META[task.status ?? 'NotStarted'] ?? STATUS_META.NotStarted;
  const dateLabel = task.dueDate ? getDateLabel(task.dueDate) : '';
  const overdue = task.dueDate
    ? new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)
    : false;
  const subtaskProgress = getSubtaskProgress(task);

  const [priorityOpen, setPriorityOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [priorityRect, setPriorityRect] = useState<DOMRect | null>(null);
  const [statusRect, setStatusRect] = useState<DOMRect | null>(null);
  const [dateRect, setDateRect] = useState<DOMRect | null>(null);

  const handleRowClick = () => {
    if (isSelectionMode) { onSelect?.(); return; }
    onClick();
  };
  const isClosing = !!closingPhase;

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
      className={`task-complete-collapse flex items-start sm:items-center cursor-pointer group select-none transition-opacity ${closingPhase === 'fading' ? 'is-fading' : ''} ${closingPhase === 'collapsing' ? 'is-completing' : ''}`}
      style={{
        padding: closingPhase === 'collapsing' ? '0' : '9px 0',
        borderBottom: `1px solid ${isClosing ? '#e8e8e4' : '#f1f0ed'}`,
        gap: 10,
        background: isClosing ? '#f1f0ed' : isSelected ? '#eef2ff' : 'transparent',
        opacity: isClosing ? 0 : isSelectionMode && !isSelected ? 0.45 : 1,
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
          className="flex-none flex items-center justify-center rounded-full border transition-all duration-200 ease hover:border-[#9098a4] hover:bg-[#f1f0ed] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] cursor-pointer"
          style={{
            width: 20,
            height: 20,
            borderColor: isClosing ? '#0f1115' : '#d4d4d0',
            background: isClosing ? '#0f1115' : 'transparent',
            flexShrink: 0,
          }}
        >
          {isClosing && (
            <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
              <path d="M5 13l4 4L19 7"/>
            </svg>
          )}
        </button>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:hidden">
        <span
          className={`min-w-0 text-[15px] font-medium leading-5 transition-colors duration-200 ease ${isClosing ? 'text-[#9098a4] line-through' : 'text-[#0f1115]'}`}
        >
          {task.content}
        </span>

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#9098a4]">
          <button
            onClick={handleDateClick}
            className={`inline-flex items-center gap-1.5 rounded-lg border-0 bg-transparent px-0 py-0.5 font-[inherit] transition-colors hover:text-[#5a606b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${overdue ? 'text-red-400' : ''} ${onEdit && !isSelectionMode ? 'cursor-pointer' : 'cursor-default'}`}
            style={{
              color: task.dueDate ? (overdue ? undefined : '#9098a4') : '#b0b5be',
            }}
            title={onEdit && !isSelectionMode ? 'Zmień termin' : undefined}
          >
            <CalIcon />
            <span>{task.dueDate ? dateLabel : 'Bez terminu'}</span>
          </button>

          {project && (
            <div className="flex min-w-0 items-center gap-1.5">
              <span
                className="flex-none rounded-full"
                style={{ width: 6, height: 6, background: project.color || '#9aa0aa' }}
              />
              <span className="truncate">{project.name}</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {subtaskProgress.total > 0 && (
            <span
              className="inline-flex flex-none items-center rounded-lg px-[7px] py-0.5 text-[10.5px] font-semibold"
              style={{ color: '#9098a4', background: '#f7f7f4' }}
            >
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          )}

          <button
            onClick={handlePriorityClick}
            className={`min-w-7 flex-none rounded-lg border-0 px-[7px] py-0.5 text-center text-[10.5px] font-semibold transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${onEdit && !isSelectionMode ? 'cursor-pointer' : 'cursor-default'}`}
            style={{
              color: p.fg,
              background: p.bg,
              letterSpacing: '0.03em',
            }}
            title={onEdit && !isSelectionMode ? 'Zmień priorytet' : undefined}
          >
            {p.label}
          </button>

          <button
            onClick={handleStatusClick}
            className={`inline-flex flex-none items-center gap-[4px] rounded-lg border-0 px-[7px] py-0.5 text-[10.5px] font-semibold transition-colors hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${onEdit && !isSelectionMode ? 'cursor-pointer' : 'cursor-default'}`}
            title={onEdit && !isSelectionMode ? 'Zmień status' : st.label}
            style={{
              color: st.fg,
              background: st.bg,
              letterSpacing: '0.02em',
            }}
          >
            <span className="flex-none rounded-full" style={{ width: 5, height: 5, background: st.dot }} />
            {st.label}
          </button>
        </div>
      </div>

      {/* Priority badge — clickable */}
      <button
        onClick={handlePriorityClick}
        className="hidden sm:block flex-none text-[10.5px] font-semibold rounded-[5px] transition-opacity"
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
        className="hidden sm:inline-flex flex-none items-center gap-[4px] text-[10.5px] font-semibold rounded-[5px]"
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
        className={`hidden sm:block flex-1 text-[14px] truncate min-w-0 transition-colors duration-200 ease ${isClosing ? 'text-[#9098a4] line-through' : 'text-[#0f1115]'}`}
        style={{ fontWeight: 450 }}
      >
        {task.content}
      </span>

      {/* Right meta — project + date */}
      <div className="hidden sm:flex items-center gap-5 flex-none" style={{ color: '#9098a4' }}>
        {subtaskProgress.total > 0 && (
          <span
            className="rounded-md text-[11px] font-semibold"
            style={{ minWidth: 34, padding: '2px 6px', color: '#9098a4', background: '#f7f7f4', textAlign: 'center' }}
            title="Wykonane podzadania"
          >
            {subtaskProgress.completed}/{subtaskProgress.total}
          </span>
        )}

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
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../../../shared/types').TaskStatus, description?: string) => void;
  isSelectionMode?: boolean;
  selectedIds?: string[];
  onSelect?: (id: string) => void;
  activeProjectId?: string | null;
}) {
  const [open, setOpen] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [addingOpen, setAddingOpen] = useState(false);
  const [closingTasks, setClosingTasks] = useState<Record<string, 'fading' | 'collapsing'>>({});

  const isOverdue = group.variant === 'overdue';
  const completeTaskWithAnimation = (taskId: string) => {
    if (closingTasks[taskId]) return;
    setClosingTasks(prev => ({ ...prev, [taskId]: 'fading' }));
    window.setTimeout(() => {
      setClosingTasks(prev => ({ ...prev, [taskId]: 'collapsing' }));
      onToggle(taskId);
    }, 120);
  };

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
              onToggle={() => completeTaskWithAnimation(task.id)}
              onClick={() => { if (!isSelectionMode) setEditingTask(task); }}
              onEdit={updates => onEdit(task.id, updates)}
              isSelectionMode={isSelectionMode}
              isSelected={selectedIds?.includes(task.id)}
              onSelect={() => onSelect?.(task.id)}
              closingPhase={closingTasks[task.id]}
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
          onSave={updates => onEdit(editingTask.id, updates)}
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
  const [bulkPicker, setBulkPicker] = useState<{ type: 'priority' | 'status' | 'date'; rect: DOMRect } | null>(null);
  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingCompleted, setEditingCompleted] = useState<Task | null>(null);
  const [groupMode, setGroupMode] = useState<GroupMode>('dueDate');

  const [filterSearch, setFilterSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterProjectId, setFilterProjectId] = useState('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter(t => {
      if (filterSearch.trim()) {
        const q = filterSearch.toLowerCase();
        if (!t.content.toLowerCase().includes(q) && !t.tags?.some(tag => tag.toLowerCase().includes(q))) return false;
      }
      if (filterStatus !== 'all') {
        const eff = t.isCompleted ? 'Completed' : (t.status ?? 'NotStarted');
        if (eff !== filterStatus) return false;
      }
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false;
      if (filterProjectId !== 'all') {
        if (filterProjectId === '__none__') { if (t.project_id != null) return false; }
        else { if (t.project_id !== filterProjectId) return false; }
      }
      return true;
    });
  }, [tasks, filterSearch, filterStatus, filterPriority, filterProjectId]);

  const hasActiveFilter = filterSearch || filterStatus !== 'all' || filterPriority !== 'all' || filterProjectId !== 'all';
  const clearFilters = () => { setFilterSearch(''); setFilterStatus('all'); setFilterPriority('all'); setFilterProjectId('all'); };

  const openBulkPicker = (type: 'priority' | 'status' | 'date', e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setBulkPicker(prev => prev?.type === type ? null : { type, rect });
  };
  const closeBulkPicker = () => setBulkPicker(null);

  const activeTasks = filteredTasks.filter(t => !t.isCompleted);

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

          {/* Status */}
          <button
            onClick={e => openBulkPicker('status', e)}
            className="col-span-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold text-gray-600"
            style={{ background: bulkPicker?.type === 'status' ? '#f1f0ed' : undefined }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" strokeWidth="1.8"/><path d="M12 7v5l3 3" strokeLinecap="round" strokeWidth="1.8"/></svg>
            <span>Status</span>
          </button>

          {/* Priorytet */}
          <button
            onClick={e => openBulkPicker('priority', e)}
            className="col-span-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold text-gray-600"
            style={{ background: bulkPicker?.type === 'priority' ? '#f1f0ed' : undefined }}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd"/></svg>
            <span>Priorytet</span>
          </button>

          {/* Termin */}
          <button
            onClick={e => openBulkPicker('date', e)}
            className="col-span-1 flex items-center justify-center gap-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-100/80 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold text-gray-600"
            style={{ background: bulkPicker?.type === 'date' ? '#f1f0ed' : undefined }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
            <span>Termin</span>
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

          <div className="hidden lg:block h-5 w-px bg-gray-200"></div>
          <button onClick={exitSelection} className="hidden lg:flex p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100/80 rounded-full transition-colors items-center justify-center">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      </div>,
      document.body
    )
    : null;

  const bulkPickerPortal = bulkPicker && typeof document !== 'undefined' ? createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={closeBulkPicker} />
      <div
        className="animate-calendar-reveal"
        style={{
          position: 'fixed',
          bottom: window.innerHeight - bulkPicker.rect.top + 8,
          left: bulkPicker.type === 'date'
            ? Math.max(8, bulkPicker.rect.right - 240)
            : Math.max(8, bulkPicker.rect.left),
          zIndex: 9999,
          ...(bulkPicker.type === 'date' ? { width: 240 } : { minWidth: bulkPicker.type === 'status' ? 190 : 158 }),
          background: bulkPicker.type === 'date' ? undefined : '#fff',
          border: bulkPicker.type === 'date' ? undefined : '1px solid #e8e8e4',
          borderRadius: bulkPicker.type === 'date' ? 16 : 10,
          boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
          padding: bulkPicker.type === 'date' ? 0 : 4,
          overflow: bulkPicker.type === 'date' ? 'hidden' : undefined,
        }}
        onClick={e => e.stopPropagation()}
      >
        {bulkPicker.type === 'status' && (Object.keys(STATUS_META) as TaskStatus[]).map(s => {
          const sm = STATUS_META[s];
          return (
            <button
              key={s}
              onClick={e => { e.stopPropagation(); onBulkEdit?.(selectedIds, { status: s }); closeBulkPicker(); exitSelection(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '5px 8px', borderRadius: 7,
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f7f7f4'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span className="inline-flex items-center gap-[4px] text-[10.5px] font-semibold rounded-[5px] flex-none"
                style={{ padding: '2px 7px', color: sm.fg, background: sm.bg, letterSpacing: '0.02em' }}>
                <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: sm.dot }} />
                {sm.label}
              </span>
            </button>
          );
        })}

        {bulkPicker.type === 'priority' && ([TaskPriority.P1, TaskPriority.P2, TaskPriority.P3, TaskPriority.P4] as TaskPriority[]).map(priority => {
          const pr = PRIORITY[priority];
          return (
            <button
              key={priority}
              onClick={e => { e.stopPropagation(); onBulkEdit?.(selectedIds, { priority }); closeBulkPicker(); exitSelection(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                width: '100%', padding: '5px 8px', borderRadius: 7,
                background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f7f7f4'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{
                padding: '2px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 600,
                color: pr.fg, background: pr.bg, letterSpacing: '0.03em', minWidth: 26, textAlign: 'center',
              }}>{pr.label}</span>
              <span style={{ fontSize: 13, color: '#3a3f47' }}>{pr.name}</span>
            </button>
          );
        })}

        {bulkPicker.type === 'date' && (
          <CalendarDatePicker
            value=""
            onChange={date => { if (date) { onBulkEdit?.(selectedIds, { dueDate: date }); } closeBulkPicker(); exitSelection(); }}
            onClose={closeBulkPicker}
          />
        )}
      </div>
    </>,
    document.body
  ) : null;

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

  const groups = groupTasks(filteredTasks, groupMode);
  const completedTasks = filteredTasks.filter(t => t.isCompleted);

  if (groups.length === 0 && completedTasks.length === 0 && !hasActiveFilter) {
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
      {bulkPickerPortal}

      {/* Top-level add button + Wybierz wiele */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <button
          className="flex items-center gap-2 text-[13px] font-medium transition-colors rounded-lg px-3 py-1.5"
          style={{ color: '#9098a4', background: '#f5f4f1' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0f1115'; (e.currentTarget as HTMLElement).style.background = '#eceae6'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; (e.currentTarget as HTMLElement).style.background = '#f5f4f1'; }}
          onClick={() => setAddModalOpen(true)}
        >
          <PlusIcon /> Nowe zadanie
        </button>

        <div className="ml-auto flex items-center gap-2">
          <GroupModeSelect value={groupMode} onChange={setGroupMode} />

          {activeTasks.length > 0 && (
            <button
              onClick={() => { setIsSelectionMode(m => !m); setSelectedIds([]); }}
              className={`h-9 rounded-lg px-3 text-[12px] font-semibold transition-colors duration-200 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${
                isSelectionMode
                  ? 'bg-[#0f1115] text-white'
                  : 'bg-[#f5f4f1] text-[#9098a4] hover:bg-[#f1f0ed] hover:text-[#3a3f47]'
              }`}
            >
              {isSelectionMode ? 'Gotowe' : 'Wybierz'}
            </button>
          )}
        </div>
      </div>

      {addModalOpen && (
        <TaskAddModal
          projects={projects}
          initialProjectId={activeProjectId ?? undefined}
          onAdd={(content, priority, dueDate, projectId, status, description) => { onAdd(content, priority, dueDate, projectId, status, description); setAddModalOpen(false); }}
          onClose={() => setAddModalOpen(false)}
        />
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-2 flex-wrap mb-4">
        <div
          className="flex items-center gap-2 transition-all"
          style={{
            padding: '5px 10px',
            background: '#fff',
            border: `1px solid ${filterSearch ? '#9098a4' : '#ececec'}`,
            borderRadius: 7,
            flex: 1,
            minWidth: 160,
            maxWidth: 280,
          }}
        >
          <span style={{ color: '#9098a4', flexShrink: 0 }}><SearchIcon /></span>
          <input
            type="text"
            placeholder="Szukaj…"
            value={filterSearch}
            onChange={e => setFilterSearch(e.target.value)}
            className="bg-transparent outline-none w-full"
            style={{ fontSize: 12.5, color: '#0f1115', caretColor: '#0f1115' }}
          />
          {filterSearch && (
            <button onClick={() => setFilterSearch('')} style={{ color: '#9098a4', lineHeight: 1, flexShrink: 0 }}>
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
            </button>
          )}
        </div>

        <FilterSelect
          label="Status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: 'all', label: 'Wszystkie statusy' },
            { value: 'NotStarted', label: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
            { value: 'InProgress',  label: 'W trakcie',     fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
            { value: 'Completed',   label: 'Ukończone',     fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
          ]}
        />

        <FilterSelect
          label="Priorytet"
          value={filterPriority}
          onChange={setFilterPriority}
          options={[
            { value: 'all', label: 'Wszystkie priorytety' },
            { value: 'P1', label: 'P1 — Pilne',   fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
            { value: 'P2', label: 'P2 — Wysokie', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
            { value: 'P3', label: 'P3 — Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
            { value: 'P4', label: 'P4 — Niskie',  fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
          ]}
        />

        {!activeProjectId && projects.length > 0 && (
          <FilterSelect
            label="Projekt"
            value={filterProjectId}
            onChange={setFilterProjectId}
            options={[
              { value: 'all', label: 'Wszystkie projekty' },
              ...projects.map(p => ({ value: p.id, label: p.name, dot: p.color || '#9aa0aa' })),
              { value: '__none__', label: 'Bez projektu' },
            ]}
          />
        )}

        {hasActiveFilter && (
          <button
            onClick={clearFilters}
            style={{ fontSize: 12, color: '#9098a4', padding: '5px 8px', borderRadius: 7, background: 'none', border: 'none', cursor: 'pointer' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#3a3f47')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9098a4')}
          >
            Wyczyść
          </button>
        )}
      </div>

      {groups.length === 0 && completedTasks.length === 0 && hasActiveFilter && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <p className="text-[14px] text-[#9098a4]">Brak zadań pasujących do filtrów.</p>
          <button
            onClick={clearFilters}
            className="text-[13px] font-medium transition-colors rounded-lg px-3 py-1.5"
            style={{ color: '#9098a4', background: '#f5f4f1' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#0f1115'; (e.currentTarget as HTMLElement).style.background = '#eceae6'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; (e.currentTarget as HTMLElement).style.background = '#f5f4f1'; }}
          >
            Wyczyść filtry
          </button>
        </div>
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
                  className="flex items-start sm:items-center cursor-pointer"
                  style={{ padding: '9px 0', borderBottom: '1px solid #f1f0ed', gap: 10, opacity: 0.6 }}
                  onClick={() => setEditingCompleted(task)}
                  onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  {/* Checked circle */}
                  <button
                    onClick={e => { e.stopPropagation(); onToggle(task.id); }}
                    className="flex-none flex items-center justify-center rounded-full border-2 transition-colors hover:opacity-70 cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115]"
                    style={{ width: 20, height: 20, borderColor: '#0f1115', background: '#0f1115', flexShrink: 0 }}
                  >
                    <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                      <path d="M5 13l4 4L19 7"/>
                    </svg>
                  </button>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5 sm:hidden">
                    <span
                      className="min-w-0 text-[15px] font-medium leading-5 text-[#9098a4] line-through"
                    >
                      {task.content}
                    </span>

                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-[#b0b5be]">
                      <div className="inline-flex items-center gap-1.5">
                        <CalIcon />
                        <span>{task.dueDate ? getDateLabel(task.dueDate) : 'Bez terminu'}</span>
                      </div>
                      {projects.find(p => p.id === task.project_id) && (
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span
                            className="flex-none rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: projects.find(p => p.id === task.project_id)?.color || '#9aa0aa',
                            }}
                          />
                          <span className="truncate">{projects.find(p => p.id === task.project_id)?.name}</span>
                        </div>
                      )}
                    </div>

                    <span
                      className="min-w-7 w-fit flex-none rounded-lg px-[7px] py-0.5 text-center text-[10.5px] font-semibold"
                      style={{
                        color: '#b0b5be',
                        background: '#f1f0ed',
                        letterSpacing: '0.03em',
                      }}
                    >
                      {(PRIORITY[task.priority] ?? PRIORITY[TaskPriority.P4]).label}
                    </span>
                  </div>

                  {/* Priority badge — dimmed */}
                  <span
                    className="hidden sm:block flex-none text-[10.5px] font-semibold rounded-[5px]"
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
                    className="hidden sm:block flex-1 text-[14px] text-[#9098a4] truncate min-w-0"
                    style={{ fontWeight: 450, textDecoration: 'line-through' }}
                  >
                    {task.content}
                  </span>

                  {/* Date placeholder to keep alignment */}
                  <div className="hidden sm:flex items-center gap-5 flex-none" style={{ color: '#d4d4d0' }}>
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
              onSave={updates => onEdit(editingCompleted.id, updates)}
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
