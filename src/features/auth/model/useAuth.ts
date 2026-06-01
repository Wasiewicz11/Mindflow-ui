import { useCallback, useEffect, useRef, useState } from 'react';
import { login, logout as apiLogout, register } from '../api/authApi';
import {
  getToken,
  refreshAccessToken,
  registerLogoutCallback,
  removeToken,
  setToken,
  subscribeToAuthEvents,
} from '../../../shared/api/client';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
          prompt: (callback?: (notification: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void;
        };
      };
    };
  }
}

function getTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function useAuth() {
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => Boolean(getToken()));
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
  }, []);

  const expireSession = useCallback(() => {
    removeToken();
    clearRefreshTimer();
    setIsLoggedIn(false);
  }, [clearRefreshTimer]);

  // Rejestrujemy callback dla client.ts — gdy refresh nie uda się w interceptorze,
  // client.ts wywoła to i wyloguje usera bez dostępu do React state.
  useEffect(() => {
    registerLogoutCallback(() => {
      expireSession();
    });
  }, [expireSession]);

  const scheduleRefresh = useCallback(function scheduleRefresh(token: string) {
    const expiry = getTokenExpiry(token);
    if (!expiry) return;

    // Odświeżamy 1 minutę przed wygaśnięciem zamiast czekać na 401
    const msUntilRefresh = expiry - Date.now() - 60 * 1000;
    if (msUntilRefresh <= 0) {
      refreshAccessToken()
        .then(newToken => {
          if (newToken) {
            setIsLoggedIn(true);
            scheduleRefresh(newToken);
          } else {
            expireSession();
          }
        })
        .catch(() => {
          refreshTimerRef.current = setTimeout(() => {
            const currentToken = getToken();
            if (currentToken) scheduleRefresh(currentToken);
          }, 30_000);
        });
      return;
    }

    clearRefreshTimer();

    refreshTimerRef.current = setTimeout(async () => {
      try {
        const newToken = await refreshAccessToken();
        if (newToken) {
          setIsLoggedIn(true);
          scheduleRefresh(newToken);
        } else {
          expireSession();
        }
      } catch {
        refreshTimerRef.current = setTimeout(() => {
          const currentToken = getToken();
          if (currentToken) scheduleRefresh(currentToken);
        }, 30_000);
      }
    }, msUntilRefresh);
  }, [clearRefreshTimer, expireSession]);

  useEffect(() => {
    const existingScript = document.getElementById('google-gsi');
    if (!existingScript) {
      const script = document.createElement('script');
      script.id = 'google-gsi';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }

    let cancelled = false;

    async function bootstrapSession() {
      const existingToken = getToken();
      if (existingToken) {
        setIsLoggedIn(true);
        scheduleRefresh(existingToken);
        setIsAuthReady(true);
        return;
      }

      try {
        const refreshedToken = await refreshAccessToken();
        if (cancelled) return;

        if (refreshedToken) {
          setIsLoggedIn(true);
          scheduleRefresh(refreshedToken);
        } else {
          setIsLoggedIn(false);
        }
      } catch {
        if (!cancelled) setIsLoggedIn(false);
      } finally {
        if (!cancelled) setIsAuthReady(true);
      }
    }

    bootstrapSession();

    return () => {
      cancelled = true;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, scheduleRefresh]);

  useEffect(() => {
    return subscribeToAuthEvents((event) => {
      if (event.type === 'logout') {
        clearRefreshTimer();
        setIsLoggedIn(false);
        setIsAuthReady(true);
        return;
      }

      const token = getToken();
      if (token) {
        setIsLoggedIn(true);
        setIsAuthReady(true);
        scheduleRefresh(token);
      }
    });
  }, [clearRefreshTimer, scheduleRefresh]);

  function initGoogleButton(buttonEl: HTMLElement) {
    if (!clientId || !window.google) return;
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: handleCredential,
      auto_select: true,
    });
    window.google.accounts.id.renderButton(buttonEl, {
      theme: 'filled_black',
      size: 'large',
      shape: 'rectangular',
      width: 320,
    });
  }

  async function handleCredential(response: { credential: string }) {
    const googleToken = response.credential;

    try {
      // Próbujemy zalogować — jeśli user nie istnieje, rejestrujemy
      let authResponse;
      try {
        authResponse = await login(googleToken);
      } catch {
        authResponse = await register(googleToken);
      }

      setToken(authResponse.accessToken);
      scheduleRefresh(authResponse.accessToken);
      setIsAuthReady(true);
      setIsLoggedIn(true);
    } catch {
      console.error('Authentication failed');
    }
  }

  async function logout() {
    try {
      await apiLogout();
    } catch {
      // Nawet jeśli serwer nie odpowie, czyścimy lokalnie
    }
    expireSession();
  }

  return { isAuthReady, isLoggedIn, logout, initGoogleButton };
}
