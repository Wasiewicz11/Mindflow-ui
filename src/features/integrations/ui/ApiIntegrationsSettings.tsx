import { useCallback, useEffect, useMemo, useState } from 'react';
import { KeyRound, MoreHorizontal, Plus } from 'lucide-react';
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
import { ALL_SCOPES, SCOPE_LABELS, isReadOnly } from '../model/scopes';
import { CreateApiKeyDialog } from './CreateApiKeyDialog';
import { SkeletonBlock } from '../../../shared/ui/LoadingSkeletons';
import { useConfirmDialog } from '../../../shared/ui/confirmDialog';

interface ApiIntegrationsSettingsProps {
  isLoggedIn: boolean;
}

type TokenState = 'active' | 'revoked' | 'expired';

export function ApiIntegrationsSettings({ isLoggedIn }: ApiIntegrationsSettingsProps) {
  const { confirm } = useConfirmDialog();
  const [settings, setSettings] = useState<IntegrationSettings | null>(null);
  const [loading, setLoading] = useState(isLoggedIn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [createdToken, setCreatedToken] = useState<CreatedIntegrationToken | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const tokens = useMemo(() => settings?.tokens ?? [], [settings?.tokens]);
  const activeCount = useMemo(() => tokens.filter(token => tokenState(token) === 'active').length, [tokens]);

  const refresh = useCallback(async () => {
    const next = await getIntegrationSettings();
    setSettings(next);
    return next;
  }, []);

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
          if (cancelled) return;
          setSettings(next);
          setError(null);
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

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => setOpenMenuId(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [openMenuId]);

  const toggleEnabled = async () => {
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const next = await updateIntegrationSettings(!settings.enabled);
      setSettings(next);
    } catch {
      setError('Nie udało się zmienić ustawienia integracji.');
    } finally {
      setBusy(false);
    }
  };

  const createToken = async (input: { name: string; scopes: IntegrationTokenScope[]; expiresInDays: number }) => {
    setBusy(true);
    setDialogError(null);
    try {
      const created = await createIntegrationToken({
        name: input.name,
        scopes: input.scopes,
        expiresAt: new Date(Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000).toISOString(),
      });
      setCreatedToken(created);
      await refresh();
    } catch {
      setDialogError('Nie udało się utworzyć klucza.');
    } finally {
      setBusy(false);
    }
  };

  const revokeToken = async (token: IntegrationToken) => {
    setOpenMenuId(null);
    const confirmed = await confirm({
      title: `Unieważnić klucz „${token.name}”?`,
      message: 'Narzędzia używające tego klucza stracą dostęp natychmiast. Tej operacji nie można cofnąć.',
      confirmLabel: 'Unieważnij',
      tone: 'danger',
    });
    if (!confirmed) return;

    setBusy(true);
    setError(null);
    try {
      await revokeIntegrationToken(token.id);
      await refresh();
    } catch {
      setError('Nie udało się unieważnić klucza.');
    } finally {
      setBusy(false);
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setCreatedToken(null);
    setDialogError(null);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <SkeletonBlock className="h-5 w-40" />
        <SkeletonBlock className="h-16 w-full rounded-xl" />
        <SkeletonBlock className="h-20 w-full rounded-xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-md">
          <p className="text-base font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">Klucze API</p>
          <p className="mt-1 text-[13px] leading-relaxed text-[#5a606b] dark:text-gray-400">
            Pozwalają zewnętrznym narzędziom działać na Twoim koncie — tylko w zakresie, który im nadasz.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          disabled={!settings?.enabled || busy}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#0f1115] px-3.5 text-[13px] font-medium text-white transition-[background-color,opacity] duration-200 ease hover:bg-[#23262d] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-white dark:text-[#18181B] dark:hover:bg-[#e8e8e4] dark:focus:ring-white/15"
        >
          <Plus size={15} /> Nowy klucz
        </button>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-4 py-3 transition-colors duration-200 ease has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#d9d9d4] has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-40 dark:border-white/10 dark:bg-white/[0.03] dark:has-[:focus-visible]:ring-white/15">
        <span className="min-w-0">
          <span className="block text-[13px] font-medium text-[#0f1115] dark:text-white">Dostęp przez API</span>
          <span className="mt-0.5 block text-[12px] leading-relaxed text-[#9098a4]">
            {settings?.enabled
              ? 'Wyłączenie natychmiast zablokuje wszystkie klucze, bez ich usuwania.'
              : 'Włącz, aby móc tworzyć klucze i korzystać z integracji.'}
          </span>
        </span>
        <input
          type="checkbox"
          checked={settings?.enabled ?? false}
          onChange={toggleEnabled}
          disabled={busy || !settings}
          className="sr-only"
        />
        <span
          aria-hidden
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease ${
            settings?.enabled ? 'bg-[#0f1115] dark:bg-white' : 'bg-[#d9d9d4] dark:bg-white/20'
          }`}
        >
          <span
            className={`absolute h-[18px] w-[18px] rounded-full bg-white transition-transform duration-200 ease dark:bg-[#18181B] ${
              settings?.enabled ? 'translate-x-[23px]' : 'translate-x-[3px]'
            }`}
          />
        </span>
      </label>

      {tokens.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-[#e8e8e4] dark:border-white/10">
          <div className="flex items-center justify-between bg-[#f7f7f4] px-4 py-2 dark:bg-white/[0.04]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
              Klucze ({tokens.length})
            </span>
            <span className="text-[11px] text-[#9098a4]">{activeCount} aktywne</span>
          </div>

          {tokens.map((token, index) => {
            const state = tokenState(token);
            return (
              <div
                key={token.id}
                className={`flex items-start gap-3 px-4 py-3 transition-colors duration-200 ease hover:bg-[#fcfcfa] dark:hover:bg-white/[0.03] ${
                  index > 0 ? 'border-t border-[#f1f0ed] dark:border-white/6' : ''
                } ${state === 'active' ? '' : 'opacity-60'}`}
              >
                <KeyRound size={15} className="mt-1 shrink-0 text-[#9098a4]" />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-medium text-[#0f1115] dark:text-white">{token.name}</span>
                    <StatusBadge state={state} />
                    {isReadOnly(token.scopes) && state === 'active' && (
                      <span className="rounded-full bg-[#f1f0ed] px-2 py-0.5 text-[11px] font-medium text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                        tylko odczyt
                      </span>
                    )}
                  </div>

                  <p className="mt-1 font-mono text-[12px] text-[#9098a4]">{token.tokenPrefix}&middot;&middot;&middot;&middot;&middot;&middot;</p>

                  <p className="mt-1.5 text-[12px] leading-relaxed text-[#9098a4]">
                    <span title={token.scopes.map(scope => SCOPE_LABELS[scope]).join(', ')}>
                      {token.scopes.length === ALL_SCOPES.length
                        ? 'Pełny dostęp'
                        : `${token.scopes.length} z ${ALL_SCOPES.length} uprawnień`}
                    </span>
                    {' · '}
                    {state === 'revoked'
                      ? `unieważniony ${formatDate(token.revokedAt ?? token.createdAt)}`
                      : state === 'expired'
                        ? `wygasł ${formatDate(token.expiresAt)}`
                        : `wygasa ${formatDate(token.expiresAt)}`}
                    {' · '}
                    {token.lastUsedAt ? `użyty ${formatDate(token.lastUsedAt)}` : 'nieużywany'}
                  </p>
                </div>

                {state !== 'revoked' && (
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      onClick={event => {
                        event.stopPropagation();
                        setOpenMenuId(current => (current === token.id ? null : token.id));
                      }}
                      disabled={busy}
                      aria-label={`Akcje klucza ${token.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
                    >
                      <MoreHorizontal size={16} />
                    </button>

                    <div
                      onClick={event => event.stopPropagation()}
                      className={`absolute right-0 top-9 z-20 w-44 origin-top-right rounded-lg border border-[#e8e8e4] bg-white p-1 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] ${
                        openMenuId === token.id
                          ? 'pointer-events-auto scale-100 opacity-100'
                          : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => revokeToken(token)}
                        className="w-full rounded-md px-2.5 py-2 text-left text-[13px] font-medium text-[#b93838] transition-colors duration-200 ease hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] dark:text-red-300 dark:hover:bg-red-950/30 dark:focus:ring-red-900/40"
                      >
                        Unieważnij klucz
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#e8e8e4] px-4 py-8 text-center dark:border-white/10">
          <KeyRound size={20} className="mx-auto text-[#c0c5cc]" />
          <p className="mt-2 text-[13px] font-medium text-[#0f1115] dark:text-white">Brak kluczy</p>
          <p className="mx-auto mt-1 max-w-xs text-[12px] leading-relaxed text-[#9098a4]">
            {settings?.enabled
              ? 'Utwórz pierwszy klucz, aby połączyć Mindflow z zewnętrznym narzędziem.'
              : 'Najpierw włącz dostęp przez API.'}
          </p>
        </div>
      )}

      {error && <p className="text-[13px] text-[#b93838] dark:text-red-300">{error}</p>}

      <CreateApiKeyDialog
        open={dialogOpen}
        busy={busy}
        error={dialogError}
        created={createdToken}
        onClose={closeDialog}
        onCreate={createToken}
      />
    </div>
  );
}

function StatusBadge({ state }: { state: TokenState }) {
  const config = {
    active: { label: 'Aktywny', className: 'bg-[#f4fbf6] text-[#1f5c3c] dark:bg-emerald-950/25 dark:text-emerald-200' },
    revoked: { label: 'Unieważniony', className: 'bg-[#f1f0ed] text-[#9098a4] dark:bg-white/8 dark:text-gray-400' },
    expired: { label: 'Wygasł', className: 'bg-[#f1f0ed] text-[#9098a4] dark:bg-white/8 dark:text-gray-400' },
  }[state];

  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${config.className}`}>{config.label}</span>
  );
}

function tokenState(token: IntegrationToken): TokenState {
  if (token.isRevoked) return 'revoked';
  if (new Date(token.expiresAt).getTime() <= Date.now()) return 'expired';
  return 'active';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium' }).format(new Date(value));
}
