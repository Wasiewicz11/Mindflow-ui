import { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, ChevronRight, Inbox, RefreshCw } from 'lucide-react';
import {
  getNotificationInbox,
  markNotificationInboxItemRead,
  type NotificationInboxItem,
} from '../api/notificationInboxApi';

interface NotificationCenterProps {
  isLoggedIn: boolean;
  selectedNotificationId: string | null;
}

function formatNotificationDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return new Intl.DateTimeFormat('pl-PL', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(date);
}

function kindLabel(kind: NotificationInboxItem['kind']) {
  switch (kind) {
    case 'MorningBrief':
      return 'Poranek';
    case 'MiddayBrief':
      return 'Popołudnie';
    case 'EveningSummary':
      return 'Wieczór';
  }
}

function messageFromError(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^HTTP \d+:\s*/, '')
    : 'Nie udało się pobrać centrum powiadomień.';
}

export function NotificationCenter({ isLoggedIn, selectedNotificationId }: NotificationCenterProps) {
  const [items, setItems] = useState<NotificationInboxItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(selectedNotificationId);
  const activeIdRef = useRef<string | null>(selectedNotificationId);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (!isLoggedIn) return;

    try {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      const nextItems = await getNotificationInbox();
      const nextActiveId = selectedNotificationId && nextItems.some(item => item.id === selectedNotificationId)
        ? selectedNotificationId
        : activeIdRef.current && nextItems.some(item => item.id === activeIdRef.current)
          ? activeIdRef.current
          : nextItems[0]?.id ?? null;
      const activeItem = nextItems.find(item => item.id === nextActiveId);

      activeIdRef.current = nextActiveId;
      setItems(nextItems);
      setActiveId(nextActiveId);

      if (activeItem && !activeItem.readAt) {
        await markNotificationInboxItemRead(activeItem.id);
        const readAt = new Date().toISOString();
        setItems(current => current.map(item => item.id === activeItem.id ? { ...item, readAt } : item));
      }
    } catch (loadError) {
      setError(messageFromError(loadError));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isLoggedIn, selectedNotificationId]);

  useEffect(() => {
    void Promise.resolve().then(() => load());
  }, [load]);

  useEffect(() => {
    if (!selectedNotificationId) return;

    void Promise.resolve().then(() => {
      activeIdRef.current = selectedNotificationId;
      setActiveId(selectedNotificationId);
    });
  }, [selectedNotificationId]);

  const markRead = async (item: NotificationInboxItem) => {
    if (item.readAt) return;

    try {
      await markNotificationInboxItemRead(item.id);
      const readAt = new Date().toISOString();
      setItems(current => current.map(entry => entry.id === item.id ? { ...entry, readAt } : entry));
    } catch (markError) {
      setError(messageFromError(markError));
    }
  };

  const openItem = (item: NotificationInboxItem) => {
    activeIdRef.current = item.id;
    setActiveId(item.id);
    void markRead(item);
  };

  const activeItem = items.find(item => item.id === activeId) ?? null;

  if (isLoading) {
    return <p className="text-sm text-[#9098a4] dark:text-gray-400">Ładowanie centrum powiadomień...</p>;
  }

  return (
    <div className="mx-auto w-full max-w-5xl animate-fade-in">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Centrum powiadomień</p>
          <h2 className="mt-1 flex items-center gap-2 text-xl font-semibold text-[#0f1115] dark:text-white">
            <Bell size={20} /> Briefy i podsumowania
          </h2>
          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Najważniejsze podsumowania dnia w jednym miejscu.</p>
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          disabled={isRefreshing}
          title="Odśwież powiadomienia"
          aria-label="Odśwież powiadomienia"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] text-[#5a606b] transition-colors duration-200 hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8 dark:focus:ring-white/15"
        >
          <RefreshCw size={17} className={isRefreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-[#b93838] dark:text-red-300">{error}</p>}

      {items.length === 0 && !error ? (
        <div className="flex min-h-52 flex-col items-center justify-center border-y border-[#f1f0ed] px-6 text-center dark:border-white/6">
          <Inbox size={24} className="text-[#9098a4] dark:text-gray-400" />
          <p className="mt-3 text-sm font-medium text-[#0f1115] dark:text-white">Nie ma jeszcze podsumowań</p>
          <p className="mt-1 max-w-sm text-sm text-[#9098a4] dark:text-gray-400">Kolejny poranny brief, brief na popołudnie lub podsumowanie dnia pojawi się tutaj po wysłaniu.</p>
        </div>
      ) : (
        <div className="grid min-h-[420px] border-y border-[#f1f0ed] lg:grid-cols-[minmax(250px,0.75fr)_minmax(0,1.25fr)] dark:border-white/6">
          <div className="divide-y divide-[#f1f0ed] lg:border-r lg:border-[#f1f0ed] dark:divide-white/6 dark:lg:border-white/6">
            {items.map(item => {
              const isActive = item.id === activeItem?.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openItem(item)}
                  className={`flex w-full min-w-0 items-center gap-3 px-4 py-4 text-left transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#d9d9d4] dark:focus:ring-white/15 ${
                    isActive ? 'bg-[#f7f7f4] dark:bg-white/[0.05]' : 'hover:bg-[#fcfcfa] dark:hover:bg-white/[0.025]'
                  }`}
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${item.readAt ? 'bg-transparent' : 'bg-[#0f1115] dark:bg-white'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[#0f1115] dark:text-white">{item.title}</span>
                    <span className="mt-1 block text-[12px] text-[#9098a4] dark:text-gray-400">{kindLabel(item.kind)} · {formatNotificationDate(item.createdAt)}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[#9098a4] dark:text-gray-400" />
                </button>
              );
            })}
          </div>

          {activeItem && (
            <article className="flex min-w-0 flex-col px-5 py-6 sm:px-7">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">{kindLabel(activeItem.kind)}</p>
              <h3 className="mt-2 text-xl font-semibold text-[#0f1115] dark:text-white">{activeItem.title}</h3>
              <p className="mt-2 text-sm text-[#9098a4] dark:text-gray-400">{formatNotificationDate(activeItem.createdAt)}</p>
              <p className="mt-7 whitespace-pre-wrap text-[15px] leading-7 text-[#30343b] dark:text-gray-200">{activeItem.body}</p>
            </article>
          )}
        </div>
      )}
    </div>
  );
}
