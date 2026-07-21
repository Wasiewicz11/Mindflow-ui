import { useEffect, useState } from 'react';
import { Bell, BellOff, Check, Clock3, Send, Smartphone, Volume2 } from 'lucide-react';
import {
  getNotificationSettings,
  removePushSubscription,
  savePushSubscription,
  sendNotificationTest,
  updateNotificationSettings,
  type NotificationSettings,
  type UpdateNotificationSettings,
} from '../api/notificationsApi';
import {
  createPushSubscription,
  getCurrentPushSubscription,
  getPushPermission,
  isWebPushSupported,
} from '../model/webPush';

interface PushNotificationsSettingsProps {
  isLoggedIn: boolean;
}

type BusyAction = 'subscription' | 'settings' | 'test' | null;

const DEFAULT_SETTINGS: UpdateNotificationSettings = {
  enabled: true,
  morningBriefEnabled: true,
  morningBriefTime: '06:00',
  middayBriefEnabled: true,
  middayBriefTime: '13:00',
  eveningSummaryEnabled: true,
  eveningSummaryTime: '20:00',
  blockRemindersEnabled: true,
  blockReminderMinutes: 10,
};

function toRequest(settings: NotificationSettings): UpdateNotificationSettings {
  return {
    enabled: settings.enabled,
    morningBriefEnabled: settings.morningBriefEnabled,
    morningBriefTime: settings.morningBriefTime.slice(0, 5),
    middayBriefEnabled: settings.middayBriefEnabled,
    middayBriefTime: settings.middayBriefTime.slice(0, 5),
    eveningSummaryEnabled: settings.eveningSummaryEnabled,
    eveningSummaryTime: settings.eveningSummaryTime.slice(0, 5),
    blockRemindersEnabled: settings.blockRemindersEnabled,
    blockReminderMinutes: settings.blockReminderMinutes,
  };
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^HTTP \d+:\s*/, '')
    : 'Nie udało się zapisać ustawień powiadomień.';
}

interface ToggleProps {
  checked: boolean;
  disabled?: boolean;
  label: string;
  description: string;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, disabled = false, label, description, onChange }: ToggleProps) {
  return (
    <label className={`flex min-w-0 items-center gap-3 ${disabled ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="peer sr-only"
      />
      <span className="relative h-6 w-11 shrink-0 rounded-full bg-[#d8d8d3] transition-colors duration-200 ease after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:duration-200 after:ease after:content-[''] peer-checked:bg-[#0f1115] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-[#d9d9d4] peer-disabled:cursor-not-allowed dark:bg-white/15 dark:peer-checked:bg-white dark:peer-checked:after:bg-[#27272A] dark:peer-focus-visible:ring-white/20" />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#0f1115] dark:text-white">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-snug text-[#9098a4] dark:text-gray-400">{description}</span>
      </span>
    </label>
  );
}

interface ScheduleRowProps {
  label: string;
  time: string;
  enabled: boolean;
  disabled: boolean;
  onEnabledChange: (value: boolean) => void;
  onTimeChange: (value: string) => void;
}

function ScheduleRow({ label, time, enabled, disabled, onEnabledChange, onTimeChange }: ScheduleRowProps) {
  return (
    <div className={`flex flex-col gap-3 border-b border-[#f1f0ed] py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between dark:border-white/6 ${disabled ? 'opacity-40' : ''}`}>
      <label className={disabled ? 'cursor-not-allowed' : 'cursor-pointer'}>
        <span className="flex items-center gap-2 text-sm font-medium text-[#0f1115] dark:text-white">
          <input
            type="checkbox"
            checked={enabled}
            disabled={disabled}
            onChange={(event) => onEnabledChange(event.target.checked)}
            className="h-4 w-4 rounded border-[#c0c5cc] text-[#0f1115] accent-[#0f1115] transition-colors duration-200 ease focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed dark:border-white/20 dark:bg-[#27272A] dark:accent-white dark:focus:ring-white/15"
          />
          {label}
        </span>
      </label>
      <input
        type="time"
        value={time}
        disabled={disabled || !enabled}
        onChange={(event) => onTimeChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm font-medium tabular-nums text-[#0f1115] transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 sm:w-[132px] dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
      />
    </div>
  );
}

export function PushNotificationsSettings({ isLoggedIn }: PushNotificationsSettingsProps) {
  const [settings, setSettings] = useState<NotificationSettings | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>(getPushPermission);
  const [deviceSubscribed, setDeviceSubscribed] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const supported = isWebPushSupported();

  const refreshDeviceStatus = async () => {
    setPermission(getPushPermission());
    setDeviceSubscribed(Boolean(await getCurrentPushSubscription()));
  };

  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;
    const load = async () => {
      try {
        const [nextSettings] = await Promise.all([getNotificationSettings(), refreshDeviceStatus()]);
        if (!cancelled) setSettings(nextSettings);
      } catch (loadError) {
        if (!cancelled) setError(messageFromError(loadError));
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const updateLocalSettings = (updates: Partial<UpdateNotificationSettings>) => {
    setSettings(current => current ? { ...current, ...updates } : { ...DEFAULT_SETTINGS, ...updates, subscriptionCount: 0 });
    setNotice(null);
    setError(null);
  };

  const handleEnableDevice = async () => {
    try {
      setBusy('subscription');
      setNotice(null);
      setError(null);
      const subscription = await createPushSubscription();
      await savePushSubscription(subscription);
      await refreshDeviceStatus();
      setNotice('Powiadomienia są włączone na tym urządzeniu.');
    } catch (subscriptionError) {
      setError(messageFromError(subscriptionError));
    } finally {
      setBusy(null);
    }
  };

  const handleDisableDevice = async () => {
    try {
      setBusy('subscription');
      setNotice(null);
      setError(null);
      const subscription = await getCurrentPushSubscription();
      if (subscription) {
        await removePushSubscription(subscription.endpoint);
        await subscription.unsubscribe();
      }
      await refreshDeviceStatus();
      setNotice('Powiadomienia na tym urządzeniu są wyłączone.');
    } catch (subscriptionError) {
      setError(messageFromError(subscriptionError));
    } finally {
      setBusy(null);
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      setBusy('settings');
      setNotice(null);
      setError(null);
      const saved = await updateNotificationSettings(toRequest(settings));
      setSettings(saved);
      setNotice('Harmonogram powiadomień został zapisany.');
    } catch (saveError) {
      setError(messageFromError(saveError));
    } finally {
      setBusy(null);
    }
  };

  const handleTest = async () => {
    try {
      setBusy('test');
      setNotice(null);
      setError(null);
      await sendNotificationTest();
      setNotice('Wysłano powiadomienie testowe.');
    } catch (testError) {
      setError(messageFromError(testError));
    } finally {
      setBusy(null);
    }
  };

  const deviceStatus = !supported
    ? 'Niedostępne w tej przeglądarce'
    : permission === 'denied'
      ? 'Zablokowane w urządzeniu'
      : deviceSubscribed
        ? 'Aktywne na tym urządzeniu'
        : 'Nieaktywne na tym urządzeniu';

  if (!settings) {
    return <p className="text-sm text-[#9098a4] dark:text-gray-400">Ładowanie ustawień powiadomień...</p>;
  }

  const scheduleDisabled = busy === 'settings' || !settings.enabled;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Urządzenie</p>
          <p className="mt-1 flex items-center gap-2 text-base font-semibold text-[#0f1115] dark:text-white">
            <Smartphone size={16} className="text-[#5a606b] dark:text-gray-400" /> {deviceStatus}
          </p>
          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">
            Aktywne urządzenia: {settings.subscriptionCount}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!deviceSubscribed && supported && permission !== 'denied' && (
            <button
              type="button"
              onClick={handleEnableDevice}
              disabled={busy !== null}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-3.5 text-sm font-medium text-white transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
            >
              <Bell size={15} /> {busy === 'subscription' ? 'Włączanie...' : 'Włącz powiadomienia'}
            </button>
          )}
          {deviceSubscribed && (
            <>
              <button
                type="button"
                onClick={handleTest}
                disabled={busy !== null}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-3.5 text-sm font-medium text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15"
              >
                <Send size={15} /> {busy === 'test' ? 'Wysyłanie...' : 'Wyślij test'}
              </button>
              <button
                type="button"
                onClick={handleDisableDevice}
                disabled={busy !== null}
                title="Wyłącz powiadomienia na tym urządzeniu"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#f3d4d4] bg-[#fff8f8] text-[#b93838] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:border-[#efc3c3] hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus:ring-red-900/60"
              >
                <BellOff size={16} />
              </button>
            </>
          )}
        </div>
      </div>

      {permission === 'denied' && (
        <p className="rounded-xl border border-[#f3d4d4] bg-[#fff8f8] px-4 py-3 text-sm text-[#9f2f2f] dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-200">
          Powiadomienia są zablokowane dla Mindflow w ustawieniach urządzenia.
        </p>
      )}

      <div className="border-t border-[#f1f0ed] pt-5 dark:border-white/6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-lg">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Harmonogram</p>
            <p className="mt-1 flex items-center gap-2 text-base font-semibold text-[#0f1115] dark:text-white">
              <Volume2 size={16} className="text-[#5a606b] dark:text-gray-400" /> Plan dnia i przypomnienia
            </p>
          </div>
          <Toggle
            checked={settings.enabled}
            disabled={busy === 'settings'}
            label="Wysyłaj powiadomienia"
            description="Główny przełącznik harmonogramu."
            onChange={(enabled) => updateLocalSettings({ enabled })}
          />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-8">
          <div className="min-w-0">
            <p className="mb-1 flex items-center gap-2 text-[13px] font-semibold text-[#0f1115] dark:text-white">
              <Clock3 size={14} /> Briefy i podsumowanie
            </p>
            <ScheduleRow
              label="Poranny brief"
              time={settings.morningBriefTime.slice(0, 5)}
              enabled={settings.morningBriefEnabled}
              disabled={scheduleDisabled}
              onEnabledChange={(morningBriefEnabled) => updateLocalSettings({ morningBriefEnabled })}
              onTimeChange={(morningBriefTime) => updateLocalSettings({ morningBriefTime })}
            />
            <ScheduleRow
              label="Brief na popołudnie"
              time={settings.middayBriefTime.slice(0, 5)}
              enabled={settings.middayBriefEnabled}
              disabled={scheduleDisabled}
              onEnabledChange={(middayBriefEnabled) => updateLocalSettings({ middayBriefEnabled })}
              onTimeChange={(middayBriefTime) => updateLocalSettings({ middayBriefTime })}
            />
            <ScheduleRow
              label="Podsumowanie dnia"
              time={settings.eveningSummaryTime.slice(0, 5)}
              enabled={settings.eveningSummaryEnabled}
              disabled={scheduleDisabled}
              onEnabledChange={(eveningSummaryEnabled) => updateLocalSettings({ eveningSummaryEnabled })}
              onTimeChange={(eveningSummaryTime) => updateLocalSettings({ eveningSummaryTime })}
            />
          </div>

          <div className={`border-t border-[#f1f0ed] pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0 dark:border-white/6 ${scheduleDisabled ? 'opacity-40' : ''}`}>
            <Toggle
              checked={settings.blockRemindersEnabled}
              disabled={scheduleDisabled}
              label="Nadchodzące bloki"
              description="Przypomnienie przed blokiem w kalendarzu."
              onChange={(blockRemindersEnabled) => updateLocalSettings({ blockRemindersEnabled })}
            />
            <label className="mt-4 flex flex-col gap-1.5 text-[12px] font-medium text-[#5a606b] dark:text-gray-300">
              Minut przed blokiem
              <input
                type="number"
                min="1"
                max="60"
                value={settings.blockReminderMinutes}
                disabled={scheduleDisabled || !settings.blockRemindersEnabled}
                onChange={(event) => updateLocalSettings({ blockReminderMinutes: Number(event.target.value) })}
                className="h-10 w-full rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm font-medium tabular-nums text-[#0f1115] transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="min-h-5 text-sm">
            {notice && <span className="inline-flex items-center gap-1.5 text-[#2f7a52] dark:text-emerald-300"><Check size={15} /> {notice}</span>}
            {error && <span className="text-[#b93838] dark:text-red-300">{error}</span>}
          </div>
          <button
            type="button"
            onClick={handleSaveSettings}
            disabled={busy !== null}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-3.5 text-sm font-medium text-white transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
          >
            <Check size={15} /> {busy === 'settings' ? 'Zapisywanie...' : 'Zapisz harmonogram'}
          </button>
        </div>
      </div>
    </div>
  );
}
