import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Check, Trash2, X } from 'lucide-react';
import { ConfirmDialogContext, type ActiveConfirm, type ConfirmOptions } from './confirmDialog';

export function ConfirmDialogProvider({ children }: { children: ReactNode }) {
  const [activeConfirm, setActiveConfirm] = useState<ActiveConfirm | null>(null);
  const resolverRef = useRef<((confirmed: boolean) => void) | null>(null);

  const resolve = useCallback((confirmed: boolean) => {
    resolverRef.current?.(confirmed);
    resolverRef.current = null;
    setActiveConfirm(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    resolverRef.current?.(false);
    return new Promise<boolean>(resolvePromise => {
      resolverRef.current = resolvePromise;
      setActiveConfirm({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? 'Potwierdź',
        cancelLabel: options.cancelLabel ?? 'Anuluj',
        tone: options.tone ?? 'default',
      });
    });
  }, []);

  useEffect(() => () => {
    resolverRef.current?.(false);
  }, []);

  const value = useMemo(() => ({ confirm }), [confirm]);

  return (
    <ConfirmDialogContext.Provider value={value}>
      {children}
      {activeConfirm && (
        <ConfirmDialog
          {...activeConfirm}
          onCancel={() => resolve(false)}
          onConfirm={() => resolve(true)}
        />
      )}
    </ConfirmDialogContext.Provider>
  );
}

function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  tone,
  onCancel,
  onConfirm,
}: ActiveConfirm & {
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const isDanger = tone === 'danger';
  const Icon = isDanger ? Trash2 : Check;

  useEffect(() => {
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-[#0f1115]/28 backdrop-blur-sm animate-fade-in dark:bg-black/58"
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby={message ? 'confirm-dialog-message' : undefined}
        className="relative z-10 w-full max-w-[420px] overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.24)] animate-scale-in dark:border-white/10 dark:bg-[#1C1C1E] dark:shadow-none"
      >
        <div className="flex items-start gap-3 px-5 pt-5">
          <div
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-xl ${
              isDanger
                ? 'bg-red-50 text-red-600 dark:bg-red-500/12 dark:text-red-300'
                : 'bg-[#f7f7f4] text-[#0f1115] dark:bg-white/8 dark:text-white'
            }`}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <h3 id="confirm-dialog-title" className="text-[18px] font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
                {title}
              </h3>
              <button
                type="button"
                onClick={onCancel}
                className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:bg-white/8 dark:hover:text-white"
                title="Zamknij"
              >
                <X size={16} />
              </button>
            </div>
            {message && (
              <div id="confirm-dialog-message" className="mt-1 text-[13px] leading-5 text-[#5a606b] dark:text-gray-400">
                {message}
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2 border-t border-[#f1f0ed] px-5 py-4 dark:border-white/8">
          <button
            ref={cancelRef}
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white px-3 text-[13px] font-medium text-[#3a3f47] transition-colors duration-200 ease hover:bg-[#f7f7f4] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-[13px] font-semibold text-white transition-[background-color,box-shadow] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
              isDanger
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-[#0f1115] hover:bg-[#2a2d33] dark:bg-white dark:text-[#0f1115] dark:hover:bg-gray-100'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
