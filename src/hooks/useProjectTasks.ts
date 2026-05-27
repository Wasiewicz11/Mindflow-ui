import { useCallback, useEffect, useState } from 'react';
import { getTasksForProject, createTask, updateTask, deleteTask } from '../api/tasks';
import type { UpdateTaskDto } from '../api/tasks';
import type { Task, TaskPriority, TaskStatus } from '../types';

function mapApiTask(t: Awaited<ReturnType<typeof getTasksForProject>>[number]): Task {
  const status = (t.status as TaskStatus) ?? 'NotStarted';
  return {
    id: t.id,
    content: t.content,
    status,
    isCompleted: status === 'Completed',
    priority: (t.priority as TaskPriority) ?? 'P4',
    dueDate: t.dueDate,
    createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
    project_id: t.projectId ?? null,
    description: t.description,
  };
}

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTasks = useCallback(async () => {
    setIsLoading(true);
    try {
      const apiTasks = await getTasksForProject(projectId);
      setTasks(apiTasks.map(mapApiTask));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const addTask = useCallback(async (
    content: string,
    priority: TaskPriority,
    dueDate?: string,
    status?: TaskStatus,
    description?: string,
  ) => {
    await createTask({ content, projectId, priority, dueDate, status, description });
    await fetchTasks();
  }, [projectId, fetchTasks]);

  const editTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const withDerived = { ...updates };
    if (updates.status !== undefined) withDerived.isCompleted = updates.status === 'Completed';

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...withDerived } : t));

    const dto: UpdateTaskDto = {};
    if (updates.content     !== undefined) dto.content     = updates.content;
    if (updates.priority    !== undefined) dto.priority    = updates.priority;
    if (updates.status      !== undefined) dto.status      = updates.status;
    if (updates.dueDate     !== undefined) dto.dueDate     = updates.dueDate;
    if (updates.project_id  !== undefined) dto.projectId   = updates.project_id ?? undefined;
    if (updates.description !== undefined) dto.description = updates.description;

    if (Object.keys(dto).length > 0) await updateTask(id, dto);
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const toggleTask = useCallback(async (id: string) => {
    setTasks(prev => prev.map(t => {
      if (t.id !== id) return t;
      const newStatus: TaskStatus = t.status === 'Completed' ? 'NotStarted' : 'Completed';
      return { ...t, status: newStatus, isCompleted: newStatus === 'Completed' };
    }));
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus: TaskStatus = task.status === 'Completed' ? 'NotStarted' : 'Completed';
    await updateTask(id, { status: newStatus });
  }, [tasks]);

  return { tasks, isLoading, addTask, editTask, removeTask, toggleTask };
}
