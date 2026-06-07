import type { User } from '../../../shared/types';
import { apiFetch } from '../../../shared/api/client';

export async function getMe(): Promise<User> {
  return apiFetch<User>('/users/me');
}

export async function uploadAvatar(file: File): Promise<User> {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch<User>('/users/me/avatar', {
    method: 'POST',
    body: formData,
  });
}
