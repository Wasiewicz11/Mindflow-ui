import { apiFetch } from '../../../shared/api/client';

export interface GoogleCalendarStatus {
  connected: boolean;
  email?: string | null;
  connectedAt?: string | null;
  pushEnabled: boolean;
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

export function syncGoogleCalendar(): Promise<{ changes: number }> {
  return apiFetch<{ changes: number }>('/integrations/google/calendar/sync', { method: 'POST' });
}
