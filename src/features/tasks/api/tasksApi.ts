import { apiFetch } from '../../../shared/api/client';
import { TaskPriority, type Subtask } from '../../../shared/types';
import type { ApiTask } from '../model/taskModel';

export interface CreateTaskDto {
  content: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  projectId?: string;
  tags?: string[];
  subtasks?: Subtask[];
}

export interface UpdateTaskDto {
  content?: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  projectId?: string;
  tags?: string[];
  subtasks?: Subtask[];
}

export function getTasks(): Promise<ApiTask[]> {
  return apiFetch<ApiTask[]>('/tasks');
}

export function getTasksForProject(projectId: string): Promise<ApiTask[]> {
  return apiFetch<ApiTask[]>(`/projects/${projectId}/tasks`);
}

export function createTask(dto: CreateTaskDto): Promise<ApiTask> {
  return apiFetch<ApiTask>('/tasks', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateTask(id: string, dto: UpdateTaskDto): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteTask(id: string): Promise<void> {
  return apiFetch<void>(`/tasks/${id}`, { method: 'DELETE' });
}
