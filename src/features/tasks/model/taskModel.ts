import { TaskPriority, type Task, type TaskPriority as TaskPriorityType, type TaskStatus } from '../../../shared/types';
import type { CreateTaskDto, UpdateTaskDto } from '../api/tasksApi';

export interface ApiTask {
  id: string;
  content: string;
  description?: string;
  priority?: TaskPriorityType;
  status?: string;
  dueDate?: string;
  projectId?: string;
  createdAt?: string;
}

export function mapApiTask(task: ApiTask): Task {
  const status = (task.status as TaskStatus | undefined) ?? 'NotStarted';

  return {
    id: task.id,
    content: task.content,
    description: task.description,
    priority: task.priority ?? TaskPriority.P4,
    status,
    isCompleted: status === 'Completed',
    dueDate: task.dueDate,
    project_id: task.projectId ?? null,
    createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
  };
}

export function toCreateTaskDto(input: {
  content: string;
  projectId?: string;
  status?: TaskStatus;
  description?: string;
  priority?: TaskPriorityType;
  dueDate?: string;
}): CreateTaskDto {
  return {
    content: input.content,
    projectId: input.projectId,
    status: input.status,
    description: input.description,
    priority: input.priority,
    dueDate: input.dueDate,
  };
}

export function toUpdateTaskDto(updates: Partial<Task>): UpdateTaskDto {
  const dto: UpdateTaskDto = {};

  if (updates.content !== undefined) dto.content = updates.content;
  if (updates.priority !== undefined) dto.priority = updates.priority;
  if (updates.status !== undefined) dto.status = updates.status;
  if (updates.dueDate !== undefined) dto.dueDate = updates.dueDate;
  if (updates.project_id !== undefined) dto.projectId = updates.project_id ?? undefined;
  if (updates.description !== undefined) dto.description = updates.description;

  return dto;
}
