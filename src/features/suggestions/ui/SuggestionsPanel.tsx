import { AiSuggestionCard } from './AiSuggestionCard';
import type { ApiSuggestion } from '../model/suggestionModel';

interface SuggestionsPanelProps {
  suggestions: ApiSuggestion[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function SuggestionsPanel({ suggestions, onAccept, onReject }: SuggestionsPanelProps) {
  if (suggestions.length === 0) return null;

  return (
    <section className="animate-fade-in">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
        Sugestie AI
        <span className="rounded-full bg-[#0f1115] px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-[#0f1115]">
          {suggestions.length}
        </span>
      </h2>
      <div className="space-y-3">
        {suggestions.map(suggestion => (
          <AiSuggestionCard
            key={suggestion.id}
            suggestion={suggestion}
            onAccept={onAccept}
            onReject={onReject}
          />
        ))}
      </div>
    </section>
  );
}
