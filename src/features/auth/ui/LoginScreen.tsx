import { useEffect, useRef, useState } from 'react';
import heroImage from '../../../assets/hero.png';

interface Props {
  initGoogleButton: (el: HTMLElement) => void;
}

export function LoginScreen({ initGoogleButton }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const renderedRef = useRef(false);
  const [googleError, setGoogleError] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'unknown';
  const isLocalhost = currentOrigin.includes('localhost') || currentOrigin.includes('127.0.0.1');

  useEffect(() => {
    const tryInit = () => {
      if (buttonRef.current && !renderedRef.current && window.google?.accounts?.id) {
        try {
          initGoogleButton(buttonRef.current);
          renderedRef.current = true;
          return true;
        } catch (err) {
          console.error("Google Auth Init Error:", err);
          return false;
        }
      }
      return !!renderedRef.current;
    };

    if (!tryInit()) {
      const intervalId = setInterval(() => {
        if (tryInit()) {
          clearInterval(intervalId);
          setGoogleError(false);
        }
      }, 100);

      const timeoutId = setTimeout(() => {
        clearInterval(intervalId);
        if (!renderedRef.current) {
          setGoogleError(true);
        }
      }, 4000);

      return () => {
        clearInterval(intervalId);
        clearTimeout(timeoutId);
      };
    }
  }, [initGoogleButton]);

  return (
    <div className="min-h-[100dvh] bg-[#FDFDFD] text-[#0f1115] dark:bg-[#000000] dark:text-white">
      <main className="mx-auto grid min-h-[100dvh] w-full max-w-6xl grid-rows-[1fr_auto] px-6 pb-6 pt-6 sm:px-10 sm:pb-8 sm:pt-8 lg:grid-cols-[1.05fr_0.95fr] lg:grid-rows-1 lg:items-center lg:gap-14 lg:py-12">
        <section className="flex min-h-0 flex-col justify-center gap-5 py-2 sm:gap-10 sm:py-6 lg:py-0">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0f1115] text-xl font-semibold text-white shadow-[0_12px_32px_-18px_rgba(15,17,21,.55)] dark:bg-white dark:text-[#0f1115]">
              M
            </div>
            <span className="text-[19px] font-semibold tracking-[-0.02em]">MindFlow</span>
          </div>

          <div className="max-w-xl">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4] sm:mb-4">
              Osobisty system pracy
            </p>
            <h1 className="max-w-[11ch] text-[36px] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[58px] lg:text-[68px]">
              Skup się na tym, co ważne.
            </h1>
            <p className="mt-4 max-w-md text-[14px] leading-5 text-[#5a606b] dark:text-[#b0b5be] sm:mt-5 sm:text-base sm:leading-6">
              Zadania, projekty i wiedza w jednym spokojnym miejscu. Zaloguj się, aby wrócić do swojego przepływu pracy.
            </p>
          </div>

          <div className="relative max-w-[420px] overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-[#f7f7f4] p-3 shadow-[0_24px_48px_-24px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-white/[0.04] sm:p-4">
            <div className="mb-3 flex items-center justify-between sm:mb-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Dzisiaj</p>
                <p className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">3 priorytety</p>
              </div>
              <img src={heroImage} alt="" className="h-12 w-12 object-contain opacity-95 sm:h-16 sm:w-16" />
            </div>

            <div className="space-y-2 sm:space-y-2.5">
              {[
                ['Przygotować plan tygodnia', 'MindFlow', 'P2'],
                ['Domknąć ważny projekt', 'Praca', 'P1'],
                ['Przejrzeć notatki i decyzje', 'Wiedza', 'P4'],
              ].map(([title, project, priority], index) => (
                <div key={title} className={`items-center gap-3 rounded-lg border border-[#e8e8e4] bg-white px-3 py-2 dark:border-white/10 dark:bg-white/[0.06] sm:py-2.5 ${index === 2 ? 'hidden sm:flex' : 'flex'}`}>
                  <span className="h-4 w-4 flex-none rounded-full border border-[#c0c5cc]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-[#0f1115] dark:text-white">{title}</p>
                    <p className="mt-0.5 truncate text-[11px] text-[#9098a4]">{project}</p>
                  </div>
                  <span className="rounded-lg bg-[#f1f0ed] px-2 py-1 text-[10px] font-semibold tracking-[0.03em] text-[#5a606b] dark:bg-white/10 dark:text-[#c0c5cc]">
                    {priority}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="flex items-end pb-2 lg:items-center lg:pb-0">
          <div className="w-full rounded-[18px] border border-[#e8e8e4] bg-white p-5 shadow-[0_24px_48px_-28px_rgba(15,17,21,.22)] dark:border-white/10 dark:bg-[#111214] sm:p-7 lg:ml-auto lg:max-w-[430px]">
            <div className="mb-6">
              <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Witaj z powrotem</h2>
              <p className="mt-2 text-[14px] leading-5 text-[#5a606b] dark:text-[#b0b5be]">
                Kontynuuj przez Google, żeby zsynchronizować swoje zadania i projekty.
              </p>
            </div>

            <div className="flex w-full flex-col items-center gap-4">
              <div className="relative h-[44px] w-full max-w-[320px]">
                {!googleError && (
                  <div className="absolute inset-0 z-0 animate-pulse rounded-lg bg-[#f1f0ed] dark:bg-white/5" />
                )}
                <div ref={buttonRef} className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-lg" />
              </div>

              {googleError && (
                <p className="text-center text-xs leading-5 text-red-500">
                  Nie udało się załadować biblioteki Google.<br />
                  Sprawdź połączenie z internetem lub AdBlocka.
                </p>
              )}
            </div>

            <div className="mt-7 border-t border-[#f1f0ed] pt-5 dark:border-white/10">
              <button
                type="button"
                onClick={() => setShowDebug(!showDebug)}
                className={`rounded-lg text-[12px] font-medium underline underline-offset-4 transition-colors hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:text-white ${!isLocalhost ? 'text-amber-600' : 'text-[#9098a4]'}`}
                aria-expanded={showDebug}
              >
                {showDebug ? 'Ukryj pomoc' : !isLocalhost ? 'Problem z logowaniem?' : 'Masz problem z błędem 400?'}
              </button>

              <div className={`grid transition-[grid-template-rows] duration-[280ms] ease ${showDebug ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                  <div className="mt-4 rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] p-4 text-left dark:border-white/10 dark:bg-white/5">
                    <p className="mb-2 text-[11px] font-semibold text-[#0f1115] dark:text-white">
                      {!isLocalhost ? 'Konfiguracja domeny' : 'Rozwiązanie błędu konfiguracji'}
                    </p>

                    {!isLocalhost && (
                      <p className="mb-2 text-[11px] leading-4 text-amber-600 dark:text-amber-400">
                        Wykryto domenę publiczną. Aby logowanie Google działało, dodaj ten adres w konsoli Google Cloud.
                      </p>
                    )}

                    <p className="mb-1 text-[11px] leading-4 text-[#5a606b] dark:text-[#b0b5be]">
                      Skopiuj poniższy adres dokładnie w takiej formie:
                    </p>

                    <code className="mb-3 block select-all break-all rounded-lg border border-[#e8e8e4] bg-white p-2 font-mono text-[10px] font-medium text-emerald-600 dark:border-white/10 dark:bg-black dark:text-emerald-400">
                      {currentOrigin}
                    </code>

                    <p className="text-[11px] leading-4 text-[#5a606b] dark:text-[#b0b5be]">
                      Wklej go w <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-[#0f1115] underline transition-colors hover:text-[#5a606b] dark:text-white dark:hover:text-[#c0c5cc]">Google Cloud Console</a>, w sekcji Authorized JavaScript origins.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
