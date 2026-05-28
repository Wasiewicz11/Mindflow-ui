import type { User } from '../../../shared/types';
import { apiFetch } from '../../../shared/api/client';

export async function getMe(): Promise<User> {
  return apiFetch<User>('/users/me');
}
