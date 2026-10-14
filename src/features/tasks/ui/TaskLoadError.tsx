import { AlertTriangle, RefreshCw } from 'lucide-react';

interface TaskLoadErrorProps {
  onRetry: () => void | Promise<void>;
  isRetrying?: boolean;
}

export function TaskLoadError({ onRetry, isRetrying = false }: TaskLoadErrorProps) {
  return (
    <section
      aria-live="polite"
      className="mx-auto flex max-w-xl flex-col items-center justify-center gap-4 py-20 text-center animate-fade-in"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] text-[#5a606b] dark:border-white/10 dark:bg-[#232326] dark:text-gray-300">
        <AlertTriangle size={20} strokeWidth={1.8} aria-hidden="true" />
      </div>
      <div>
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
          Nie udało się załadować zadań
        </h2>
        <p className="mt-1 text-[13px] text-[#9098a4] dark:text-gray-400">
          Sprawdź połączenie z serwerem i spróbuj ponownie.
        </p>
      </div>
      <button
        type="button"
        onClick={() => void onRetry()}
        disabled={isRetrying}
        className="inline-flex items-center gap-2 rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 hover:bg-[#f7f7f4] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200 dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/15"
      >
        <RefreshCw size={15} className={isRetrying ? 'animate-spin' : undefined} aria-hidden="true" />
        Spróbuj ponownie
      </button>
    </section>
  );
}
