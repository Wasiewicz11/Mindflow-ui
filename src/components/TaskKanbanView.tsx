import { useState } from 'react';
import type { Task } from '../types';

const STATUSES = [
  {
    key: 'NotStarted' as const,
    label: 'Nie rozpoczęto',
    accent: 'oklch(0.75 0.01 260)',
    dot: 'oklch(0.75 0.01 260)',
    fg: 'oklch(0.55 0.01 260)',
    bg: 'oklch(0.96 0.005 260)',
  },
  {
    key: 'InProgress' as const,
    label: 'W trakcie',
    accent: 'oklch(0.60 0.18 230)',
    dot: 'oklch(0.60 0.18 230)',
    fg: 'oklch(0.55 0.15 230)',
    bg: 'oklch(0.96 0.03 230)',
  },
  {
    key: 'Completed' as const,
    label: 'Ukończone',
    accent: 'oklch(0.55 0.18 145)',
    dot: 'oklch(0.55 0.18 145)',
    fg: 'oklch(0.50 0.15 145)',
    bg: 'oklch(0.96 0.03 145)',
  },
];

const PRIORITY: Record<string, { label: string; fg: string; bg: string }> = {
  p1: { label: 'P1', fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  p2: { label: 'P2', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  p3: { label: 'P3', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  p4: { label: 'P4', fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

function formatDue(dateStr: string): string {
  const d = new Date(dateStr);
  d.setHours(0, 0, 0, 0);
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

interface CardProps {
  task: Task;
  onDragStart: (id: string) => void;
}

function Card({ task, onDragStart }: CardProps) {
  const p = PRIORITY[task.priority] ?? PRIORITY.p4;
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <article
      draggable
      onDragStart={() => onDragStart(task.id)}
      className="bg-white border rounded-xl transition-all duration-150 cursor-grab active:cursor-grabbing select-none"
      style={{
        borderColor: '#ececec',
        padding: '12px 13px 11px',
        boxShadow: '0 1px 0 rgba(15,17,21,.02)',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget;
        el.style.borderColor = '#dcdcd6';
        el.style.boxShadow = '0 4px 14px -8px rgba(15,17,21,.18), 0 1px 0 rgba(15,17,21,.02)';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget;
        el.style.borderColor = '#ececec';
        el.style.boxShadow = '0 1px 0 rgba(15,17,21,.02)';
      }}
    >
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span
          className="inline-flex items-center gap-[5px] text-[10.5px] font-semibold rounded-md"
          style={{ padding: '3px 7px 3px 6px', letterSpacing: '0.04em', color: p.fg, background: p.bg }}
        >
          <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: p.fg }} />
          {p.label}
        </span>
      </div>

      <p className="text-[14px] font-medium leading-[1.4] text-[#0f1115]">{task.content}</p>

      {task.dueDate && (
        <div className={`flex items-center gap-1.5 mt-2 text-[11.5px] ${overdue ? 'text-red-500' : 'text-[#9098a4]'}`}>
          <CalIcon />
          {formatDue(task.dueDate)}
        </div>
      )}
    </article>
  );
}

interface Props {
  tasks: Task[];
  onEdit: (id: string, updates: Partial<Task>) => void;
}

export function TaskKanbanView({ tasks, onEdit }: Props) {
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  function handleDragStart(id: string) {
    setDraggingId(id);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    setDragOverStatus(status);
  }

  function handleDrop(e: React.DragEvent, status: 'NotStarted' | 'InProgress' | 'Completed') {
    e.preventDefault();
    if (draggingId) {
      const task = tasks.find(t => t.id === draggingId);
      if (task && task.status !== status) {
        onEdit(draggingId, { status });
      }
    }
    setDragOverStatus(null);
    setDraggingId(null);
  }

  function handleDragEnd() {
    setDragOverStatus(null);
    setDraggingId(null);
  }

  return (
    <div
      className="flex h-full min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar"
      style={{ paddingBottom: 220 }}
    >
      <div className="flex h-full min-w-min">
        {STATUSES.map((col, i) => {
          const colTasks = tasks.filter(t => (t.status ?? 'NotStarted') === col.key);
          const isOver = dragOverStatus === col.key;

          return (
            <section
              key={col.key}
              className="group flex-none flex flex-col h-full min-h-0 relative"
              style={{
                width: 288,
                padding: '0 18px',
                borderLeft: i === 0 ? 'none' : '1px solid #ececec',
              }}
              onDragOver={e => handleDragOver(e, col.key)}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* color accent bar */}
              <span
                className="absolute rounded-sm transition-all duration-150"
                style={{ top: 14, left: 18, right: 18, height: 2, background: col.accent, opacity: isOver ? 1 : 0.6 }}
              />

              {/* header */}
              <div className="flex items-center justify-between" style={{ padding: '22px 0 8px' }}>
                <div className="flex items-center gap-2">
                  <span
                    className="inline-flex items-center gap-[5px] text-[11px] font-semibold rounded-md"
                    style={{ padding: '3px 8px 3px 7px', letterSpacing: '0.03em', color: col.fg, background: col.bg }}
                  >
                    <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: col.dot }} />
                    {col.label}
                  </span>
                  <span className="text-[11px] text-[#9098a4]">{colTasks.length}</span>
                </div>
              </div>

              {/* drop zone + cards */}
              <div
                className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pb-3 custom-scrollbar rounded-xl transition-all duration-150"
                style={{
                  background: isOver ? 'oklch(0.97 0.005 230)' : 'transparent',
                  outline: isOver ? '2px dashed oklch(0.75 0.08 230)' : '2px dashed transparent',
                  padding: isOver ? '8px' : '0',
                }}
              >
                {colTasks.length === 0 && !isOver && (
                  <div
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
                    onDragStart={handleDragStart}
                  />
                ))}

                <button
                  className="flex items-center gap-2 text-[13px] text-[#9098a4] rounded-xl border border-dashed border-transparent hover:border-[#e3e3df] transition-colors text-left mt-auto"
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
  );
}
