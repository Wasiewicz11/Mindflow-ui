import { useEffect, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, KeyRound, ShieldAlert, X } from 'lucide-react';
import type { CreatedIntegrationToken, IntegrationTokenScope } from '../api/integrationsApi';
import { ALL_SCOPES, SCOPE_GROUPS } from '../model/scopes';

interface CreateApiKeyDialogProps {
  open: boolean;
  busy: boolean;
  error: string | null;
  created: CreatedIntegrationToken | null;
  onClose: () => void;
  onCreate: (input: { name: string; scopes: IntegrationTokenScope[]; expiresInDays: number }) => void;
}

const EXPIRY_OPTIONS = [
  { days: 7, label: '7 dni' },
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: 365, label: '1 rok' },
];

const DEFAULT_SCOPES: IntegrationTokenScope[] = ['ProjectsRead', 'TasksRead', 'TasksCreate', 'TasksUpdate'];

export function CreateApiKeyDialog({ open, busy, error, created, onClose, onCreate }: CreateApiKeyDialogProps) {
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<IntegrationTokenScope[]>(DEFAULT_SCOPES);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [copied, setCopied] = useState(false);
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    void Promise.resolve().then(() => {
      setName('');
      setScopes(DEFAULT_SCOPES);
      setExpiresInDays(30);
      setCopied(false);
    });
  }, [open]);

  useEffect(() => {
    if (!open || created) return;
    const timer = window.setTimeout(() => nameRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open, created]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const toggleScope = (scope: IntegrationTokenScope) => {
    setScopes(current => current.includes(scope)
      ? current.filter(item => item !== scope)
      : [...current, scope]);
  };

  const toggleGroup = (groupScopes: IntegrationTokenScope[]) => {
    const allSelected = groupScopes.every(scope => scopes.includes(scope));
    setScopes(current => allSelected
      ? current.filter(scope => !groupScopes.includes(scope))
      : [...new Set([...current, ...groupScopes])]);
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (name.trim().length === 0 || scopes.length === 0) return;
    onCreate({ name: name.trim(), scopes, expiresInDays });
  };

  const copyToken = async () => {
    if (!created) return;
    try {
      await navigator.clipboard.writeText(created.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={created ? 'Klucz utworzony' : 'Nowy klucz API'}
        onClick={event => event.stopPropagation()}
        className="flex max-h-[90vh] w-full max-w-xl flex-col overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-[#1C1C1E]"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#f1f0ed] px-5 py-4 dark:border-white/6">
          <div>
            <p className="text-base font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">
              {created ? 'Klucz utworzony' : 'Nowy klucz API'}
            </p>
            <p className="mt-1 text-[13px] leading-relaxed text-[#5a606b] dark:text-gray-400">
              {created
                ? 'Skopiuj klucz teraz — nie pokażemy go ponownie.'
                : 'Klucz działa wyłącznie na Twoim koncie i tylko w zaznaczonym zakresie.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="-mr-1 -mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
          >
            <X size={16} />
          </button>
        </div>

        {created ? (
          <div className="flex flex-col gap-4 px-5 py-5">
            <div className="rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] p-3 dark:border-white/10 dark:bg-white/[0.04]">
              <p className="break-all font-mono text-[13px] leading-relaxed text-[#0f1115] dark:text-white">{created.token}</p>
            </div>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-4 text-sm font-medium text-white transition-[background-color,opacity] duration-200 ease hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Skopiowano' : 'Kopiuj klucz'}
            </button>
            <p className="flex items-start gap-2 text-[12px] leading-relaxed text-[#9098a4]">
              <ShieldAlert size={14} className="mt-0.5 shrink-0" />
              Trzymaj go jak hasło. Jeśli wycieknie, unieważnij klucz na liście — przestanie działać natychmiast.
            </p>
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-[#3a3f47] dark:text-gray-300">Nazwa</span>
                  <input
                    ref={nameRef}
                    value={name}
                    onChange={event => setName(event.target.value)}
                    maxLength={100}
                    placeholder="np. Claude Code"
                    disabled={busy}
                    className="h-10 rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm text-[#0f1115] transition-colors duration-200 ease placeholder:text-[#b0b5be] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-medium text-[#3a3f47] dark:text-gray-300">Wygasa za</span>
                  <select
                    value={expiresInDays}
                    onChange={event => setExpiresInDays(Number(event.target.value))}
                    disabled={busy}
                    className="h-10 rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm text-[#0f1115] transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
                  >
                    {EXPIRY_OPTIONS.map(option => (
                      <option key={option.days} value={option.days}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-5 flex items-center justify-between">
                <span className="text-[12px] font-medium text-[#3a3f47] dark:text-gray-300">Uprawnienia</span>
                <button
                  type="button"
                  onClick={() => setScopes(scopes.length === ALL_SCOPES.length ? [] : ALL_SCOPES)}
                  className="rounded-md px-2 py-1 text-[12px] font-medium text-[#5a606b] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] dark:text-gray-400 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
                >
                  {scopes.length === ALL_SCOPES.length ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                </button>
              </div>

              <div className="mt-2 overflow-hidden rounded-xl border border-[#e8e8e4] dark:border-white/10">
                {SCOPE_GROUPS.map((group, groupIndex) => {
                  const groupScopes = group.options.map(option => option.value);
                  const allSelected = groupScopes.every(scope => scopes.includes(scope));

                  return (
                    <fieldset key={group.key} className={groupIndex > 0 ? 'border-t border-[#e8e8e4] dark:border-white/10' : ''}>
                      <legend className="sr-only">{group.label}</legend>
                      <div className="flex items-center justify-between bg-[#f7f7f4] px-3 py-2 dark:bg-white/[0.04]">
                        <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">{group.label}</span>
                        <button
                          type="button"
                          onClick={() => toggleGroup(groupScopes)}
                          className="rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#5a606b] transition-colors duration-200 ease hover:bg-[#e8e8e4] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white dark:focus:ring-white/15"
                        >
                          {allSelected ? 'Odznacz' : 'Zaznacz'}
                        </button>
                      </div>

                      {group.options.map(option => {
                        const checked = scopes.includes(option.value);
                        return (
                          <label
                            key={option.value}
                            className="flex cursor-pointer items-start gap-3 border-t border-[#f1f0ed] px-3 py-2.5 transition-colors duration-200 ease hover:bg-[#fcfcfa] has-[:focus-visible]:bg-[#fcfcfa] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 dark:border-white/6 dark:hover:bg-white/[0.03] dark:has-[:focus-visible]:bg-white/[0.03]"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggleScope(option.value)}
                              disabled={busy}
                              className="sr-only"
                            />
                            <span
                              aria-hidden
                              className={`mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-[background-color,border-color] duration-200 ease ${
                                checked
                                  ? 'border-[#0f1115] bg-[#0f1115] text-white dark:border-white dark:bg-white dark:text-[#18181B]'
                                  : 'border-[#c0c5cc] bg-white dark:border-white/20 dark:bg-transparent'
                              }`}
                            >
                              {checked && <Check size={12} strokeWidth={3} />}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-medium text-[#0f1115] dark:text-white">{option.label}</span>
                              <span className="block text-[12px] leading-relaxed text-[#9098a4]">{option.description}</span>
                            </span>
                          </label>
                        );
                      })}
                    </fieldset>
                  );
                })}
              </div>

              {error && <p className="mt-3 text-[13px] text-[#b93838] dark:text-red-300">{error}</p>}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#f1f0ed] px-5 py-4 dark:border-white/6">
              <span className="text-[12px] text-[#9098a4]">
                Wybrano {scopes.length} z {ALL_SCOPES.length}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="inline-flex h-10 items-center justify-center rounded-lg border border-[#e8e8e4] bg-white px-4 text-sm font-medium text-[#0f1115] transition-colors duration-200 ease hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:hover:bg-[#323238] dark:focus:ring-white/15"
                >
                  Anuluj
                </button>
                <button
                  type="submit"
                  disabled={busy || name.trim().length === 0 || scopes.length === 0}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#0f1115] px-4 text-sm font-medium text-white transition-[background-color,opacity] duration-200 ease hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
                >
                  <KeyRound size={15} /> Utwórz klucz
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>,
    document.body,
  );
}
