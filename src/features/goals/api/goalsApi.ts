import { apiFetch } from '../../../shared/api/client';

export interface ApiGoalDay {
  id: string;
  date: string;
  dayShort: string;
  dateLabel: string;
  title: string;
  markerLevel: 0 | 1 | 2 | 3 | 4;
  sections: unknown[];
  linkedTaskIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface UpsertGoalDayDto {
  dayShort: string;
  dateLabel: string;
  title: string;
  markerLevel: 0 | 1 | 2 | 3 | 4;
  sections: unknown[];
  linkedTaskIds: string[];
}

export function getGoalDays(): Promise<ApiGoalDay[]> {
  return apiFetch<ApiGoalDay[]>('/goals/days');
}

export function upsertGoalDay(date: string, dto: UpsertGoalDayDto): Promise<ApiGoalDay> {
  return apiFetch<ApiGoalDay>(`/goals/days/${date}`, {
    method: 'PUT',
    body: JSON.stringify(dto),
  });
}

export function deleteGoalDay(date: string): Promise<void> {
  return apiFetch<void>(`/goals/days/${date}`, { method: 'DELETE' });
}
