import { apiFetch } from './client';

const BASE_URL = import.meta.env.VITE_API_URL ?? '';

interface AuthResponse {
  accessToken: string;
  expiresIn: number;
}

// Osobna funkcja fetch tylko dla login/register — backend ma [Authorize] i weryfikuje Google JWT.
// Nie możemy użyć apiFetch bo ten dodałby nasz własny access token zamiast Google tokena.
async function authFetch(path: string, googleToken: string): Promise<AuthResponse> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Authorization: `Bearer ${googleToken}`,
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  return res.json() as Promise<AuthResponse>;
}

export async function login(googleToken: string): Promise<AuthResponse> {
  return authFetch('/auth/login', googleToken);
}

export async function register(googleToken: string): Promise<AuthResponse> {
  return authFetch('/auth/register', googleToken);
}

export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' });
}
