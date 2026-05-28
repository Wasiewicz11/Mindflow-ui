import { apiFetch } from '../../../shared/api/client';

export interface Space {
  id: string;
  name: string;
  description: string;
}

export interface CreateSpaceDto {
  name: string;
  description: string;
}

export interface UpdateSpaceDto {
  name?: string;
  description?: string;
}

export function getSpaces(): Promise<Space[]> {
  return apiFetch<Space[]>('/spaces');
}

export function createSpace(dto: CreateSpaceDto): Promise<Space> {
  return apiFetch<Space>('/spaces', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function deleteSpace(id: string): Promise<void> {
  return apiFetch<void>(`/spaces/${id}`, { method: 'DELETE' });
}

export function updateSpace(id: string, dto: UpdateSpaceDto): Promise<Space> {
  return apiFetch<Space>(`/spaces/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}
