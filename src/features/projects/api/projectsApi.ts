import { apiFetch } from '../../../shared/api/client';

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

export function getProjectTags(projectId: string): Promise<string[]> {
  return apiFetch<string[]>(`/projects/${projectId}/tags`);
}

export function createProjectTag(projectId: string, name: string): Promise<string[]> {
  return apiFetch<string[]>(`/projects/${projectId}/tags`, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}

export function renameProjectTag(projectId: string, currentName: string, name: string): Promise<string[]> {
  return apiFetch<string[]>(`/projects/${projectId}/tags/${encodeURIComponent(currentName)}`, {
    method: 'PUT',
    body: JSON.stringify({ name }),
  });
}

export function deleteProjectTag(projectId: string, name: string): Promise<string[]> {
  return apiFetch<string[]>(`/projects/${projectId}/tags/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  });
}
