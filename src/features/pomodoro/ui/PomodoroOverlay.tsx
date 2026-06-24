import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import {
  formatPomodoroTime,
  POMODORO_PHASE_META,
  type PomodoroLaunchRequest,
  type PomodoroPhase,
  type PomodoroSettings,
} from '../model/pomodoroModel';
import { usePomodoroTimer } from '../model/usePomodoroTimer';
import { usePomodoroRemainingSeconds } from '../model/usePomodoroRemainingSeconds';
import { TomatoIcon } from './TomatoIcon';

interface PomodoroOverlayProps {
  settings: PomodoroSettings;
  launchRequest: PomodoroLaunchRequest | null;
}

function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} min`;
}

function phaseDotClass(phase: PomodoroPhase, active: boolean) {
  if (phase === 'focus') return active ? 'bg-[oklch(0.62_0.18_25)]' : 'bg-[oklch(0.62_0.18_25)]/45';
  if (phase === 'longBreak') return active ? 'bg-[#0f1115] dark:bg-white' : 'bg-[#9098a4]/45';
  return active ? 'bg-[#9098a4]' : 'bg-[#c0c5cc]/60';
}

interface PomodoroClockProps {
  endsAt: string | null;
  fallbackSeconds: number;
  isComplete: boolean;
  isRunning: boolean;
  phase: PomodoroPhase;
  totalSeconds: number;
}

function PomodoroClock({
  endsAt,
  fallbackSeconds,
  isComplete,
  isRunning,
  phase,
  totalSeconds,
}: PomodoroClockProps) {
  const remainingSeconds = usePomodoroRemainingSeconds({
    endsAt,
    fallbackSeconds,
    isRunning,
    precision: 'second',
  });
  const progress = totalSeconds > 0
    ? Math.min(1, Math.max(0, 1 - remainingSeconds / totalSeconds))
    : 1;
  const radius = 126;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="relative flex h-[min(34vh,320px)] w-[min(34vh,320px)] min-h-[250px] min-w-[250px] items-center justify-center">
      <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 300 300" aria-hidden="true">
        <circle cx="150" cy="150" r={radius} fill="none" stroke="currentColor" strokeWidth="7" className="text-[#e8e8e4] dark:text-white/8" />
        <circle
          cx="150"
          cy="150"
          r={radius}
          fill="none"
          stroke="oklch(0.62 0.18 25)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          className="transition-[stroke-dashoffset] duration-200 ease"
        />
      </svg>
      <div className="relative flex flex-col items-center text-center">
        <TomatoIcon className="mb-2 h-10 w-10" />
        <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9098a4]">{isComplete ? 'Gotowe' : POMODORO_PHASE_META[phase].label}</span>
        <span className="mt-1 text-[clamp(3.4rem,6vw,5.6rem)] font-semibold leading-none tracking-[-0.06em] tabular-nums text-[#0f1115] dark:text-white">{formatPomodoroTime(remainingSeconds)}</span>
        <span className="mt-2 text-[12px] font-medium text-[#9098a4]">
          {isComplete ? 'Plan na ten blok został ukończony' : isRunning ? 'Sesja trwa' : 'Gotowe do startu'}
        </span>
      </div>
    </div>
  );
}

function PomodoroMiniTime({ endsAt, fallbackSeconds, isRunning }: Pick<PomodoroClockProps, 'endsAt' | 'fallbackSeconds' | 'isRunning'>) {
  const remainingSeconds = usePomodoroRemainingSeconds({
    endsAt,
    fallbackSeconds,
    isRunning,
    precision: 'minute',
  });

  return <>{Math.max(0, Math.ceil(remainingSeconds / 60))} min</>;
}

export function PomodoroOverlay({ settings, launchRequest }: PomodoroOverlayProps) {
  const { session, start, pause, resetPhase, skip, setMinimized, stop } = usePomodoroTimer(settings, launchRequest);

  const activeSettings = session?.settings ?? settings;
  const fallbackSchedule = useMemo(() => {
    const items: Array<{ phase: PomodoroPhase; durationSeconds: number }> = [];
    for (let index = 0; index < activeSettings.sessionsBeforeLongBreak; index += 1) {
      items.push({ phase: 'focus', durationSeconds: activeSettings.focusMinutes * 60 });
      items.push({
        phase: index === activeSettings.sessionsBeforeLongBreak - 1 ? 'longBreak' : 'shortBreak',
        durationSeconds: (index === activeSettings.sessionsBeforeLongBreak - 1 ? activeSettings.longBreakMinutes : activeSettings.shortBreakMinutes) * 60,
      });
    }
    return items;
  }, [activeSettings.focusMinutes, activeSettings.longBreakMinutes, activeSettings.sessionsBeforeLongBreak, activeSettings.shortBreakMinutes]);

  if (!session) return null;

  const visibleSchedule = session.schedule ?? fallbackSchedule.map((item, index) => ({
    ...item,
    id: `fallback-${index}`,
    startsAt: '',
    endsAt: '',
  }));
  const scheduleTitle = session.schedule ? 'Do końca zadania' : 'Twój cykl';
  const taskEndLabel = session.taskEndsAt
    ? new Date(session.taskEndsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : null;

  const handleStop = () => {
    if (!session.isComplete && !window.confirm('Zakończyć bieżącą sesję Pomodoro?')) return;
    stop();
  };

  const miniWidget = (
    <button
      type="button"
      onClick={() => setMinimized(false)}
      aria-label="Rozwiń Pomodoro"
      className="fixed bottom-[218px] right-0 z-[48] flex transform-none items-center gap-2 rounded-l-xl border border-r-0 border-[#e8e8e4] bg-white/95 px-3 py-2.5 shadow-[0_10px_28px_-14px_rgba(15,17,21,.3)] backdrop-blur transition-[background-color,box-shadow] duration-200 ease hover:transform-none hover:bg-[#f7f7f4] hover:shadow-[0_12px_30px_-14px_rgba(15,17,21,.38)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.18_25)]/25 max-lg:bottom-24 dark:border-white/10 dark:border-r-0 dark:bg-[#1C1C1E]/95 dark:hover:bg-[#27272A]"
    >
      <TomatoIcon className="h-5 w-5" />
      <span className="tabular-nums text-[12px] font-semibold text-[#0f1115] dark:text-white">
        <PomodoroMiniTime
          endsAt={session.endsAt}
          fallbackSeconds={session.remainingSeconds}
          isRunning={session.isRunning}
        />
      </span>
    </button>
  );

  const modal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1115]/20 p-4 backdrop-blur-md transition-opacity duration-200 ease"
      onPointerDown={event => {
        if (event.target === event.currentTarget) setMinimized(true);
      }}
      role="presentation"
    >
      <section
        key={`${session.id}-${session.isMinimized ? 'mini' : 'open'}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pomodoro-title"
        className="animate-pomodoro-open flex h-[min(68vh,720px)] min-h-[520px] w-[min(62vw,1120px)] min-w-[760px] overflow-hidden rounded-[18px] border border-white/40 bg-[#f7f7f4]/96 shadow-[0_32px_80px_-22px_rgba(15,17,21,.42)] backdrop-blur-xl max-lg:h-[calc(100vh-2rem)] max-lg:min-h-0 max-lg:w-[calc(100vw-2rem)] max-lg:min-w-0 max-lg:flex-col dark:border-white/10 dark:bg-[#18181B]/96"
        onPointerDown={event => event.stopPropagation()}
      >
        <div className="relative flex min-w-0 flex-[1.45] flex-col p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                <TomatoIcon className="h-4 w-4" /> Pomodoro
              </div>
              <h2 id="pomodoro-title" className="truncate text-xl font-semibold tracking-[-0.02em] text-[#0f1115] sm:text-2xl dark:text-white">{session.title}</h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setMinimized(true)}
                title="Minimalizuj"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9098a4] transition-[background-color,color] duration-200 ease hover:bg-[#ecece8] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
              >
                <Minimize2 size={17} />
              </button>
              <button
                type="button"
                onClick={handleStop}
                title="Zakończ sesję"
                className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9098a4] transition-[background-color,color] duration-200 ease hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:hover:bg-red-500/10 dark:hover:text-red-300"
              >
                <Square size={15} />
              </button>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
            <PomodoroClock
              endsAt={session.endsAt}
              fallbackSeconds={session.remainingSeconds}
              isComplete={session.isComplete}
              isRunning={session.isRunning}
              phase={session.phase}
              totalSeconds={session.totalSeconds}
            />
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={resetPhase}
              disabled={session.isComplete}
              title="Zacznij etap od nowa"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e8e4] bg-white text-[#5a606b] transition-[background-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
            >
              <RotateCcw size={17} />
            </button>
            <button
              type="button"
              onClick={session.isRunning ? pause : start}
              disabled={session.isComplete}
              className="flex h-12 min-w-[132px] items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#2b2e33] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/25 focus:ring-offset-2 focus:ring-offset-[#f7f7f4] disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#f7f7f4] dark:text-[#18181B] dark:hover:bg-white dark:focus:ring-white/20 dark:focus:ring-offset-[#18181B]"
            >
              {session.isRunning ? <Pause size={17} fill="currentColor" /> : <Play size={17} fill="currentColor" />}
              {session.isRunning ? 'Pauza' : 'Start'}
            </button>
            <button
              type="button"
              onClick={skip}
              disabled={session.isComplete}
              title="Pomiń etap"
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-[#e8e8e4] bg-white text-[#5a606b] transition-[background-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
            >
              <SkipForward size={17} fill="currentColor" />
            </button>
          </div>
        </div>

        <aside className="flex w-[36%] min-w-[290px] flex-col border-l border-[#e8e8e4] bg-white/75 p-6 max-lg:min-h-0 max-lg:w-full max-lg:min-w-0 max-lg:flex-1 max-lg:border-l-0 max-lg:border-t dark:border-white/8 dark:bg-white/[0.025]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Harmonogram</p>
              <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">{scheduleTitle}</h3>
            </div>
            {taskEndLabel && <span className="rounded-lg bg-[#f1f0ed] px-2.5 py-1.5 text-[12px] font-semibold tabular-nums text-[#5a606b] dark:bg-white/8 dark:text-gray-300">do {taskEndLabel}</span>}
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <div className="relative space-y-1.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-[#e8e8e4] dark:before:bg-white/10">
              {visibleSchedule.map((item, index) => {
                const active = index === session.scheduleIndex && !session.isComplete;
                const complete = index < session.scheduleIndex || session.isComplete;
                return (
                  <div
                    key={item.id}
                    className={`relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 ease ${active ? 'bg-[#f7f7f4] dark:bg-white/[0.06]' : 'hover:bg-[#f7f7f4]/70 dark:hover:bg-white/[0.035]'}`}
                  >
                    <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-4 border-white transition-colors duration-200 ease dark:border-[#1b1b1e] ${phaseDotClass(item.phase, active || complete)}`}>
                      {complete && <span className="h-1.5 w-1.5 rounded-full bg-white dark:bg-[#18181B]" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[13px] font-semibold ${active ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}>{POMODORO_PHASE_META[item.phase].label}</span>
                      <span className="mt-0.5 block text-[11px] font-medium text-[#9098a4]">{item.phase === 'focus' ? `Sesja ${Math.floor(index / 2) + 1}` : 'Regeneracja'}</span>
                    </span>
                    <span className="shrink-0 text-[12px] font-semibold tabular-nums text-[#9098a4]">{durationLabel(item.durationSeconds)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-3.5 py-3 text-[12px] leading-relaxed text-[#5a606b] dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-400">
            {session.schedule
              ? `${visibleSchedule.filter(item => item.phase === 'focus').length} bloków skupienia i ${visibleSchedule.filter(item => item.phase !== 'focus').length} przerw mieszczą się w pozostałym czasie zadania.`
              : `Długa przerwa uruchamia się po ${session.settings.sessionsBeforeLongBreak} sesjach skupienia.`}
          </div>
        </aside>
      </section>
    </div>
  );

  return createPortal(session.isMinimized ? miniWidget : modal, document.body);
}
