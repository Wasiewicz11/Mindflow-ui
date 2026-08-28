import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { CalendarClock, Check, Copy, KeyRound, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import {
  createIntegrationToken,
  getIntegrationSettings,
  revokeIntegrationToken,
  updateIntegrationSettings,
  type CreatedIntegrationToken,
  type IntegrationSettings,
  type IntegrationToken,
  type IntegrationTokenScope,
} from '../api/integrationsApi';
import { SkeletonBlock } from '../../../shared/ui/LoadingSkeletons';

interface ApiIntegrationsSettingsProps {
  isLoggedIn: boolean;
}

const SCOPE_GROUPS: Array<{
  label: string;
  description: string;
  options: Array<{ value: IntegrationTokenScope; label: string }>;
}> = [
  {
    label: 'Projekty',
    description: 'Wybór projektu dla zadania.',
    options: [{ value: 'ProjectsRead', label: 'Odczyt' }],
  },
  {
    label: 'Zadania',
    description: 'Pełna praca na zadaniach.',
    options: [
      { value: 'TasksRead', label: 'Odczyt' },
      { value: 'TasksCreate', label: 'Dodawanie' },
      { value: 'TasksUpdate', label: 'Edycja' },
      { value: 'TasksDelete', label: 'Usuwanie' },
    ],
  },
  {
    label: 'Podzadania',
    description: 'Pełny CRUD podzadań.',
    options: [
      { value: 'SubtasksRead', label: 'Odczyt' },
      { value: 'SubtasksCreate', label: 'Dodawanie' },
      { value: 'SubtasksUpdate', label: 'Edycja' },
      { value: 'SubtasksDelete', label: 'Usuwanie' },
    ],
  },
  {
    label: 'Czas pracy',
    description: 'Wpisy czasu i estymacje zadań.',
    options: [
      { value: 'TimeEntriesRead', label: 'Odczyt' },
      { value: 'TimeEntriesCreate', label: 'Dodawanie' },
      { value: 'TimeEntriesUpdate', label: 'Edycja' },
      { value: 'TimeEntriesDelete', label: 'Usuwanie' },
    ],
  },
];

const SCOPE_LABELS: Record<IntegrationTokenScope, string> = {
  ProjectsRead: 'Projekty: odczyt',
  TasksRead: 'Zadania: odczyt',
  TasksCreate: 'Zadania: dodawanie',
  TasksUpdate: 'Zadania: edycja',
  TasksDelete: 'Zadania: usuwanie',
  SubtasksRead: 'Podzadania: odczyt',
  SubtasksCreate: 'Podzadania: dodawanie',
  SubtasksUpdate: 'Podzadania: edycja',
  SubtasksDelete: 'Podzadania: usuwanie',
  TimeEntriesRead: 'Czas pracy: odczyt',
  TimeEntriesCreate: 'Czas pracy: dodawanie',
  TimeEntriesUpdate: 'Czas pracy: edycja',
  TimeEntriesDelete: 'Czas pracy: usuwanie',
};

const DEFAULT_SCOPES = SCOPE_GROUPS.flatMap(group => group.options.map(option => option.value));
const EXPIRY_OPTIONS = [
  { days: 7, label: '7 dni' },
  { days: 30, label: '30 dni' },
  { days: 90, label: '90 dni' },
  { days: 365, label: '1 rok' },
];

export function ApiIntegrationsSettings({ isLoggedIn }: ApiIntegrationsSettingsProps) {
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(isLoggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<IntegrationTokenScope[]>(DEFAULT_SCOPES);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [createdToken, setCreatedToken] = useState<CreatedIntegrationToken | null>(null);
  const [copied, setCopied] = useState(false);

  const activeTokens = useMemo(
    () => settings?.tokens.filter(token => !token.isRevoked && !isExpired(token)) ?? [],
    [settings?.tokens],
  );

  useEffect(() => {
    if (!isLoggedIn) {
      void Promise.resolve().then(() => {
        setSettings(null);
        setLoading(false);
      });
      return;
    }

    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      setLoading(true);
      getIntegrationSettings()
        .then(next => {
          if (!cancelled) {
            setSettings(next);
            setError(null);
          }
        })
        .catch(() => {
          if (!cancelled) setError('Nie udało się pobrać ustawień integracji.');
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const toggleEnabled = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateIntegrationSettings(!settings.enabled);
      setSettings(next);
      if (!next.enabled) setCreatedToken(null);
    } catch {
      setError('Nie udało się zmienić ustawienia integracji.');
    } finally {
      setBusy(false);
    }
  };

  const toggleScope = (scope: IntegrationTokenScope) => {
    setSelectedScopes(current => {
      if (current.includes(scope)) {
        const next = current.filter(item => item !== scope);
        return next.length > 0 ? next : current;
      }
      return [...current, scope];
    });
  };

  const createToken = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!settings?.enabled) return;

    setBusy(true);
    setError(null);
    setCopied(false);
    try {
      const created = await createIntegrationToken({
        name: name.trim(),
        scopes: selectedScopes,
        expiresAt: new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      });
      setCreatedToken(created);
      setName('');
      const refreshed = await getIntegrationSettings();
      setSettings(refreshed);
    } catch {
      setError('Nie udało się wygenerować tokenu.');
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async (token: IntegrationToken) => {
    setBusy(true);
    setError(null);
    try {
      await revokeIntegrationToken(token.id);
      const refreshed = await getIntegrationSettings();
      setSettings(refreshed);
    } catch {
      setError('Nie udało się unieważnić tokenu.');
    } finally {
      setBusy(false);
    }
  };

  const copyToken = async () => {
    if (!createdToken) return;

    try {
      await navigator.clipboard.writeText(createdToken.token);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('Nie udało się skopiować tokenu.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-5 w-52" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-5/6" />
        </div>
        <SkeletonBlock className="h-11 w-36 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">API v2</p>
          <p className="mt-1 flex items-center gap-2 text-base font-semibold text-[#0f1115] dark:text-white">
            <KeyRound size={16} className="text-[#5a606b] dark:text-gray-400" /> Tokeny integracji
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#5a606b] dark:text-gray-400">
            Dostęp B2B do endpointów v2 z osobnymi uprawnieniami CRUD dla zewnętrznych usług.
          </p>
        </div>

        <button
          type="button"
          onClick={toggleEnabled}
          disabled={busy || !settings}
          aria-pressed={settings?.enabled ?? false}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition-[background-color,color,transform,opacity] duration-200 ease hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:focus:ring-white/15 ${
            settings?.enabled
              ? 'bg-[#0f1115] text-white hover:bg-[#23262d] dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4]'
              : 'border border-[#e8e8e4] bg-white text-[#0f1115] hover:bg-[#f7f7f4] dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:hover:bg-[#323238]'
          }`}
        >
          <ShieldCheck size={16} /> {settings?.enabled ? 'Włączone' : 'Włącz integracje'}
        </button>
      </div>

      {settings?.enabled && (
        <form onSubmit={createToken} className="rounded-xl border border-[#f1f0ed] bg-[#fcfcfa] p-4 transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_11rem_auto] lg:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Nazwa tokenu</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={100}
                placeholder="np. ChatGPT tasks"
                disabled={busy}
                className="h-11 rounded-xl border border-[#e8e8e4] bg-white px-3 text-sm text-[#0f1115] transition-colors duration-200 ease placeholder:text-[#b0b5be] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Ważność klucza</span>
              <span className="relative">
                <CalendarClock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9098a4]" />
                <select
                  value={expiresInDays}
                  onChange={(event) => setExpiresInDays(Number(event.target.value))}
                  disabled={busy}
                  className="h-11 w-full appearance-none rounded-xl border border-[#e8e8e4] bg-white pl-9 pr-3 text-sm text-[#0f1115] transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:ring-white/15"
                >
                  {EXPIRY_OPTIONS.map(option => (
                    <option key={option.days} value={option.days}>{option.label}</option>
                  ))}
                </select>
              </span>
            </label>

            <button
              type="submit"
              disabled={busy || name.trim().length === 0}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-4 text-sm font-medium text-white transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
            >
              <Plus size={16} /> Generuj token
            </button>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {SCOPE_GROUPS.map(group => (
              <fieldset key={group.label} className="rounded-lg border border-[#e8e8e4] bg-white p-3 dark:border-white/10 dark:bg-[#27272A]">
                <legend className="text-[13px] font-semibold text-[#0f1115] dark:text-white">{group.label}</legend>
                <p className="mt-0.5 text-[12px] text-[#9098a4]">{group.description}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {group.options.map(option => {
                    const checked = selectedScopes.includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className={`inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 text-[12px] font-medium transition-[background-color,border-color,color,opacity] duration-200 ease has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#d9d9d4] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 dark:has-[:focus-visible]:ring-white/15 ${
                          checked
                            ? 'border-[#0f1115] bg-[#0f1115] text-white dark:border-white dark:bg-white dark:text-[#18181B]'
                            : 'border-[#e8e8e4] bg-[#fcfcfa] text-[#5a606b] hover:bg-[#f1f0ed] dark:border-white/10 dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/10'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleScope(option.value)}
                          disabled={busy}
                          className="sr-only"
                        />
                        {checked && <Check size={12} strokeWidth={3} />}
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            ))}
          </div>
        </form>
      )}

      {createdToken && (
        <div className="rounded-xl border border-[#dbece1] bg-[#f4fbf6] p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#1f5c3c] dark:text-emerald-200">Token gotowy</p>
              <p className="mt-1 text-[12px] text-[#3a6b4d] dark:text-emerald-300">Zapisz go teraz — pełny klucz nie będzie później ponownie widoczny. Wygasa {formatDate(createdToken.expiresAt)}.</p>
              <p className="mt-1 break-all rounded-lg bg-white px-3 py-2 font-mono text-[12px] text-[#0f1115] dark:bg-[#18181B] dark:text-white">
                {createdToken.token}
              </p>
            </div>
            <button
              type="button"
              onClick={copyToken}
              className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-[#dbece1] bg-white px-3 text-sm font-medium text-[#1f5c3c] transition-[background-color,transform] duration-200 ease hover:-translate-y-px hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#dbece1] dark:border-emerald-900/40 dark:bg-[#27272A] dark:text-emerald-200 dark:hover:bg-[#323238]"
            >
              {copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Skopiowano' : 'Kopiuj'}
            </button>
          </div>
        </div>
      )}

      {settings && settings.tokens.length > 0 && (
        <div className="space-y-2">
          {settings.tokens.map(token => {
            const expired = isExpired(token);
            const status = token.isRevoked ? 'Unieważniony' : expired ? 'Wygasł' : 'Aktywny';
            const statusClass = token.isRevoked || expired
              ? 'bg-[#f1f0ed] text-[#9098a4] dark:bg-white/8 dark:text-gray-400'
              : 'bg-[#f4fbf6] text-[#1f5c3c] dark:bg-emerald-950/25 dark:text-emerald-200';

            return (
              <div key={token.id} className="flex flex-col gap-3 rounded-xl border border-[#f1f0ed] bg-white p-4 transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03] lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium text-[#0f1115] dark:text-white">{token.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClass}`}>{status}</span>
                  </div>
                  <p className="mt-1 font-mono text-[12px] text-[#9098a4]">{token.tokenPrefix}...</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {token.scopes.map(scope => (
                      <span key={scope} className="rounded-full bg-[#f7f7f4] px-2 py-0.5 text-[11px] font-medium text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                        {SCOPE_LABELS[scope]}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-[12px] text-[#9098a4]">
                    Utworzony {formatDate(token.createdAt)} · Wygasa {formatDate(token.expiresAt)} · Ostatnio użyty {token.lastUsedAt ? formatDate(token.lastUsedAt) : 'nigdy'}
                  </p>
                </div>
                {!token.isRevoked && (
                  <button
                    type="button"
                    onClick={() => revokeToken(token)}
                    disabled={busy}
                    title="Unieważnij token"
                    className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#f3d4d4] bg-[#fff8f8] px-3 text-sm font-medium text-[#b93838] transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30 lg:w-auto"
                  >
                    <Trash2 size={15} /> Unieważnij
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {settings?.enabled && activeTokens.length === 0 && (
        <div className="rounded-xl border border-[#f1f0ed] bg-[#fcfcfa] px-4 py-3 text-sm text-[#5a606b] transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-400">
          Brak aktywnych tokenów.
        </div>
      )}

      {error && <p className="text-sm text-[#b93838] dark:text-red-300">{error}</p>}
    </div>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(value));
}

function isExpired(token: IntegrationToken) {
  return new Date(token.expiresAt).getTime() <= Date.now();
}
