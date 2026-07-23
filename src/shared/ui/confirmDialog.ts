import { createContext, useContext, type ReactNode } from 'react';

export type ConfirmTone = 'default' | 'danger';

export interface ConfirmOptions {
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

export interface ActiveConfirm extends Required<Pick<ConfirmOptions, 'confirmLabel' | 'cancelLabel' | 'tone'>> {
  title: string;
  message?: ReactNode;
}

export interface ConfirmDialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

export const ConfirmDialogContext = createContext<ConfirmDialogContextValue | null>(null);

export function useConfirmDialog() {
  const context = useContext(ConfirmDialogContext);
  if (!context) {
    throw new Error('useConfirmDialog must be used within ConfirmDialogProvider');
  }
  return context;
}
