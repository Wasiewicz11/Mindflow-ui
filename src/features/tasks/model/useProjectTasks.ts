import { useCallback, useEffect, useState } from 'react';
import { getTasksForProject, createTask, updateTask, deleteTask } from '../api/tasksApi';
import type { Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { mapApiTask, toCreateTaskDto, toUpdateTaskDto } from '../model/taskModel';

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
    await createTask(toCreateTaskDto({ content, projectId, priority, dueDate, status, description }));
    await fetchTasks();
  }, [projectId, fetchTasks]);

  const editTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const withDerived = { ...updates };
    if (updates.status !== undefined) withDerived.isCompleted = updates.status === 'Completed';

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...withDerived } : t));

    const dto = toUpdateTaskDto(updates);
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
