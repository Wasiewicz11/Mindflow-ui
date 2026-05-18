import type { User } from '../types';
import { apiFetch } from './client';

export async function getMe(): Promise<User> {
  return apiFetch<User>('/users/me');
}
