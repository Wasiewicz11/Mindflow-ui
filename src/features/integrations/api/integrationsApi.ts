import { apiFetch } from '../../../shared/api/client';

export type IntegrationTokenScope =
  | 'ProjectsRead'
  | 'TasksRead'
  | 'TasksCreate'
  | 'TasksUpdate'
  | 'TasksDelete'
  | 'SubtasksRead'
  | 'SubtasksCreate'
  | 'SubtasksUpdate'
  | 'SubtasksDelete'
  | 'TimeEntriesRead'
  | 'TimeEntriesCreate'
  | 'TimeEntriesUpdate'
  | 'TimeEntriesDelete';

export interface IntegrationToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: IntegrationTokenScope[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt?: string | null;
  isRevoked: boolean;
  revokedAt?: string | null;
}

export interface IntegrationSettings {
  enabled: boolean;
  tokens: IntegrationToken[];
}

export interface CreatedIntegrationToken {
  id: string;
  name: string;
  tokenPrefix: string;
  scopes: IntegrationTokenScope[];
  createdAt: string;
  expiresAt: string;
  token: string;
}

export interface CreateIntegrationTokenDto {
  name: string;
  scopes: IntegrationTokenScope[];
  expiresAt: string;
}

export function getIntegrationSettings(): Promise<IntegrationSettings> {
  return apiFetch<IntegrationSettings>('/integrations');
}

export function updateIntegrationSettings(enabled: boolean): Promise<IntegrationSettings> {
  return apiFetch<IntegrationSettings>('/integrations', {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export function createIntegrationToken(dto: CreateIntegrationTokenDto): Promise<CreatedIntegrationToken> {
  return apiFetch<CreatedIntegrationToken>('/integrations/tokens', {
    method: 'POST',
    body: JSON.stringify(dto),
  });
}

export function revokeIntegrationToken(id: string): Promise<void> {
  return apiFetch<void>(`/integrations/tokens/${id}`, { method: 'DELETE' });
}
