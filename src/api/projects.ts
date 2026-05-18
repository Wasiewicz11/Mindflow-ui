import { apiFetch } from './client';

export interface Project {
  id: string;
  name: string;
  color: string;
  spaceId: string;
  createdAt: string;
}

export interface CreateProjectDto {
  name: string;
  color?: string;
}

export interface UpdateProjectDto {
  name?: string;
  color?: string;
}

export function getProjects(spaceId: string): Promise<Project[]> {
  return apiFetch<Project[]>(`/spaces/${spaceId}/projects`);
}

export function createProject(spaceId: string, dto: CreateProjectDto): Promise<Project> {
  return apiFetch<Project>(`/spaces/${spaceId}/projects`, {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function updateProject(spaceId: string, id: string, dto: UpdateProjectDto): Promise<Project> {
  return apiFetch<Project>(`/spaces/${spaceId}/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(dto),
  });
}

export function deleteProject(spaceId: string, id: string): Promise<void> {
  return apiFetch<void>(`/spaces/${spaceId}/projects/${id}`, { method: 'DELETE' });
}
