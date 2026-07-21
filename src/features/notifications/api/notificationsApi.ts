import { apiFetch } from '../../../shared/api/client';

export interface NotificationSettings {
  enabled: boolean;
  morningBriefEnabled: boolean;
  morningBriefTime: string;
  middayBriefEnabled: boolean;
  middayBriefTime: string;
  eveningSummaryEnabled: boolean;
  eveningSummaryTime: string;
  blockRemindersEnabled: boolean;
  blockReminderMinutes: number;
  subscriptionCount: number;
}

export type UpdateNotificationSettings = Omit<NotificationSettings, 'subscriptionCount'>;

export interface PushSubscriptionPayload {
  endpoint: string;
  p256dh: string;
  auth: string;
  timeZone: string;
}

export async function getNotificationSettings(): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/notifications/settings');
}

export async function updateNotificationSettings(settings: UpdateNotificationSettings): Promise<NotificationSettings> {
  return apiFetch<NotificationSettings>('/notifications/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function savePushSubscription(subscription: PushSubscriptionPayload): Promise<void> {
  return apiFetch<void>('/notifications/subscriptions', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  return apiFetch<void>('/notifications/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint }),
  });
}

export async function sendNotificationTest(): Promise<void> {
  return apiFetch<void>('/notifications/test', { method: 'POST' });
}
