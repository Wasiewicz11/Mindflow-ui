const BASE_URL = import.meta.env.VITE_API_URL ?? '';
const TOKEN_KEY = 'mindflow_access_token';

// Callback rejestrowany przez useAuth — wywołany gdy refresh się nie uda (sesja wygasła).
let logoutCallback: (() => void) | null = null;

export function registerLogoutCallback(cb: () => void): void {
  logoutCallback = cb;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function removeToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Deduplicacja: jeśli kilka requestów dostanie 401 jednocześnie, wszyscy czekają na
// ten sam refresh zamiast wysyłać N identycznych zapytań do /auth/refresh.
let refreshPromise: Promise<string | null> | null = null;

export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = fetch(`${BASE_URL}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) return null;
      const data = await res.json();
      setToken(data.accessToken);
      return data.accessToken as string;
    })
    .catch(() => null)
    .finally(() => {
      refreshPromise = null;
    });

  return refreshPromise;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
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
    const newToken = await refreshAccessToken();

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
