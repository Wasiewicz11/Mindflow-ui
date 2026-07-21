import { apiFetch } from '../../../shared/api/client';

export interface NotificationInboxItem {
  id: string;
  kind: 'MorningBrief' | 'MiddayBrief' | 'EveningSummary';
  title: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

export async function getNotificationInbox(): Promise<NotificationInboxItem[]> {
  return apiFetch<NotificationInboxItem[]>('/notifications/inbox');
}

export async function markNotificationInboxItemRead(notificationId: string): Promise<void> {
  return apiFetch<void>(`/notifications/inbox/${notificationId}/read`, { method: 'PUT' });
}
