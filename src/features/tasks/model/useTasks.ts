import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createTask, deleteTask, getTasks, updateTask } from '../api/tasksApi';
import type { Subtask, Task, TaskPriority, TaskStatus } from '../../../shared/types';
import { getToken } from '../../../shared/api/client';
import { mapApiTask, toCreateTaskDto, toUpdateTaskDto } from '../model/taskModel';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function useTasks(isLoggedIn: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const connectionRef = useRef<signalR.HubConnection | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchTasks = useCallback(async () => {
    if (!hasLoadedRef.current) setIsLoading(true);
    try {
      const all = await getTasks();
      setTasks(all.map(mapApiTask));
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
    } finally {
      hasLoadedRef.current = true;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      hasLoadedRef.current = false;
      void Promise.resolve().then(() => {
        setTasks([]);
        setIsLoading(false);
      });
      return;
    }

    void Promise.resolve().then(fetchTasks);

    const token = getToken();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/tasks${token ? `?access_token=${token}` : ''}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('TaskCreated', (task) => {
      setTasks((prev) => [...prev, mapApiTask(task)]);
    });

    connection.on('TaskUpdated', (task) => {
      const mapped = mapApiTask(task);
      setTasks((prev) => prev.map((t) => (t.id === mapped.id ? mapped : t)));
    });

    connection.on('TaskDeleted', (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    });

    connection.start().catch((err) => {
      console.warn('SignalR connection failed:', err);
    });

    connectionRef.current = connection;

    return () => {
      connection.stop();
      connectionRef.current = null;
    };
  }, [fetchTasks, isLoggedIn]);

  const addTask = useCallback(async (
    content: string,
    projectId?: string,
    status?: TaskStatus,
    description?: string,
    priority?: TaskPriority,
    dueDate?: string,
    tags?: string[],
    subtasks?: Subtask[],
    estimatedHours?: number,
    dueTime?: string,
  ) => {
    const created = await createTask(toCreateTaskDto({ content, projectId, status, description, priority, dueDate, dueTime, tags, subtasks, estimatedHours }));
    return mapApiTask(created);
  }, []);

  const editTask = useCallback(async (id: string, updates: Partial<Task>) => {
    const dto = toUpdateTaskDto(updates);
    if (Object.keys(dto).length === 0) return;

    const updated = await updateTask(id, dto);
    const mappedUpdated = mapApiTask(updated);
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...mappedUpdated } : t));
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, isLoading, addTask, editTask, removeTask, refreshTasks: fetchTasks };
}
