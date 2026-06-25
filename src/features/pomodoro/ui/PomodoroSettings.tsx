import { Bell, Play, RotateCcw, Volume2 } from 'lucide-react';
import {
  DEFAULT_POMODORO_SETTINGS,
  type PomodoroSettings as PomodoroSettingsValue,
} from '../model/pomodoroModel';
import { previewPomodoroSound } from '../model/pomodoroNotifications';
import { normalizePomodoroSettings } from '../model/pomodoroStorage';
import { TomatoIcon } from './TomatoIcon';

interface PomodoroSettingsProps {
  settings: PomodoroSettingsValue;
  onChange: (settings: PomodoroSettingsValue) => void;
}

const FIELDS: Array<{
  key: 'focusMinutes' | 'shortBreakMinutes' | 'longBreakMinutes' | 'sessionsBeforeLongBreak';
  label: string;
  description: string;
  suffix: string;
  min: number;
  max: number;
}> = [
  { key: 'focusMinutes', label: 'Czas skupienia', description: 'Jeden nieprzerwany blok głębokiej pracy.', suffix: 'min', min: 1, max: 180 },
  { key: 'shortBreakMinutes', label: 'Krótka przerwa', description: 'Odpoczynek pomiędzy blokami skupienia.', suffix: 'min', min: 1, max: 60 },
  { key: 'longBreakMinutes', label: 'Długa przerwa', description: 'Dłuższa regeneracja po pełnym cyklu.', suffix: 'min', min: 1, max: 120 },
  { key: 'sessionsBeforeLongBreak', label: 'Długa przerwa co', description: 'Liczba ukończonych bloków skupienia przed długą przerwą.', suffix: 'sesje', min: 2, max: 12 },
];

export function PomodoroSettings({ settings, onChange }: PomodoroSettingsProps) {
  const soundVolumePercent = Math.round(settings.soundVolume * 100);

  const updateNumber = (key: typeof FIELDS[number]['key'], value: string) => {
    if (value === '') return;
    onChange(normalizePomodoroSettings({ ...settings, [key]: Number(value) }));
  };

  const updateSoundVolume = (value: string) => {
    onChange(normalizePomodoroSettings({ ...settings, soundVolume: Number(value) / 100 }));
  };

  const playSoundPreview = (kind: 'focusComplete' | 'breakComplete') => {
    void previewPomodoroSound(kind, settings.soundVolume);
  };

  return (
    <div className="divide-y divide-[#f1f0ed] dark:divide-white/6">
      <section className="px-6 py-5">
        <div className="flex items-start justify-between gap-5">
          <div className="flex gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[oklch(0.96_0.03_25)] dark:bg-[oklch(0.62_0.18_25)]/12">
              <TomatoIcon className="h-7 w-7" />
            </div>
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Rytm pracy</p>
              <h3 className="mt-1 text-base font-semibold tracking-[-0.01em] text-[#0f1115] dark:text-white">Długość sesji Pomodoro</h3>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-[#5a606b] dark:text-gray-400">Ustawienia są zapisywane na tym urządzeniu. Aktywna sesja również przetrwa zamknięcie karty i odtworzy właściwy czas po powrocie.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onChange(DEFAULT_POMODORO_SETTINGS)}
            title="Przywróć ustawienia domyślne"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e8e8e4] text-[#9098a4] transition-[background-color,color,transform] duration-200 ease hover:-translate-y-px hover:bg-[#f7f7f4] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </section>

      <section className="grid gap-3 px-6 py-5 sm:grid-cols-2">
        {FIELDS.map(field => (
          <label key={field.key} className="rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] p-4 transition-[border-color,background-color] duration-200 ease focus-within:border-[#c9c9c3] focus-within:bg-white dark:border-white/8 dark:bg-white/[0.03] dark:focus-within:border-white/20 dark:focus-within:bg-white/[0.05]">
            <span className="block text-sm font-semibold text-[#0f1115] dark:text-white">{field.label}</span>
            <span className="mt-0.5 block min-h-9 text-[12px] leading-snug text-[#9098a4]">{field.description}</span>
            <span className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={field.min}
                max={field.max}
                value={settings[field.key]}
                onChange={event => updateNumber(field.key, event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm font-semibold tabular-nums text-[#0f1115] outline-none transition-[border-color,box-shadow] duration-200 ease focus:border-[#aeb1b5] focus:ring-2 focus:ring-[#0f1115]/8 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:border-white/25 dark:focus:ring-white/10"
              />
              <span className="w-12 text-[12px] font-medium text-[#9098a4]">{field.suffix}</span>
            </span>
          </label>
        ))}
      </section>

      <section className="px-6 py-5">
        <div className="rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] p-4 transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f1f0ed] text-[#5a606b] dark:bg-white/8 dark:text-gray-300">
                <Bell size={18} />
              </div>
              <div>
                <p className="text-sm font-semibold text-[#0f1115] dark:text-white">Dźwięki zakończenia sesji</p>
                <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-[#5a606b] dark:text-gray-400">
                  Koniec skupienia gra dłuższym, spokojnym dzwonem. Koniec przerwy sygnalizują dwa krótkie dzwonki.
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={() => playSoundPreview('focusComplete')}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e8e8e4] bg-white px-3 text-[12.5px] font-semibold text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:border-[#d9d9d4] hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] focus:ring-offset-2 focus:ring-offset-[#fcfcfa] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E]"
              >
                <Play size={14} fill="currentColor" /> Skupienie
              </button>
              <button
                type="button"
                onClick={() => playSoundPreview('breakComplete')}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#e8e8e4] bg-white px-3 text-[12.5px] font-semibold text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:border-[#d9d9d4] hover:bg-[#f7f7f4] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] focus:ring-offset-2 focus:ring-offset-[#fcfcfa] dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E]"
              >
                <Play size={14} fill="currentColor" /> Przerwa
              </button>
            </div>
          </div>

          <label className="mt-5 block">
            <span className="flex items-center justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
              <span className="flex items-center gap-1.5"><Volume2 size={14} /> Głośność</span>
              <span className="tabular-nums text-[#5a606b] dark:text-gray-300">{soundVolumePercent}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="100"
              step="1"
              value={soundVolumePercent}
              onChange={event => updateSoundVolume(event.target.value)}
              aria-label="Głośność dźwięków Pomodoro"
              className="mt-3 h-2 w-full cursor-pointer accent-[#0f1115] transition-opacity duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 focus:ring-offset-2 focus:ring-offset-[#fcfcfa] dark:accent-white dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E]"
            />
          </label>
        </div>
      </section>

      <section className="px-6 py-5">
        <div className="flex items-center justify-between gap-5 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-4 py-4 transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03]">
          <div>
            <p className="text-sm font-semibold text-[#0f1115] dark:text-white">Automatycznie uruchamiaj kolejną sesję</p>
            <p className="mt-1 max-w-lg text-[12.5px] leading-relaxed text-[#5a606b] dark:text-gray-400">Po sygnale końca skupienia lub przerwy licznik przejdzie dalej bez dodatkowego kliknięcia.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.autoStartNextSession}
            onClick={() => onChange({ ...settings, autoStartNextSession: !settings.autoStartNextSession })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 focus:ring-offset-2 focus:ring-offset-white dark:focus:ring-white/20 dark:focus:ring-offset-[#1C1C1E] ${settings.autoStartNextSession ? 'bg-[#0f1115] dark:bg-[#f7f7f4]' : 'bg-[#c0c5cc] dark:bg-white/15'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ease dark:bg-[#18181B] ${settings.autoStartNextSession ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
        </div>
      </section>
    </div>
  );
}
