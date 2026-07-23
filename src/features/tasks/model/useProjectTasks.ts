import { useCallback, useEffect, useRef, useState } from 'react';
import { getTasksForProject, createTask, updateTask, deleteTask } from '../api/tasksApi';
import {
  completeTask as completeTaskApi,
  createTaskTimeEntry,
  type CompleteTaskDto,
  type CreateTaskTimeEntryDto,
} from '../api/timeEntriesApi';
import type { Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { mapApiTask, toCreateTaskDto, toUpdateTaskDto } from '../model/taskModel';

export function useProjectTasks(projectId: string) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const hasLoadedRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const apiTasks = await getTasksForProject(projectId);
      setTasks(apiTasks.map(mapApiTask));
    } catch (error) {
      console.error('Failed to fetch project tasks:', error);
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    hasLoadedRef.current = false;
    void Promise.resolve().then(() => {
      setIsLoading(true);
      setTasks([]);
    });
  }, [projectId]);

  useEffect(() => {
    void Promise.resolve().then(fetchTasks);
  }, [fetchTasks]);

  const addTask = useCallback(async (
    content: string,
    priority: TaskPriority,
    dueDate?: string,
    status?: TaskStatus,
    description?: string,
    estimatedHours?: number,
    dueTime?: string,
  ) => {
    await createTask(toCreateTaskDto({ content, projectId, priority, dueDate, dueTime, status, description, estimatedHours }));
    await fetchTasks();
  }, [projectId, fetchTasks]);

  const editTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const withDerived = { ...updates };
    if (updates.status !== undefined) withDerived.isCompleted = updates.status === 'Completed';

    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...withDerived } : t));

    const dto = toUpdateTaskDto(updates);
    if (Object.keys(dto).length > 0) {
      const updated = await updateTask(id, dto);
      setTasks(prev => prev.map(t => t.id === id
        ? { ...mapApiTask(updated), loggedMinutes: updated.loggedMinutes ?? t.loggedMinutes ?? 0 }
        : t));
    }
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteTask(id);
    setTasks(prev => prev.filter(t => t.id !== id));
  }, []);

  const completeTask = useCallback(async (id: string, dto: CompleteTaskDto) => {
    const completed = await completeTaskApi(id, dto);
    const mappedTask = mapApiTask(completed.task);
    setTasks(prev => prev.map(t => t.id === id
      ? {
          ...mappedTask,
          loggedMinutes: completed.task.loggedMinutes ?? ((t.loggedMinutes ?? 0) + (completed.timeEntry?.durationMinutes ?? 0)),
        }
      : t));
    return mappedTask;
  }, []);

  const logTimeEntry = useCallback(async (id: string, dto: CreateTaskTimeEntryDto) => {
    const created = await createTaskTimeEntry(id, dto);
    const mappedTask = mapApiTask(created.task);
    setTasks(prev => prev.map(t => t.id === id
      ? {
          ...mappedTask,
          loggedMinutes: created.task.loggedMinutes ?? ((t.loggedMinutes ?? 0) + created.timeEntry.durationMinutes),
        }
      : t));
    return created.timeEntry;
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

  return { tasks, isLoading, addTask, editTask, completeTask, logTimeEntry, removeTask, toggleTask };
}
