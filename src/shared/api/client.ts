const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'mindflow_access_token';
const REFRESH_LOCK_KEY = 'mindflow_refresh_lock';
const REFRESH_LOCK_TTL_MS = 10_000;
const REFRESH_WAIT_TIMEOUT_MS = 12_000;
const TOKEN_MIN_VALIDITY_MS = 30_000;
const TAB_ID = typeof crypto !== 'undefined' && 'randomUUID' in crypto
  ? crypto.randomUUID()
  : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

type AuthEvent = {
  type: 'token-refreshed' | 'logout';
  tabId: string;
  at: number;
};

type RefreshLock = {
  owner: string;
  expiresAt: number;
};

// Callback rejestrowany przez useAuth — wywołany gdy refresh się nie uda (sesja wygasła).
let logoutCallback: (() => void) | null = null;
const authEventListeners = new Set<(event: AuthEvent) => void>();
const authChannel = typeof BroadcastChannel !== 'undefined'
  ? new BroadcastChannel('mindflow_auth')
  : null;

authChannel?.addEventListener('message', (event: MessageEvent<AuthEvent>) => {
  if (!event.data || event.data.tabId === TAB_ID) return;
  notifyLocalAuthListeners(event.data);
});

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== TOKEN_KEY) return;

    notifyLocalAuthListeners({
      type: event.newValue ? 'token-refreshed' : 'logout',
      tabId: 'storage',
      at: Date.now(),
    });
  });
}

export function registerLogoutCallback(cb: () => void): void {
  logoutCallback = cb;
}

export function subscribeToAuthEvents(listener: (event: AuthEvent) => void): () => void {
  authEventListeners.add(listener);
  return () => authEventListeners.delete(listener);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
  notifyAuthEvent('token-refreshed');
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  notifyAuthEvent('logout');
}

// Deduplicacja: jeśli kilka requestów dostanie 401 jednocześnie, wszyscy czekają na
// ten sam refresh zamiast wysyłać N identycznych zapytań do /auth/refresh.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = refreshAccessTokenWithCrossTabLock().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

function notifyAuthEvent(type: AuthEvent['type']): void {
  const event: AuthEvent = { type, tabId: TAB_ID, at: Date.now() };
  notifyLocalAuthListeners(event);
  authChannel?.postMessage(event);
}

function notifyLocalAuthListeners(event: AuthEvent): void {
  for (const listener of authEventListeners) {
    listener(event);
  }
}

function getTokenExpiry(token: string): number | null {
  try {
    const encodedPayload = token.split('.')[1];
    if (!encodedPayload) return null;

    const base64 = encodedPayload
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, '=');
    const payload = JSON.parse(atob(base64));
    return payload.exp ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

function isTokenUsable(token: string | null, minValidityMs = TOKEN_MIN_VALIDITY_MS): token is string {
  if (!token) return false;

  const expiry = getTokenExpiry(token);
  return Boolean(expiry && expiry - Date.now() > minValidityMs);
}

function getExternallyRefreshedToken(previousToken: string | null): string | null {
  const currentToken = getToken();
  if (!isTokenUsable(currentToken)) return null;
  return currentToken !== previousToken ? currentToken : null;
}

function readRefreshLock(): RefreshLock | null {
  try {
    const raw = localStorage.getItem(REFRESH_LOCK_KEY);
    if (!raw) return null;

    const lock = JSON.parse(raw) as RefreshLock;
    if (!lock.owner || lock.expiresAt <= Date.now()) {
      localStorage.removeItem(REFRESH_LOCK_KEY);
      return null;
    }

    return lock;
  } catch {
    localStorage.removeItem(REFRESH_LOCK_KEY);
    return null;
  }
}

function tryAcquireRefreshLock(): RefreshLock | null {
  const existing = readRefreshLock();
  if (existing && existing.owner !== TAB_ID) return null;

  const lock: RefreshLock = {
    owner: TAB_ID,
    expiresAt: Date.now() + REFRESH_LOCK_TTL_MS,
  };

  localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify(lock));
  const stored = readRefreshLock();
  return stored?.owner === TAB_ID ? lock : null;
}

function releaseRefreshLock(lock: RefreshLock): void {
  const existing = readRefreshLock();
  if (existing?.owner === lock.owner) {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  }
}

function waitForExternalRefresh(previousToken: string | null): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false;

    const done = (token: string | null) => {
      if (settled) return;
      settled = true;
      clearInterval(intervalId);
      clearTimeout(timeoutId);
      unsubscribe();
      resolve(token);
    };

    const check = () => {
      const token = getExternallyRefreshedToken(previousToken);
      if (token) done(token);
    };

    const unsubscribe = subscribeToAuthEvents((event) => {
      if (event.type === 'logout') done(null);
      else check();
    });
    const intervalId = window.setInterval(check, 200);
    const timeoutId = window.setTimeout(() => done(null), REFRESH_WAIT_TIMEOUT_MS);

    check();
  });
}

async function refreshAccessTokenWithCrossTabLock(): Promise<string | null> {
  const previousToken = getToken();
  let lock = tryAcquireRefreshLock();

  if (!lock) {
    const externalToken = await waitForExternalRefresh(previousToken);
    if (externalToken) return externalToken;

    lock = tryAcquireRefreshLock();
    if (!lock) {
      throw new Error('Session refresh is already in progress.');
    }
  }

  try {
    const token = await requestNewAccessToken(previousToken);
    if (token) return token;

    const externalToken = getExternallyRefreshedToken(previousToken);
    return externalToken ?? null;
  } finally {
    releaseRefreshLock(lock);
  }
}

async function requestNewAccessToken(previousToken: string | null): Promise<string | null> {
  const res = await fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  });

  if (res.status === 401 || res.status === 403) {
    return getExternallyRefreshedToken(previousToken);
  }

  if (!res.ok) {
    throw new Error(`Session refresh failed with HTTP ${res.status}`);
  }

  const data = await res.json();
  if (!data.accessToken) {
    throw new Error('Session refresh response did not include an access token.');
  }

  setToken(data.accessToken);
  return data.accessToken as string;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers,
  });

  if (res.status === 401) {
    let newToken: string | null;
    try {
      newToken = await refreshAccessToken();
    } catch {
      throw new Error('Session refresh failed');
    }

    if (!newToken) {
      removeToken();
      logoutCallback?.();
      throw new Error('Unauthorized');
    }

    headers['Authorization'] = `Bearer ${newToken}`;
    const retryRes = await fetch(`${BASE_URL}${path}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!retryRes.ok) {
      const text = await retryRes.text().catch(() => retryRes.statusText);
      throw new Error(`HTTP ${retryRes.status}: ${text}`);
    }

    if (retryRes.status === 204 || retryRes.headers.get('content-length') === '0') {
      return undefined as T;
    }

    return retryRes.json() as Promise<T>;
  }

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
