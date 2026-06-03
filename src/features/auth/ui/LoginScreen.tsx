import { useEffect, useRef, useState } from 'react';
import { BrandMark } from '../../../shared/ui/BrandMark';

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
      <main className="mx-auto flex min-h-[100dvh] w-full max-w-xl flex-col items-center px-8 pb-10 pt-[14dvh] sm:px-10 sm:pt-[16dvh]">
        <section className="flex w-full flex-col items-center text-center">
          <div className="mb-8 flex items-center gap-3">
            <BrandMark markClassName="h-11 w-11" />
            <span className="text-[19px] font-semibold tracking-[-0.02em]">Minddley</span>
          </div>

          <div className="w-full">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
              Osobisty system pracy
            </p>
            <h1 className="mx-auto max-w-[11ch] text-[43px] font-semibold leading-[0.98] tracking-[-0.03em] sm:text-[58px]">
              Skup się na tym, co ważne.
            </h1>
            <p className="mx-auto mt-5 max-w-md text-[15px] leading-6 text-[#5a606b] dark:text-[#b0b5be] sm:text-base">
              Zadania, projekty i wiedza w jednym spokojnym miejscu. Zaloguj się, aby wrócić do swojego przepływu pracy.
            </p>
          </div>
        </section>

        <section className="mt-10 flex w-full flex-col items-center sm:mt-12">
          <div className="relative h-[44px] w-full max-w-[320px]">
            {!googleError && (
              <div className="absolute inset-0 z-0 animate-pulse rounded-lg bg-[#f1f0ed] dark:bg-white/5" />
            )}
            <div ref={buttonRef} className="relative z-10 flex h-full w-full items-center justify-center overflow-hidden rounded-lg" />
          </div>

          {googleError && (
            <p className="mt-4 text-center text-xs leading-5 text-red-500">
              Nie udało się załadować biblioteki Google.<br />
              Sprawdź połączenie z internetem lub AdBlocka.
            </p>
          )}

          <div className="mt-8 flex w-full max-w-[320px] flex-col items-center">
            <button
              type="button"
              onClick={() => setShowDebug(!showDebug)}
              className={`rounded-lg text-[12px] font-medium underline underline-offset-4 transition-colors hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:text-white ${!isLocalhost ? 'text-amber-600' : 'text-[#9098a4]'}`}
              aria-expanded={showDebug}
            >
              {showDebug ? 'Ukryj pomoc' : !isLocalhost ? 'Problem z logowaniem?' : 'Masz problem z błędem 400?'}
            </button>

            <div className={`grid w-full transition-[grid-template-rows] duration-[280ms] ease ${showDebug ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
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
        </section>
      </main>
    </div>
  );
}
