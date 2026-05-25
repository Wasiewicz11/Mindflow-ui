import * as signalR from '@microsoft/signalr';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createTask, deleteTask, getTasks, updateTask } from '../api/tasks';
import type { Task, UpdateTaskDto } from '../api/tasks';
import { getToken } from '../api/client';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

export function useTasks(isLoggedIn: boolean) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const connectionRef = useRef<signalR.HubConnection | null>(null);

  const fetchTasks = useCallback(async () => {
    const all = await getTasks();
    setTasks(all);
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    fetchTasks();

    const token = getToken();
    const connection = new signalR.HubConnectionBuilder()
      .withUrl(`${BASE_URL}/hubs/tasks${token ? `?access_token=${token}` : ''}`)
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    connection.on('TaskCreated', (task: Task) => {
      setTasks((prev) => [...prev, task]);
    });

    connection.on('TaskUpdated', (task: Task) => {
      setTasks((prev) => prev.map((t) => (t.id === task.id ? task : t)));
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

  const addTask = useCallback(async (content: string, projectId?: string, status?: string) => {
    await createTask({ content, projectId, status });
  }, []);

  const editTask = useCallback(async (id: string, dto: UpdateTaskDto) => {
    await updateTask(id, dto);
  }, []);

  const removeTask = useCallback(async (id: string) => {
    await deleteTask(id);
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { tasks, addTask, editTask, removeTask };
}
