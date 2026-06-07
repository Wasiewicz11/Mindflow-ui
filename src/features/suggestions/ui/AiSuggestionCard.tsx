import { useState } from 'react';
import type { ApiSuggestion } from '../model/suggestionModel';

interface AiSuggestionCardProps {
  suggestion: ApiSuggestion;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function AiSuggestionCard({ suggestion, onAccept, onReject }: AiSuggestionCardProps) {
  const [decided, setDecided] = useState(false);

  const handle = (fn: (id: string) => void) => {
    if (decided) return;
    setDecided(true);
    fn(suggestion.id);
  };

  return (
    <div className="rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-[0_8px_24px_-6px_rgba(15,17,21,.08)] transition-[transform,opacity] duration-200 dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
      <div className="flex gap-4">
        <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#0f1115] text-white dark:bg-white dark:text-[#0f1115]">
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 3l2.2 6.1L21 11l-5.8 1.9L13 19l-2.2-6.1L5 11l5.8-1.9L13 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 4v3M3.5 5.5h3" />
          </svg>
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold tracking-[-0.01em] text-[#0f1115] dark:text-white">{suggestion.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-[#5a606b] dark:text-gray-400">{suggestion.body}</p>

          {suggestion.actions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {suggestion.actions.map(action => (
                <li key={action.id} className="flex items-center gap-2 text-[13px]">
                  <span className="truncate font-medium text-[#0f1115] dark:text-gray-200">{action.taskTitle}</span>
                  <span className="flex-none rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#5a606b] dark:bg-white/10 dark:text-gray-300">
                    {action.summary}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => handle(onAccept)}
              disabled={decided}
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[#0f1115] px-4 text-sm font-medium text-white transition-[transform,opacity] duration-200 hover:-translate-y-px hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-[#0f1115]/30 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#0f1115] dark:focus:ring-white/30 dark:focus:ring-offset-[#1C1C1E]"
            >
              Akceptuj
            </button>
            <button
              onClick={() => handle(onReject)}
              disabled={decided}
              className="inline-flex h-9 items-center justify-center rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-4 text-sm font-medium text-[#5a606b] transition-[background-color,transform] duration-200 hover:-translate-y-px hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E]"
            >
              Odrzuć
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
