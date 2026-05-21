// Typy lokalne — rozszerzają typy API o pola wizualne których nowy backend nie ma
// (isCompleted, priority jako string p1-p4, project_id, createdAt)

import type { Space as ApiSpace } from './api/spaces';

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

export interface Subtask {
  id: string;
  content: string;
  isCompleted: boolean;
}

// Task rozszerzone o pola wizualne (isCompleted, priority jako p1-p4, project_id)
export interface Task {
  id: string;
  content: string;
  isCompleted: boolean;
  priority: 'p1' | 'p2' | 'p3' | 'p4';
  dueDate?: string;
  createdAt: Date;
  source?: 'app' | 'telegram';
  project_id?: string | null;
  description?: string;
  tags?: string[];
  subtasks?: Subtask[];
}

export type InputMode = 'text' | 'audio';
