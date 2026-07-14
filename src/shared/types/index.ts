// Typy lokalne — rozszerzają typy API o pola wizualne których nowy backend nie ma
// (isCompleted, priority jako string P1-P4, project_id, createdAt)

import type { Space as ApiSpace } from '../../features/spaces/api/spacesApi';

export const TaskPriority = {
  P1: 'P1',
  P2: 'P2',
  P3: 'P3',
  P4: 'P4',
} as const;

export type TaskPriority = typeof TaskPriority[keyof typeof TaskPriority];

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl: string | null;
  timeZone: string;
}

// Space rozszerzone o color i projects (lokalnie zarządzane)
export interface Space extends ApiSpace {
  color?: string;
  user_email?: string;
}

// Project — lokalny koncept (nowy backend go nie ma, trzymamy lokalnie)
export interface Project {
  id: string;
  name: string;
  color?: string;
  space_id?: string | null;
  user_email?: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  tags?: string[];
  source?: 'app' | 'telegram';
  project_id?: string | null;
}

export type TaskStatus = 'NotStarted' | 'InProgress' | 'Completed';

export interface Subtask {
  id: string;
  content: string;
  isCompleted: boolean;
  status?: TaskStatus;
  description?: string;
  dueDate?: string;
  sortOrder?: number;
}

// Task rozszerzone o pola wizualne (isCompleted, priority jako P1-P4, project_id)
export interface Task {
  id: string;
  content: string;
  isCompleted: boolean;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string;
  clearDueDate?: boolean;
  estimatedHours?: number;
  createdAt: Date;
  source?: 'app' | 'telegram';
  project_id?: string | null;
  description?: string;
  tags?: string[];
  subtasks?: Subtask[];
  dueSubtasks?: Subtask[];
  subtaskCompletedCount?: number;
  subtaskTotalCount?: number;
  subtaskDueCount?: number;
}

export type InputMode = 'text' | 'audio';
