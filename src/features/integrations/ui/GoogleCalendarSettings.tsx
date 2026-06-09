import { useState } from 'react';
import { Calendar, Check, RefreshCw } from 'lucide-react';
import { useGoogleCalendar } from '../model/useGoogleCalendar';

interface GoogleCalendarSettingsProps {
  isLoggedIn: boolean;
}

export function GoogleCalendarSettings({ isLoggedIn }: GoogleCalendarSettingsProps) {
  const { status, loading, busy, connect, disconnect, sync } = useGoogleCalendar(isLoggedIn);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const handleSync = async () => {
    setSyncMessage(null);
    const result = await sync();
    setSyncMessage(result ? `Zsynchronizowano (${result.changes} zmian).` : 'Nie udało się zsynchronizować.');
  };

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

        {!loading && status?.connected && (
          <>
            <div className="flex items-center gap-2 rounded-xl border border-[#dbece1] bg-[#f4fbf6] px-3 py-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2f7a52] text-white">
                <Check size={12} strokeWidth={3} />
              </span>
              <div className="min-w-0 text-left">
                <p className="text-[13px] font-semibold text-[#1f5c3c] dark:text-emerald-200">Połączono</p>
                {status.email && <p className="truncate text-[12px] text-[#3f7a5a] dark:text-emerald-300/80">{status.email}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSync}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-3 text-sm font-medium text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15"
              >
                <RefreshCw size={14} className={busy ? 'animate-spin' : undefined} /> Synchronizuj teraz
              </button>
              <button
                type="button"
                onClick={disconnect}
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#f3d4d4] bg-[#fff8f8] px-3 text-sm font-medium text-[#b93838] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus:ring-red-900/60"
              >
                Odłącz
              </button>
            </div>

            {!status.pushEnabled && (
              <span className="max-w-[260px] text-right text-[11px] leading-snug text-[#9098a4]">
                Powiadomienia push wyłączone (brak publicznego webhooka) — zmiany dociągaj ręcznie.
              </span>
            )}
            {syncMessage && <span className="text-right text-[12px] text-[#5a606b] dark:text-gray-400">{syncMessage}</span>}
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
      </div>
    </div>
  );
}
