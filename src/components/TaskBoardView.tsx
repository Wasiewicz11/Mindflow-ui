import type { Task, Project } from '../types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onEdit: (id: string, updates: Partial<Task>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

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
  if (diff < 0)  return `${Math.abs(diff)}d temu`;
  if (diff === 0) return 'Dzisiaj';
  if (diff === 1) return 'Jutro';
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
function MoreIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>;
}

function Card({ task }: { task: Task }) {
  const p = PRIORITY[task.priority] ?? PRIORITY.p4;
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <article
      className="bg-white border rounded-xl transition-all duration-150 cursor-pointer"
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
      {/* priority badge */}
      <div className="flex items-center gap-1.5 mb-2">
        <span
          className="inline-flex items-center gap-[5px] text-[10.5px] font-semibold rounded-md"
          style={{ padding: '3px 7px 3px 6px', letterSpacing: '0.04em', color: p.fg, background: p.bg }}
        >
          <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: p.fg }} />
          {p.label}
        </span>
      </div>

      {/* title */}
      <p className="text-[14px] font-medium leading-[1.4] text-[#0f1115]">{task.content}</p>

      {/* due date */}
      {task.dueDate && (
        <div className={`flex items-center gap-1.5 mt-2 text-[11.5px] ${overdue ? 'text-red-500' : 'text-[#9098a4]'}`}>
          <CalIcon />
          {formatDue(task.dueDate)}
        </div>
      )}
    </article>
  );
}

function Column({ project, tasks, isFirst }: { project: Project & { id: string }; tasks: Task[]; isFirst: boolean }) {
  const open = tasks.filter(t => !t.isCompleted);

  return (
    <section
      className="group flex-none flex flex-col h-full min-h-0 relative"
      style={{
        width: 288,
        padding: '0 18px',
        borderLeft: isFirst ? 'none' : '1px solid #ececec',
      }}
    >
      {/* color accent bar */}
      <span
        className="absolute rounded-sm"
        style={{ top: 14, left: 18, right: 18, height: 2, background: project.color || '#9aa0aa', opacity: 0.9 }}
      />

      {/* header */}
      <div className="flex items-center justify-between" style={{ padding: '22px 0 8px' }}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-[#0f1115] tracking-[-0.005em]">{project.name}</span>
          <span className="text-[11px] text-[#9098a4]">{open.length}</span>
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          <button
            className="flex items-center justify-center rounded-[5px] text-[#9098a4] transition-colors hover:bg-[#f1f1ef]"
            style={{ width: 22, height: 22 }}
            title="Dodaj zadanie"
          >
            <PlusIcon />
          </button>
          <button
            className="flex items-center justify-center rounded-[5px] text-[#9098a4] transition-colors hover:bg-[#f1f1ef]"
            style={{ width: 22, height: 22 }}
          >
            <MoreIcon />
          </button>
        </div>
      </div>

      {/* cards */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-2 pb-3 custom-scrollbar">
        {open.length === 0 && (
          <div
            className="text-center text-[13px] text-[#b8bcc4] rounded-xl py-8"
            style={{ border: '1.5px dashed #e3e3df' }}
          >
            Brak zadań
          </div>
        )}

        {open.map(task => <Card key={task.id} task={task} />)}

        <button
          className="flex items-center gap-2 text-[13px] text-[#9098a4] rounded-xl border border-dashed border-transparent hover:border-[#e3e3df] transition-colors text-left"
          style={{ padding: '9px 12px' }}
        >
          <PlusIcon /> Dodaj zadanie
        </button>
      </div>
    </section>
  );
}

export function TaskBoardView({ tasks, projects }: Props) {
  const openTasks = tasks.filter(t => !t.isCompleted);
  const noProjectTasks = openTasks.filter(t => !t.project_id);

  const columns = [
    ...projects.map(p => ({ ...p })),
    ...(noProjectTasks.length > 0 ? [{ id: '__none__', name: 'Bez projektu', color: '#9aa0aa', space_id: null }] : []),
  ];

  if (columns.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <p className="text-sm text-[#9098a4]">Brak projektów — dodaj projekt w sidebarze</p>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 overflow-x-auto overflow-y-hidden custom-scrollbar"
      style={{ paddingBottom: 220 }}
    >
      <div className="flex h-full min-w-min">
        {columns.map((col, i) => (
          <Column
            key={col.id}
            project={col as Project & { id: string }}
            tasks={tasks.filter(t => col.id === '__none__' ? !t.project_id : t.project_id === col.id)}
            isFirst={i === 0}
          />
        ))}
      </div>
    </div>
  );
}
