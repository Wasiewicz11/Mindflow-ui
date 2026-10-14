import { apiFetch } from '../../../shared/api/client';
import { TaskPriority, type Subtask, type TaskRecurrenceFrequency } from '../../../shared/types';
import type { ApiTask } from '../model/taskModel';

export interface CreateTaskDto {
  content: string;
  description?: string;
  priority?: TaskPriority;
  status?: string;
  dueDate?: string;
  dueTime?: string;
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
  dueTime?: string | null;
  clearDueTime?: boolean;
  estimatedHours?: number;
  clearEstimatedHours?: boolean;
  projectId?: string;
  tags?: string[];
}

export interface UpdateTaskRecurrenceDto {
  isEnabled: boolean;
  frequency: TaskRecurrenceFrequency;
  interval: number;
  startDate: string;
  endDate?: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  monthOfYear?: number;
  dueTime?: string;
  notificationsEnabled: boolean;
  reminderMinutesBefore: number;
  notificationWindowStart?: string;
  notificationWindowEnd?: string;
}

export interface ApiRecurringTaskPreview {
  recurringTaskId: string;
  occurrenceDate: string;
  content: string;
  priority: TaskPriority;
  projectId?: string;
  dueTime?: string;
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

export function updateTaskRecurrence(id: string, dto: UpdateTaskRecurrenceDto): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${id}/recurrence`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function disableTaskRecurrence(id: string): Promise<ApiTask> {
  return apiFetch<ApiTask>(`/tasks/${id}/recurrence`, { method: 'DELETE' });
}

export function getRecurringTaskPreviews(from: string, to: string): Promise<ApiRecurringTaskPreview[]> {
  return apiFetch<ApiRecurringTaskPreview[]>(`/tasks/recurrence-occurrences?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
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
