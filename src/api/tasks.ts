import { apiFetch } from './client';
import { TaskPriority } from '../types';

export interface Task {
  id: string;
  content: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  projectId?: string;
}

export interface CreateTaskDto {
  content: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  projectId?: string;
}

export interface UpdateTaskDto {
  content?: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  projectId?: string;
}

export function getTasks(): Promise<Task[]> {
  return apiFetch<Task[]>('/tasks');
}

export function createTask(dto: CreateTaskDto): Promise<Task> {
  return apiFetch<Task>('/tasks', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateTask(id: string, dto: UpdateTaskDto): Promise<Task> {
  return apiFetch<Task>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}
