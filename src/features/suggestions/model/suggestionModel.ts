import { useCallback, useEffect, useState } from 'react';
import { acceptSuggestion, getPendingSuggestions, rejectSuggestion } from '../api/suggestionsApi';

export type SuggestionActionType = 'ChangePriority' | 'ChangeDueDate';

export interface ApiSuggestionAction {
  id: string;
  taskId: string;
  taskTitle: string;
  actionType: SuggestionActionType;
  summary: string;
}

export interface ApiSuggestion {
  id: string;
  title: string;
  body: string;
  generatedForDate: string;
  createdAt: string;
  actions: ApiSuggestionAction[];
}

export function useSuggestions(enabled: boolean, onApplied?: () => void) {
  const [suggestions, setSuggestions] = useState<ApiSuggestion[]>([]);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const data = await getPendingSuggestions();
      setSuggestions(data);
    } catch (e) {
      console.error('Nie udało się pobrać sugestii AI', e);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(refresh);
  }, [enabled, refresh]);

  const accept = useCallback(async (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    try {
      await acceptSuggestion(id);
      onApplied?.();
    } catch (e) {
      console.error('Nie udało się zaakceptować sugestii', e);
      void refresh();
    }
  }, [onApplied, refresh]);

  const reject = useCallback(async (id: string) => {
    setSuggestions(prev => prev.filter(s => s.id !== id));
    try {
      await rejectSuggestion(id);
    } catch (e) {
      console.error('Nie udało się odrzucić sugestii', e);
      void refresh();
    }
  }, [refresh]);

  return { suggestions, accept, reject, refresh };
}
