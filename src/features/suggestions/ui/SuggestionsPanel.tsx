import { AiSuggestionCard } from './AiSuggestionCard';
import type { ApiSuggestion, SuggestionQuota } from '../model/suggestionModel';
import { SkeletonBlock } from '../../../shared/ui/LoadingSkeletons';

interface SuggestionsPanelProps {
  suggestions: ApiSuggestion[];
  quota: SuggestionQuota | null;
  isGenerating: boolean;
  isLoading?: boolean;
  notice: string | null;
  onGenerate: () => void;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function SuggestionsPanel({
  suggestions,
  quota,
  isGenerating,
  isLoading = false,
  notice,
  onGenerate,
  onAccept,
  onReject,
}: SuggestionsPanelProps) {
  const limitReached = quota ? quota.aiUsedToday >= quota.aiLimit : false;

  return (
    <section className="animate-fade-in">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-gray-900 dark:text-white">
          Sugestie AI
          {suggestions.length > 0 && (
            <span className="rounded-full bg-[#0f1115] px-2 py-0.5 text-[10px] font-semibold text-white dark:bg-white dark:text-[#0f1115]">
              {suggestions.length}
            </span>
          )}
        </h2>

        <div className="flex items-center gap-3">
          {isLoading && !quota && (
            <SkeletonBlock className="h-4 w-24" />
          )}
          {quota && (
            <span className="text-xs font-medium text-[#9098a4]">AI: {quota.aiUsedToday}/{quota.aiLimit} dziś</span>
          )}
          <button
            onClick={onGenerate}
            disabled={isGenerating || isLoading}
            className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0f1115] px-4 text-sm font-medium text-white transition-[transform,opacity] duration-200 hover:-translate-y-px hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#0f1115]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#0f1115] dark:focus:ring-white/30 dark:focus:ring-offset-black"
          >
            {isGenerating ? 'Generuję…' : limitReached ? 'Wygeneruj (bez AI)' : 'Wygeneruj'}
          </button>
        </div>
      </div>

      {notice && (
        <p className="mb-3 rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-3 py-2 text-xs text-[#5a606b] dark:border-white/8 dark:bg-white/5 dark:text-gray-400">
          {notice}
        </p>
      )}

      {isLoading ? (
        <div role="status" aria-label="Ladowanie sugestii AI" className="space-y-3">
          {[0, 1].map(item => (
            <div key={item} className="rounded-xl border border-[#e8e8e4] bg-white p-4 dark:border-white/8 dark:bg-[#1C1C1E]">
              <SkeletonBlock className="h-4 w-3/5" />
              <SkeletonBlock className="mt-3 h-3 w-full" />
              <SkeletonBlock className="mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-[#9098a4]">Brak sugestii na teraz. Kliknij „Wygeneruj", żeby przejrzeć swój dzień.</p>
      ) : (
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
      )}
    </section>
  );
}
