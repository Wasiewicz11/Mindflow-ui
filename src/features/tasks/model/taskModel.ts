import { TaskPriority, type Subtask, type Task, type TaskPriority as TaskPriorityType, type TaskStatus } from '../../../shared/types';
import type { CreateTaskDto, UpdateTaskDto } from '../api/tasksApi';

export interface ApiTask {
  id: string;
  content: string;
  description?: string;
  priority?: TaskPriorityType;
  status?: string;
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  loggedMinutes?: number;
  projectId?: string;
  createdAt?: string;
  tags?: string[];
  subtasks?: Subtask[];
  dueSubtasks?: Subtask[];
  subtaskCompletedCount?: number;
  subtaskTotalCount?: number;
  subtaskDueCount?: number;
}

function normalizeSubtasks(subtasks?: Subtask[]): Subtask[] | undefined {
  return subtasks?.map(subtask => {
    const status = subtask.status ?? (subtask.isCompleted ? 'Completed' : 'NotStarted');
    return {
      ...subtask,
      status,
      isCompleted: status === 'Completed',
    };
  });
}

function toApiDueTime(value?: string) {
  return value ? `${value.slice(0, 5)}:00` : undefined;
}

export function mapApiTask(task: ApiTask): Task {
  const status = (task.status as TaskStatus | undefined) ?? 'NotStarted';
  const subtasks = normalizeSubtasks(task.subtasks);
  const dueSubtasks = normalizeSubtasks(task.dueSubtasks);
  const fallbackDueSubtasks = subtasks?.filter(subtask => !subtask.isCompleted && !!subtask.dueDate);

  return {
    id: task.id,
    content: task.content,
    description: task.description,
    priority: task.priority ?? TaskPriority.P4,
    status,
    isCompleted: status === 'Completed',
    dueDate: task.dueDate,
    dueTime: task.dueTime?.slice(0, 5),
    estimatedHours: task.estimatedHours,
    loggedMinutes: task.loggedMinutes ?? 0,
    project_id: task.projectId ?? null,
    createdAt: task.createdAt ? new Date(task.createdAt) : new Date(),
    tags: task.tags,
    subtasks,
    dueSubtasks: dueSubtasks ?? fallbackDueSubtasks,
    subtaskCompletedCount: task.subtaskCompletedCount ?? subtasks?.filter(subtask => subtask.isCompleted).length ?? 0,
    subtaskTotalCount: task.subtaskTotalCount ?? subtasks?.length ?? 0,
    subtaskDueCount: task.subtaskDueCount ?? dueSubtasks?.length ?? fallbackDueSubtasks?.length ?? 0,
  };
}

export function toCreateTaskDto(input: {
  content: string;
  projectId?: string;
  status?: TaskStatus;
  description?: string;
  priority?: TaskPriorityType;
  dueDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  tags?: string[];
  subtasks?: Subtask[];
}): CreateTaskDto {
  return {
    content: input.content,
    projectId: input.projectId,
    status: input.status,
    description: input.description,
    priority: input.priority,
    dueDate: input.dueDate,
    dueTime: toApiDueTime(input.dueTime),
    estimatedHours: input.estimatedHours,
    tags: input.tags,
    subtasks: input.subtasks,
  };
}

export function toUpdateTaskDto(updates: Partial<Task>): UpdateTaskDto {
  const dto: UpdateTaskDto = {};

  if (updates.content !== undefined) dto.content = updates.content;
  if (updates.priority !== undefined) dto.priority = updates.priority;
  if (updates.status !== undefined) dto.status = updates.status;
  if (Object.prototype.hasOwnProperty.call(updates, 'dueDate')) {
    if (updates.dueDate) {
      dto.dueDate = updates.dueDate;
      dto.clearDueDate = false;
    } else {
      dto.clearDueDate = true;
    }
  }
  if (updates.clearDueDate !== undefined) dto.clearDueDate = updates.clearDueDate;
  if (Object.prototype.hasOwnProperty.call(updates, 'dueTime')) {
    if (updates.dueTime) {
      dto.dueTime = toApiDueTime(updates.dueTime);
      dto.clearDueTime = false;
    } else {
      dto.clearDueTime = true;
    }
  }
  if (updates.clearDueTime !== undefined) dto.clearDueTime = updates.clearDueTime;
  if (Object.prototype.hasOwnProperty.call(updates, 'estimatedHours')) {
    if (updates.estimatedHours != null) dto.estimatedHours = updates.estimatedHours;
    else dto.clearEstimatedHours = true;
  }
  if (updates.project_id !== undefined) dto.projectId = updates.project_id ?? undefined;
  if (updates.description !== undefined) dto.description = updates.description;
  if (updates.tags !== undefined) dto.tags = updates.tags;

  return dto;
}
