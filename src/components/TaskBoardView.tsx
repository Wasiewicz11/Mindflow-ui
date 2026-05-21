import type { Task, Project } from '../types';

interface Props {
  tasks: Task[];
  projects: Project[];
  onEdit: (id: string, updates: Partial<Task>) => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}

const PRIORITY_CONFIG = {
  p1: { label: 'P1', color: 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400' },
  p2: { label: 'P2', color: 'bg-orange-50 text-orange-500 dark:bg-orange-900/20 dark:text-orange-400' },
  p3: { label: 'P3', color: 'bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400' },
  p4: { label: 'P4', color: 'bg-gray-100 text-gray-400 dark:bg-white/5 dark:text-gray-500' },
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.floor((date.getTime() - today.getTime()) / 86400000);

  if (diff < 0) return `${Math.abs(diff)}d temu`;
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
}

function isOverdue(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
}

interface TaskCardProps {
  task: Task;
  onToggle: () => void;
}

function TaskCard({ task, onToggle }: TaskCardProps) {
  const priority = PRIORITY_CONFIG[task.priority] ?? PRIORITY_CONFIG.p4;
  const overdue = task.dueDate ? isOverdue(task.dueDate) : false;

  return (
    <div className="group bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 rounded-xl p-3.5 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-sm transition-all duration-200 cursor-default">
      {/* Top row: priority + date */}
      <div className="flex items-center justify-between mb-2.5">
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${priority.color}`}>
          {priority.label}
        </span>
        {task.dueDate && (
          <span className={`text-[10px] font-medium ${overdue ? 'text-red-500 dark:text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>
            {formatDate(task.dueDate)}
          </span>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-gray-700 dark:text-gray-200 leading-snug line-clamp-2">
        {task.content}
      </p>

      {/* Complete button */}
      <button
        onClick={onToggle}
        className="mt-3 flex items-center gap-1.5 text-[10px] font-medium text-gray-300 dark:text-gray-600 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
        </svg>
        Ukończ
      </button>
    </div>
  );
}

interface ColumnProps {
  title: string;
  color?: string;
  tasks: Task[];
  onToggle: (id: string) => void;
}

function Column({ title, color, tasks }: ColumnProps) {
  const open = tasks.filter(t => !t.isCompleted);

  return (
    <div className="flex-none w-[260px] flex flex-col">
      {/* Column header */}
      <div className="flex items-center gap-2 mb-3 px-0.5">
        <span
          className="w-2 h-2 rounded-full flex-none"
          style={{ backgroundColor: color ?? '#9CA3AF' }}
        />
        <h3 className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate tracking-wide uppercase">
          {title}
        </h3>
        <span className="ml-auto text-[10px] font-medium text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-white/5 px-1.5 py-0.5 rounded-md">
          {open.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {open.length === 0 ? (
          <div className="h-20 border border-dashed border-gray-100 dark:border-white/5 rounded-xl flex items-center justify-center">
            <p className="text-[11px] text-gray-300 dark:text-gray-600">Brak zadań</p>
          </div>
        ) : (
          open.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onToggle={() => {}}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function TaskBoardView({ tasks, projects, onToggle }: Props) {
  const openTasks = tasks.filter(t => !t.isCompleted);

  const columns: { id: string | null; name: string; color?: string }[] = [
    ...projects.map(p => ({ id: p.id, name: p.name, color: p.color })),
    { id: null, name: 'Bez projektu', color: '#9CA3AF' },
  ];

  const columnsWithTasks = columns.filter(col => {
    const count = openTasks.filter(t =>
      col.id === null ? !t.project_id : t.project_id === col.id
    ).length;
    return count > 0 || col.id !== null;
  });

  if (openTasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
          <svg className="w-7 h-7 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
          </svg>
        </div>
        <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Brak otwartych zadań</p>
      </div>
    );
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1 animate-fade-in min-h-[400px]" style={{ scrollbarWidth: 'thin' }}>
      {columnsWithTasks.map(col => (
        <Column
          key={col.id ?? '__none__'}
          title={col.name}
          color={col.color}
          tasks={openTasks.filter(t => col.id === null ? !t.project_id : t.project_id === col.id)}
          onToggle={onToggle}
        />
      ))}
    </div>
  );
}
