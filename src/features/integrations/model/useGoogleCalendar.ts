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
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!isLoggedIn) return;
    setLoading(true);
    try {
      const next = await getGoogleCalendarStatus();
      setStatus(next);
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) {
      void Promise.resolve().then(() => setStatus(null));
      return;
    }
    void Promise.resolve().then(refresh);
  }, [isLoggedIn, refresh]);

  const connect = useCallback(async () => {
    setBusy(true);
    try {
      const { url } = await getGoogleConnectUrl();
      window.location.assign(url);
    } catch {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    setBusy(true);
    try {
      await disconnectGoogleCalendar();
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  const sync = useCallback(async () => {
    setBusy(true);
    try {
      return await syncGoogleCalendar();
    } finally {
      setBusy(false);
    }
  }, []);

  const loadCalendars = useCallback(async () => {
    try {
      const list = await getGoogleCalendars();
      setCalendars(list);
    } catch {
      setCalendars([]);
    }
  }, []);

  const selectSourceCalendar = useCallback(async (calendarId: string) => {
    setBusy(true);
    try {
      await setGoogleSourceCalendar(calendarId);
      await refresh();
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  return { status, calendars, loading, busy, refresh, connect, disconnect, sync, loadCalendars, selectSourceCalendar };
}
