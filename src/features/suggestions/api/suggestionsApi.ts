import { apiFetch } from '../../../shared/api/client';
import type { ApiSuggestion } from '../model/suggestionModel';

export function getPendingSuggestions(): Promise<ApiSuggestion[]> {
  return apiFetch<ApiSuggestion[]>('/suggestions');
}

export function acceptSuggestion(id: string): Promise<void> {
  return apiFetch<void>(`/suggestions/${id}/accept`, { method: 'POST' });
}

export function rejectSuggestion(id: string): Promise<void> {
  return apiFetch<void>(`/suggestions/${id}/reject`, { method: 'POST' });
}
