import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Calendar, Check, RefreshCw } from 'lucide-react';
import { useGoogleCalendar } from '../model/useGoogleCalendar';

interface GoogleCalendarSettingsProps {
  isLoggedIn: boolean;
}

export function GoogleCalendarSettings({ isLoggedIn }: GoogleCalendarSettingsProps) {
  const { status, calendars, loading, busy, error, connect, disconnect, sync, loadCalendars, selectSourceCalendar } =
    useGoogleCalendar(isLoggedIn);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [pendingCalendarId, setPendingCalendarId] = useState<string | null>(null);

  const connected = !loading && status?.connected;
  const reconnectRequired = Boolean(connected && status?.requiresReconnect);
  const selectionRequired = Boolean(connected && !reconnectRequired && !status?.sourceCalendarId);
  const pushNeedsAttention = Boolean(connected && !reconnectRequired && !selectionRequired && !status?.pushEnabled);
  const lastSyncedLabel = status?.lastSyncedAt
    ? new Intl.DateTimeFormat('pl-PL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(status.lastSyncedAt))
    : null;

  useEffect(() => {
    if (!connected || reconnectRequired) return;
    void Promise.resolve().then(loadCalendars);
  }, [connected, reconnectRequired, loadCalendars]);

  const handleSync = async () => {
    setSyncMessage(null);
    const result = await sync();
    if (result) {
      setSyncMessage(`Gotowe: ${result.changes} zmian z Google, ${result.pushed} wysłanych bloków.`);
    }
  };

  const handleCalendarChange = (calendarId: string) => {
    if (!calendarId || calendarId === status?.sourceCalendarId) return;
    setPendingCalendarId(calendarId);
  };

  const confirmCalendarChange = async () => {
    if (!pendingCalendarId) return;
    const target = pendingCalendarId;
    setPendingCalendarId(null);
    setSyncMessage(null);
    await selectSourceCalendar(target);
  };

  const pendingCalendarName = calendars.find(c => c.id === pendingCalendarId)?.summary ?? 'wybrany kalendarz';

  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-md">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Integracje</p>
        <p className="mt-1 flex items-center gap-2 text-base font-semibold text-[#0f1115] dark:text-white">
          <Calendar size={16} className="text-[#5a606b] dark:text-gray-400" /> Google Calendar
        </p>
        <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">
          Synchronizacja w obie strony: Twoje wydarzenia z Google pojawią się w kalendarzu Mindflow, a bloki czasu z Mindflow trafią do dedykowanego kalendarza „Mindflow" w Google.
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        {loading && (
          <span className="text-sm text-[#9098a4]">Sprawdzanie połączenia…</span>
        )}

        {connected && (
          <>
            <div className={`flex max-w-[320px] items-start gap-2 rounded-xl border px-3 py-2 ${
              reconnectRequired
                ? 'border-[#f3d4d4] bg-[#fff8f8] dark:border-red-900/40 dark:bg-red-950/20'
                : selectionRequired
                  ? 'border-[#e8e8e4] bg-[#f7f7f4] dark:border-white/10 dark:bg-white/5'
                : pushNeedsAttention
                  ? 'border-[oklch(0.88_0.04_55)] bg-[oklch(0.96_0.03_55)] dark:border-amber-900/40 dark:bg-amber-950/20'
                  : 'border-[#dbece1] bg-[#f4fbf6] dark:border-emerald-900/40 dark:bg-emerald-950/20'
            }`}>
              <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-white ${
                reconnectRequired
                  ? 'bg-[#b93838]'
                  : selectionRequired
                    ? 'bg-[#0f1115] dark:bg-white dark:text-[#18181B]'
                    : pushNeedsAttention
                      ? 'bg-[oklch(0.70_0.16_55)]'
                      : 'bg-[#2f7a52]'
              }`}>
                {selectionRequired
                  ? <Calendar size={12} strokeWidth={2.5} />
                  : reconnectRequired || pushNeedsAttention
                  ? <AlertTriangle size={12} strokeWidth={2.5} />
                  : <Check size={12} strokeWidth={3} />}
              </span>
              <div className="min-w-0 text-left">
                <p className={`text-[13px] font-semibold ${
                  reconnectRequired
                    ? 'text-[#9f2f2f] dark:text-red-200'
                    : selectionRequired
                      ? 'text-[#0f1115] dark:text-white'
                    : pushNeedsAttention
                      ? 'text-[oklch(0.48_0.12_55)] dark:text-amber-200'
                      : 'text-[#1f5c3c] dark:text-emerald-200'
                }`}>
                  {reconnectRequired
                    ? 'Połączenie wygasło'
                    : selectionRequired
                      ? 'Wybierz kalendarz Google'
                      : pushNeedsAttention
                        ? 'Synchronizacja wymaga uwagi'
                        : 'Połączono i synchronizuje'}
                </p>
                {status?.email && <p className="truncate text-[12px] text-[#5a606b] dark:text-gray-400">{status.email}</p>}
                {reconnectRequired && (
                  <p className="mt-1 text-[12px] leading-snug text-[#9f2f2f] dark:text-red-300">
                    Google odrzucił zapisany dostęp. Połącz konto ponownie, aby wznowić synchronizację.
                  </p>
                )}
                {selectionRequired && (
                  <p className="mt-1 text-[12px] leading-snug text-[#5a606b] dark:text-gray-400">
                    Synchronizacja rozpocznie się dopiero po wskazaniu kalendarza z listy poniżej.
                  </p>
                )}
                {lastSyncedLabel && !reconnectRequired && !selectionRequired && (
                  <p className="mt-1 text-[11px] text-[#9098a4]">Ostatnia synchronizacja: {lastSyncedLabel}</p>
                )}
              </div>
            </div>

            {!reconnectRequired && calendars.length > 0 && (
              <label className="flex flex-col gap-1 text-left">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                  {selectionRequired ? 'Wybierz kalendarz do synchronizacji' : 'Synchronizowany kalendarz'}
                </span>
                <select
                  value={status?.sourceCalendarId ?? ''}
                  onChange={(e) => handleCalendarChange(e.target.value)}
                  disabled={busy}
                  className="h-10 min-w-[220px] rounded-xl border border-[#e8e8e4] bg-white px-3 text-sm font-medium text-[#0f1115] transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
                >
                  {selectionRequired && <option value="" disabled>Wybierz kalendarz…</option>}
                  {calendars.map(cal => (
                    <option key={cal.id} value={cal.id}>
                      {(cal.summary ?? cal.id) + (cal.primary ? ' (główny)' : '')}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <div className="flex flex-wrap items-center justify-end gap-2">
              {reconnectRequired ? (
                <button
                  type="button"
                  onClick={connect}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-[#0f1115] px-3 text-sm font-medium text-white transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4]"
                >
                  <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} /> Połącz ponownie
                </button>
              ) : !selectionRequired ? (
                <button
                  type="button"
                  onClick={handleSync}
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-3 text-sm font-medium text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15"
                >
                  <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} /> Synchronizuj teraz
                </button>
              ) : null}
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#f3d4d4] bg-[#fff8f8] px-3 text-sm font-medium text-[#b93838] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus:ring-red-900/60"
              >
                Odłącz
              </button>
            </div>

            {pushNeedsAttention && (
              <span className="max-w-[260px] text-right text-[11px] leading-snug text-[#9098a4]">
                Kanał powiadomień wygasł lub jest wyłączony. „Synchronizuj teraz” spróbuje go odnowić.
              </span>
            )}
            {syncMessage && <span className="text-right text-[12px] text-[#2f7a52] dark:text-emerald-300">{syncMessage}</span>}
          </>
        )}

        {!loading && !status?.connected && (
          <button
            type="button"
            onClick={connect}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#e8e8e4] bg-white px-4 text-sm font-medium text-[#0f1115] shadow-sm transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:hover:bg-[#323238] dark:focus:ring-white/15"
          >
            <Calendar size={16} /> Połącz z Google Calendar
          </button>
        )}
        {error && <span className="max-w-[300px] text-right text-[12px] text-[#b93838] dark:text-red-300">{error}</span>}
      </div>

      {pendingCalendarId && createPortal(
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={() => setPendingCalendarId(null)}>
          <div
            className="w-full max-w-sm rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-[#1C1C1E]"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-base font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {selectionRequired ? 'Wybrać kalendarz do synchronizacji?' : 'Zmienić synchronizowany kalendarz?'}
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#5a606b] dark:text-gray-400">
              {selectionRequired
                ? <>Załadujemy wydarzenia z „{pendingCalendarName}” i od tej chwili będziemy synchronizować właśnie ten kalendarz.</>
                : <>Wszystkie wydarzenia z obecnego kalendarza <strong>znikną z Mindflow</strong>, a w ich miejsce załadujemy wydarzenia z „{pendingCalendarName}”. Bloki utworzone w Mindflow zostają nietknięte.</>}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingCalendarId(null)}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#e8e8e4] bg-white px-4 text-sm font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f7f7f4] dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:hover:bg-[#323238]"
              >
                Anuluj
              </button>
              <button
                type="button"
                onClick={confirmCalendarChange}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#0f1115] px-4 text-sm font-medium text-white transition-colors duration-200 ease hover:bg-[#23262d] dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4]"
              >
                {selectionRequired ? 'Wybierz i synchronizuj' : 'Zmień i synchronizuj'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
