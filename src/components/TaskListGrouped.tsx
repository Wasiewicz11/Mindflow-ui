import { useState } from 'react';
import type { Task, Project } from '../types';
import { TaskEditModal } from './TaskEditModal';

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
  onAdd: (content: string, priority: 'p1' | 'p2' | 'p3' | 'p4', dueDate?: string, projectId?: string) => void;
  onClearCompleted?: () => void;
  isLoading?: boolean;
  activeProjectId?: string | null;
}

const PRIORITY: Record<string, { label: string; fg: string; bg: string }> = {
  p1: { label: 'P1', fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  p2: { label: 'P2', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  p3: { label: 'P3', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  p4: { label: 'P4', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const PRIORITY_ORDER: Record<string, number> = { p1: 0, p2: 1, p3: 2, p4: 3 };

interface Group {
  key: string;
  label: string;
  sublabel?: string;
  tasks: Task[];
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
    { key: 'today',    label: 'Dzisiaj',       sublabel: 'Zaplanowane na dziś', tasks: [] },
    { key: 'tomorrow', label: 'Jutro',          tasks: [] },
    { key: 'week',     label: 'W tym tygodniu', tasks: [] },
    { key: 'later',    label: 'Później',        tasks: [] },
    { key: 'none',     label: 'Bez terminu',    tasks: [] },
  ];

  const open = tasks.filter(t => !t.isCompleted);

  open.forEach(t => {
    if (!t.dueDate) { buckets[4].tasks.push(t); return; }
    const d = parseLocalDate(t.dueDate);
    if (d <= today)                               buckets[0].tasks.push(t);
    else if (d.getTime() === tomorrow.getTime())  buckets[1].tasks.push(t);
    else if (d < endOfWeek)                       buckets[2].tasks.push(t);
    else                                          buckets[3].tasks.push(t);
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

function TaskRow({ task, project, onToggle, onClick }: {
  task: Task;
  project?: Project;
  onToggle: () => void;
  onClick: () => void;
}) {
  const p = PRIORITY[task.priority] ?? PRIORITY.p4;
  const st = STATUS_META[task.status ?? 'NotStarted'] ?? STATUS_META.NotStarted;
  const dateLabel = task.dueDate ? getDateLabel(task.dueDate) : '';
  const overdue = task.dueDate
    ? new Date(task.dueDate).setHours(0,0,0,0) < new Date().setHours(0,0,0,0)
    : false;

  return (
    <div
      onClick={onClick}
      className="flex items-center cursor-pointer group"
      style={{ padding: '9px 0', borderBottom: '1px solid #f1f0ed', gap: 10 }}
      onMouseEnter={e => (e.currentTarget.style.background = '#faf9f7')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      {/* Checkbox */}
      <button
        onClick={e => { e.stopPropagation(); onToggle(); }}
        className="flex-none rounded-full border transition-colors hover:border-[#9098a4]"
        style={{ width: 20, height: 20, borderColor: '#d4d4d0', background: 'transparent', flexShrink: 0 }}
      />

      {/* Priority badge */}
      <span
        className="flex-none text-[10.5px] font-semibold rounded-[5px]"
        style={{
          padding: '2px 6px',
          color: p.fg,
          background: p.bg,
          letterSpacing: '0.03em',
          minWidth: 26,
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        {p.label}
      </span>

      {/* Status badge */}
      <span
        className="flex-none inline-flex items-center gap-[4px] text-[10.5px] font-semibold rounded-[5px]"
        title={st.label}
        style={{ padding: '2px 7px', color: st.fg, background: st.bg, letterSpacing: '0.02em', flexShrink: 0 }}
      >
        <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: st.dot }} />
        {st.label}
      </span>

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

        <div
          className={`flex items-center gap-1.5 text-[13px] ${overdue ? 'text-red-400' : ''}`}
          style={{ minWidth: 76, color: task.dueDate ? undefined : '#d4d4d0' }}
        >
          <CalIcon />
          <span>{task.dueDate ? dateLabel : '—'}</span>
        </div>
      </div>
    </div>
  );
}

function GroupBlock({ group, projects, onToggle, onEdit, onDelete, onAdd }: {
  group: Group;
  projects: Project[];
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string, priority: 'p1'|'p2'|'p3'|'p4', dueDate?: string, projectId?: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  return (
    <div className="mb-8">
      {/* Group header */}
      <div
        className="flex items-center gap-2 cursor-pointer select-none mb-1"
        onClick={() => setOpen(o => !o)}
        style={{ padding: '4px 0 6px' }}
      >
        <span className="text-[#9098a4] flex-none"><ChevronIcon open={open} /></span>
        <span className="text-[15px] font-semibold text-[#0f1115]">{group.label}</span>
        <span className="text-[13px] text-[#9098a4]">{group.tasks.length}</span>
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
              onClick={() => setEditingTask(task)}
            />
          ))}

          <button
            className="flex items-center gap-2 text-[13px] transition-colors mt-1 py-2"
            style={{ color: '#c0c5cc' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = '#9098a4'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = '#c0c5cc'; }}
            onClick={() => {
              const content = prompt('Dodaj zadanie:');
              if (content?.trim()) onAdd(content.trim(), 'p4');
            }}
          >
            <PlusIcon /> Dodaj zadanie
          </button>
        </>
      )}

      {/* Edit modal */}
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
    </div>
  );
}


export function TaskListGrouped({ tasks, projects, onToggle, onEdit, onDelete, onAdd, onClearCompleted, isLoading }: Props) {
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

  const [completedOpen, setCompletedOpen] = useState(false);
  const [editingCompleted, setEditingCompleted] = useState<Task | null>(null);

  const groups = groupTasks(tasks);
  const completedTasks = tasks.filter(t => t.isCompleted);

  if (groups.length === 0 && completedTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <p className="text-[14px] text-[#9098a4]">Brak zadań. Dodaj pierwsze za pomocą panelu na dole!</p>
      </div>
    );
  }

  return (
    <div className="pt-2">
      {groups.map(group => (
        <GroupBlock
          key={group.key}
          group={group}
          projects={projects}
          onToggle={onToggle}
          onEdit={onEdit}
          onDelete={onDelete}
          onAdd={onAdd}
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
                    {(PRIORITY[task.priority] ?? PRIORITY.p4).label}
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
