import type { PushSubscriptionPayload } from '../api/notificationsApi';

const PUBLIC_KEY = import.meta.env.VITE_WEB_PUSH_PUBLIC_KEY as string | undefined;

export function isWebPushSupported(): boolean {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && 'PushManager' in window;
}

export function getPushPermission(): NotificationPermission | 'unsupported' {
  return isWebPushSupported() ? Notification.permission : 'unsupported';
}

export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!isWebPushSupported()) return null;

  const registration = await navigator.serviceWorker.getRegistration('/');
  return registration ? registration.pushManager.getSubscription() : null;
}

export async function createPushSubscription(): Promise<PushSubscriptionPayload> {
  if (!isWebPushSupported()) throw new Error('Ta przeglądarka nie obsługuje powiadomień push.');
  if (!PUBLIC_KEY) throw new Error('Brakuje konfiguracji klucza Web Push.');

  const permission = Notification.permission === 'default'
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== 'granted') {
    throw new Error('Powiadomienia są zablokowane w ustawieniach tego urządzenia.');
  }

  const registration = await navigator.serviceWorker.register('/service-worker.js', { scope: '/' });
  await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription()
    ?? await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: decodeApplicationServerKey(PUBLIC_KEY),
    });
  const json = subscription.toJSON();
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!json.endpoint || !p256dh || !auth) {
    throw new Error('Nie udało się utworzyć kompletnej subskrypcji powiadomień.');
  }

  return {
    endpoint: json.endpoint,
    p256dh,
    auth,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    deviceName: getDeviceName(),
  };
}

function getDeviceName(): string {
  const userAgent = navigator.userAgent;
  const platform = /iPhone/.test(userAgent)
    ? 'iPhone'
    : /iPad/.test(userAgent) || (/Macintosh/.test(userAgent) && navigator.maxTouchPoints > 1)
      ? 'iPad'
      : /Android/.test(userAgent)
        ? 'Android'
        : /Windows/.test(userAgent)
          ? 'Windows'
          : /Macintosh|Mac OS X/.test(userAgent)
            ? 'Mac'
            : 'Urządzenie';
  const browser = /CriOS|Chrome/.test(userAgent)
    ? 'Chrome'
    : /FxiOS|Firefox/.test(userAgent)
      ? 'Firefox'
      : /EdgiOS|Edg\//.test(userAgent)
        ? 'Edge'
        : 'Safari';

  return `${platform} - ${browser}`;
}

function decodeApplicationServerKey(value: string): Uint8Array<ArrayBuffer> {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(`${base64}${padding}`);
  const bytes = new Uint8Array(raw.length);

  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }

  return bytes;
}
