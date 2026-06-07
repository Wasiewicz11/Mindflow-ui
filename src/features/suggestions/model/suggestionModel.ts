import { useCallback, useEffect, useState } from 'react';
import {
  acceptSuggestion,
  generateSuggestions,
  getPendingSuggestions,
  getSuggestionQuota,
  rejectSuggestion,
} from '../api/suggestionsApi';

export type SuggestionActionType = 'ChangePriority' | 'ChangeDueDate';
export type SuggestionMode = 'ai' | 'offline';

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

export interface SuggestionQuota {
  aiUsedToday: number;
  aiLimit: number;
}

export interface GenerateResult {
  mode: SuggestionMode;
  aiUsedToday: number;
  aiLimit: number;
  created: number;
}

export function useSuggestions(enabled: boolean, onApplied?: () => void) {
  const [suggestions, setSuggestions] = useState<ApiSuggestion[]>([]);
  const [quota, setQuota] = useState<SuggestionQuota | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastMode, setLastMode] = useState<SuggestionMode | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      const [list, q] = await Promise.all([getPendingSuggestions(), getSuggestionQuota()]);
      setSuggestions(list);
      setQuota(q);
    } catch (e) {
      console.error('Nie udało się pobrać sugestii AI', e);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void Promise.resolve().then(refresh);
  }, [enabled, refresh]);

  const generate = useCallback(async () => {
    if (!enabled) return;
    setIsGenerating(true);
    try {
      const result = await generateSuggestions();
      setLastMode(result.mode);
      setQuota({ aiUsedToday: result.aiUsedToday, aiLimit: result.aiLimit });
      setSuggestions(await getPendingSuggestions());
    } catch (e) {
      console.error('Nie udało się wygenerować sugestii', e);
    } finally {
      setIsGenerating(false);
    }
  }, [enabled]);

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

  return { suggestions, quota, isGenerating, lastMode, accept, reject, generate, refresh };
}
