import { useCallback, useEffect, useState } from 'react';
import {
  disconnectGoogleCalendar,
  getGoogleCalendars,
  getGoogleCalendarStatus,
  getGoogleConnectUrl,
  setGoogleSourceCalendar,
  syncGoogleCalendar,
  type GoogleCalendarListItem,
  type GoogleCalendarStatus,
} from '../api/googleCalendarApi';

export function useGoogleCalendar(isLoggedIn: boolean) {
  const [status, setStatus] = useState<GoogleCalendarStatus | null>(null);
  const [calendars, setCalendars] = useState<GoogleCalendarListItem[]>([]);
  const [loading, setLoading] = useState(isLoggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const next = await getGoogleCalendarStatus();
      setStatus(next);
      setError(null);
    } catch {
      setStatus(null);
      setError('Nie udało się sprawdzić stanu integracji.');
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      void Promise.resolve().then(() => setStatus(null));
      return;
    }

    const repairAndRefresh = async () => {
      try {
        await syncGoogleCalendar();
      } catch {
        // The status request below translates an OAuth failure into a reconnect state.
      }
      await refresh();
    };

    void repairAndRefresh();
  }, [isLoggedIn, refresh]);

  const connect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = await getGoogleConnectUrl();
      window.location.assign(url);
    } catch {
      setError('Nie udało się rozpocząć połączenia z Google.');
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      await disconnectGoogleCalendar();
      await refresh();
    } catch {
      setError('Nie udało się odłączyć Google Calendar.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const sync = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await syncGoogleCalendar();
      await refresh();
      return result;
    } catch {
      await refresh();
      setError('Synchronizacja nie powiodła się. Sprawdź stan połączenia poniżej.');
      return null;
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const loadCalendars = useCallback(async () => {
    try {
      const list = await getGoogleCalendars();
      setCalendars(list);
    } catch {
      setCalendars([]);
      if (!status?.requiresReconnect) setError('Nie udało się pobrać listy kalendarzy Google.');
    }
  }, [status?.requiresReconnect]);

  const selectSourceCalendar = useCallback(async (calendarId: string) => {
    setBusy(true);
    setError(null);
    try {
      await setGoogleSourceCalendar(calendarId);
      await refresh();
    } catch {
      await refresh();
      setError('Nie udało się zmienić synchronizowanego kalendarza.');
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { status, calendars, loading, busy, error, refresh, connect, disconnect, sync, loadCalendars, selectSourceCalendar };
}
