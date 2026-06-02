import { apiFetch } from '../../../shared/api/client';

export type CalendarProvider = 'local' | 'google';
export type CalendarSyncStatus = 'local' | 'synced' | 'conflict';

export interface ApiCalendarBlock {
  id: string;
  taskId?: string | null;
  userId: string;
  title?: string | null;
  startAt: string;
  durationMinutes: number;
  createdAt: string;
  updatedAt: string;
  provider: CalendarProvider;
  externalEventId?: string | null;
  googleCalendarId?: string | null;
  syncStatus: CalendarSyncStatus;
}

export interface CreateCalendarBlockRequest {
  taskId?: string | null;
  title?: string | null;
  startAt: string;
  durationMinutes: number;
}

export interface UpdateCalendarBlockRequest {
  taskId?: string | null;
  title?: string | null;
  startAt: string;
  durationMinutes: number;
}

export function getCalendarBlocks(from: string, to: string): Promise<ApiCalendarBlock[]> {
  return apiFetch<ApiCalendarBlock[]>(`/calendar/blocks?from=${from}&to=${to}`);
}

export function createCalendarBlock(dto: CreateCalendarBlockRequest): Promise<ApiCalendarBlock> {
  return apiFetch<ApiCalendarBlock>('/calendar/blocks', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateCalendarBlock(id: string, dto: UpdateCalendarBlockRequest): Promise<ApiCalendarBlock> {
  return apiFetch<ApiCalendarBlock>(`/calendar/blocks/${id}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteCalendarBlock(id: string): Promise<void> {
  return apiFetch<void>(`/calendar/blocks/${id}`, { method: 'DELETE' });
}
