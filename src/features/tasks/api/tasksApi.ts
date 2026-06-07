import { apiFetch } from '../../../shared/api/client';
import { TaskPriority, type Subtask } from '../../../shared/types';
import type { ApiTask } from '../model/taskModel';

export interface CreateTaskDto {
  content: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  estimatedHours?: number;
  projectId?: string;
  tags?: string[];
  subtasks?: Subtask[];
}

export interface UpdateTaskDto {
  content?: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string | null;
  clearDueDate?: boolean;
  estimatedHours?: number;
  clearEstimatedHours?: boolean;
  projectId?: string;
  tags?: string[];
}

export function getTasks(): Promise<ApiTask[]> {
  return apiFetch<ApiTask[]>('/tasks');
}

export function getTasksForProject(projectId: string): Promise<ApiTask[]> {
  return apiFetch<ApiTask[]>(`/projects/${projectId}/tasks`);
}

export function getTask(id: string): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${id}`);
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

export function createSubtask(taskId: string, subtask: Subtask): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${taskId}/subtasks`, {
    method: 'POST',
    body: JSON.stringify(subtask),
  });
}

export function updateSubtask(taskId: string, subtask: Subtask): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${taskId}/subtasks/${subtask.id}`, {
    method: 'PUT',
    body: JSON.stringify(subtask),
  });
}

export function deleteSubtask(taskId: string, subtaskId: string): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${taskId}/subtasks/${subtaskId}`, { method: 'DELETE' });
}

export function reorderSubtasks(taskId: string, subtaskIds: string[]): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${taskId}/subtasks/reorder`, {
    method: 'PUT',
    body: JSON.stringify({ subtaskIds }),
  });
}
