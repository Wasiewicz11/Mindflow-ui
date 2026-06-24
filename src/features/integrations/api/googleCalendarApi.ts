import { apiFetch } from '../../../shared/api/client';

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
  pushEnabled: boolean;
  sourceCalendarId?: string | null;
  requiresReconnect: boolean;
  watchExpiresAt?: string | null;
  lastSyncedAt?: string | null;
}

export interface GoogleCalendarSyncResult {
  changes: number;
  pushed: number;
}

export interface GoogleCalendarListItem {
  id: string;
  summary?: string | null;
  primary: boolean;
  backgroundColor?: string | null;
}

export function getGoogleConnectUrl(): Promise<{ url: string }> {
  return apiFetch<{ url: string }>('/integrations/google/calendar/connect');
}

export function getGoogleCalendarStatus(): Promise<GoogleCalendarStatus> {
  return apiFetch<GoogleCalendarStatus>('/integrations/google/calendar/status');
}

export function disconnectGoogleCalendar(): Promise<void> {
  return apiFetch<void>('/integrations/google/calendar', { method: 'DELETE' });
}

let syncPromise: Promise<GoogleCalendarSyncResult> | null = null;

export function syncGoogleCalendar(): Promise<GoogleCalendarSyncResult> {
  if (syncPromise) return syncPromise;

  syncPromise = apiFetch<GoogleCalendarSyncResult>('/integrations/google/calendar/sync', { method: 'POST' })
    .finally(() => {
      syncPromise = null;
    });

  return syncPromise;
}

export function getGoogleCalendars(): Promise<GoogleCalendarListItem[]> {
  return apiFetch<GoogleCalendarListItem[]>('/integrations/google/calendar/calendars');
}

export function setGoogleSourceCalendar(calendarId: string): Promise<void> {
  return apiFetch<void>('/integrations/google/calendar/source', {
    method: 'PUT',
    body: JSON.stringify({ calendarId }),
  });
}
