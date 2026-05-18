import { useEffect, useRef, useState } from 'react';

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
    <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-[#000000]">
      <div className="w-full max-w-md p-8 animate-fade-in flex flex-col items-center">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-gray-900 dark:bg-white rounded-2xl flex items-center justify-center text-white dark:text-black font-bold text-3xl mx-auto mb-6 shadow-lg shadow-gray-200 dark:shadow-none">
            M
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            MindFlow
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Zaloguj się, aby uzyskać dostęp do swojego osobistego asystenta.
          </p>
        </div>

        <div className="flex flex-col items-center space-y-4 w-full">
          <div className="relative w-[280px] h-[44px]">
            {!googleError && (
              <div className="absolute top-0 left-0 w-full h-full bg-gray-100 dark:bg-white/5 rounded-full animate-pulse z-0"></div>
            )}
            <div ref={buttonRef} className="relative z-10 w-full h-full flex justify-center items-center overflow-hidden rounded-full"></div>
          </div>

          {googleError && (
            <p className="text-xs text-red-500 mt-2 text-center px-4">
              Nie udało się załadować biblioteki Google.<br />
              Sprawdź połączenie z internetem lub AdBlocka.
            </p>
          )}
        </div>

        {/* Debug / Help Section */}
        <div className="mt-12 w-full max-w-[280px] flex flex-col items-center">
          <button
            onClick={() => setShowDebug(!showDebug)}
            className={`text-[10px] hover:text-gray-600 dark:hover:text-gray-300 underline transition-colors ${!isLocalhost ? 'text-amber-600 font-bold' : 'text-gray-400 dark:text-gray-500'}`}
          >
            {showDebug ? 'Ukryj pomoc' : !isLocalhost ? 'Problem z logowaniem?' : 'Masz problem z błędem 400?'}
          </button>

          {showDebug && (
            <div className="mt-4 p-4 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-200 dark:border-white/10 text-left w-full shadow-sm animate-fade-in">
              <p className="text-[10px] font-bold text-gray-800 dark:text-gray-200 mb-2">
                {!isLocalhost ? "Konfiguracja Domeny:" : "Rozwiązanie błędu konfiguracji:"}
              </p>

              {!isLocalhost && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 mb-2 leading-tight">
                  Wykryto domenę publiczną. Aby logowanie Google działało, musisz dodać ten adres w konsoli Google Cloud.
                </p>
              )}

              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-1">
                Skopiuj poniższy adres <b>dokładnie</b> w takiej formie:
              </p>

              <code className="block bg-white dark:bg-black border border-gray-200 dark:border-white/10 p-2 rounded text-[10px] text-emerald-600 dark:text-emerald-400 break-all select-all font-mono mb-3 font-medium">
                {currentOrigin}
              </code>

              <p className="text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                I wklej go w <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noreferrer" className="text-blue-500 hover:underline">Google Cloud Console</a> w sekcji:
                <br />
                <i>Authorized JavaScript origins</i>
              </p>

              <ul className="text-[9px] text-gray-400 dark:text-gray-500 list-disc pl-3 space-y-1 leading-relaxed">
                <li>Upewnij się, że na końcu adresu <b>nie ma</b> znaku <code className="bg-gray-200 dark:bg-white/10 px-1 rounded">/</code>.</li>
                <li>Jeśli dopiero dodałeś adres, odczekaj <b>5-10 minut</b> na odświeżenie serwerów Google.</li>
              </ul>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
