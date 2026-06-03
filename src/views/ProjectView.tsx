import { useState } from 'react';
import { useProjectTasks } from '../features/tasks';
import { TaskListGrouped, TaskKanbanView, TaskWeekView, QuickAddTask } from '../features/tasks/ui';
import type { Project, Task, TaskPriority, TaskStatus } from '../shared/types';

type ViewMode = 'list' | 'week' | 'board';

interface Props {
  projectId: string;
  project: Project;
  projects: Project[];
}

export function ProjectView({ projectId, project, projects }: Props) {
  const { tasks, isLoading, addTask, editTask, removeTask, toggleTask } = useProjectTasks(projectId);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const sortedTasks = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const handleAdd = async (
    content: string,
    priority: TaskPriority,
    dueDate?: string,
    _projectId?: string,
    status?: TaskStatus,
    description?: string,
  ) => {
    await addTask(content, priority, dueDate, status, description);
  };

  const handleBulkEdit = (ids: string[], updates: Partial<Task>) => {
    ids.forEach(id => editTask(id, updates));
  };

  const handleClearCompleted = () => {
    const completed = tasks.filter(t => t.isCompleted);
    if (completed.length === 0) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć ${completed.length} wykonanych zadań?`)) return;
    completed.forEach(t => removeTask(t.id));
  };

  return (
    <div className="flex flex-col h-full">
      <header className="flex-none px-6 pt-8 pb-4 lg:py-8 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
            {project.name}
          </h1>
          <p className="text-gray-400 dark:text-gray-500 mt-1 lg:mt-2 font-medium text-sm lg:text-base">
            Zarządzaj swoimi zadaniami efektywnie.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="mf-segmented">
            {(['list', 'week', 'board'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`mf-segmented-option ${viewMode === mode ? 'is-active' : ''}`}
              >
                {{ list: 'Lista', week: 'Tydzień', board: 'Tablica' }[mode]}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className={`flex-1 overflow-y-auto custom-scrollbar px-6 pb-36 lg:pb-24 ${viewMode === 'week' ? 'h-full -mx-6 px-6' : viewMode === 'board' ? 'h-full' : ''}`}>
        {viewMode === 'list' && (
          <div className="max-w-3xl mx-auto">
            <TaskListGrouped
              tasks={sortedTasks}
              projects={projects}
              onToggle={toggleTask}
              onEdit={editTask}
              onDelete={removeTask}
              onAdd={handleAdd}
              onBulkEdit={handleBulkEdit}
              onClearCompleted={handleClearCompleted}
              isLoading={isLoading}
              activeProjectId={projectId}
            />
          </div>
        )}

        {viewMode === 'week' && (
          <div className="h-[calc(100vh-200px)]">
            <TaskWeekView
              tasks={sortedTasks}
              projects={projects}
              onEdit={editTask}
              onToggle={toggleTask}
              onAdd={handleAdd}
              onDelete={removeTask}
            />
          </div>
        )}

        {viewMode === 'board' && (
          <TaskKanbanView
            tasks={sortedTasks}
            projects={projects}
            activeProjectId={projectId}
            onEdit={editTask}
            onToggle={toggleTask}
            onDelete={removeTask}
            onAdd={handleAdd}
          />
        )}
      </div>

      <QuickAddTask
        activeProjectId={projectId}
        projects={projects}
        onAdd={handleAdd}
      />
    </div>
  );
}
