import { apiFetch } from '../../../shared/api/client';
import type { TaskPriority, TaskStatus } from '../../../shared/types';
import type { ApiTask } from '../model/taskModel';

export interface ApiTaskTimeEntry {
  id: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  taskContent: string;
  taskPriority: TaskPriority;
  taskStatus: TaskStatus;
  tags: string[];
  workDate: string;
  durationMinutes: number;
  startAt?: string | null;
  endAt?: string | null;
  estimatedHours?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTaskTimeEntryDto {
  workDate?: string;
  durationMinutes?: number;
  startAt?: string;
  endAt?: string;
  estimatedHours?: number;
  clearEstimatedHours?: boolean;
}

export type CompleteTaskDto = CreateTaskTimeEntryDto;

export interface TaskTimeEntryMutationResponse {
  timeEntry: ApiTaskTimeEntry;
  task: ApiTask;
}

export interface CompleteTaskResponse {
  task: ApiTask;
  timeEntry?: ApiTaskTimeEntry | null;
}

export function getTimeEntries(from: string, to: string): Promise<ApiTaskTimeEntry[]> {
  return apiFetch<ApiTaskTimeEntry[]>(`/time-entries?from=${from}&to=${to}`);
}

export function getTaskTimeEntries(taskId: string): Promise<ApiTaskTimeEntry[]> {
  return apiFetch<ApiTaskTimeEntry[]>(`/tasks/${taskId}/time-entries`);
}

export function createTaskTimeEntry(taskId: string, dto: CreateTaskTimeEntryDto): Promise<TaskTimeEntryMutationResponse> {
  return apiFetch<TaskTimeEntryMutationResponse>(`/tasks/${taskId}/time-entries`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function completeTask(taskId: string, dto: CompleteTaskDto): Promise<CompleteTaskResponse> {
  return apiFetch<CompleteTaskResponse>(`/tasks/${taskId}/complete`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function deleteTimeEntry(id: string): Promise<void> {
  return apiFetch<void>(`/time-entries/${id}`, { method: 'DELETE' });
}
