import { useCallback, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Minimize2, Pause, Play, RotateCcw, SkipForward, Square } from 'lucide-react';
import {
  buildFocusSessionSchedule,
  formatPomodoroTime,
  POMODORO_PHASE_META,
  type PomodoroLaunchRequest,
  type PomodoroPhase,
  type PomodoroScheduleItem,
  type PomodoroSettings,
} from '../model/pomodoroModel';
import { usePomodoroTimer } from '../model/usePomodoroTimer';
import { usePomodoroRemainingSeconds } from '../model/usePomodoroRemainingSeconds';
import { TomatoIcon } from './TomatoIcon';
import { useConfirmDialog } from '../../../shared/ui/confirmDialog';

interface PomodoroOverlayProps {
  settings: PomodoroSettings;
  launchRequest: PomodoroLaunchRequest | null;
}

function durationLabel(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `${minutes} min`;
}

function boundedFocusSessionCount(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(24, Math.max(1, Math.round(value)));
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function timeRangeLabel(item: PomodoroScheduleItem) {
  const startsAt = timeLabel(item.startsAt);
  const endsAt = timeLabel(item.endsAt);
  if (!startsAt || !endsAt) return null;
  return `${startsAt}–${endsAt}`;
}

function focusSessionsLabel(count: number) {
  if (count === 1) return 'sesję skupienia';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return 'sesje skupienia';
  return 'sesji skupienia';
}

function breaksLabel(count: number) {
  if (count === 1) return 'przerwę';
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) return 'przerwy';
  return 'przerw';
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
  const { confirm } = useConfirmDialog();
  const confirmReplaceSession = useCallback(() => confirm({
    title: 'Rozpocząć nową sesję?',
    message: 'Masz już aktywną sesję Pomodoro. Nowa sesja zastąpi aktualny cykl.',
    confirmLabel: 'Rozpocznij nową',
    tone: 'danger',
  }), [confirm]);
  const { session, start, pause, resetPhase, skip, startGlobalCycle, setMinimized, stop } = usePomodoroTimer(settings, launchRequest, confirmReplaceSession);
  const [isGlobalPlannerOpen, setIsGlobalPlannerOpen] = useState(false);
  const [globalFocusSessionCount, setGlobalFocusSessionCount] = useState(1);
  const [globalPlannerAnchorMs, setGlobalPlannerAnchorMs] = useState(() => Date.now());

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

  const globalPlanSchedule = useMemo(
    () => buildFocusSessionSchedule(globalFocusSessionCount, settings, globalPlannerAnchorMs),
    [globalFocusSessionCount, globalPlannerAnchorMs, settings],
  );

  const openGlobalPlanner = useCallback(() => {
    setGlobalPlannerAnchorMs(Date.now());
    setIsGlobalPlannerOpen(true);
  }, []);

  const updateGlobalFocusSessionCount = (value: string) => {
    if (value === '') return;
    setGlobalFocusSessionCount(boundedFocusSessionCount(Number(value)));
  };

  const handleStartGlobalCycle = () => {
    startGlobalCycle(globalFocusSessionCount);
    setIsGlobalPlannerOpen(false);
  };

  const idleLauncher = (
    <button
      type="button"
      onClick={openGlobalPlanner}
      aria-label="Otwórz Pomodoro"
      title="Pomodoro"
      className="fixed bottom-[218px] right-0 z-[48] flex h-11 w-12 transform-none items-center justify-center rounded-l-xl border border-r-0 border-[#e8e8e4] bg-white/95 shadow-[0_10px_28px_-14px_rgba(15,17,21,.3)] backdrop-blur transition-[background-color,box-shadow] duration-200 ease hover:transform-none hover:bg-[#f7f7f4] hover:shadow-[0_12px_30px_-14px_rgba(15,17,21,.38)] focus:outline-none focus:ring-2 focus:ring-[oklch(0.62_0.18_25)]/25 max-lg:bottom-24 dark:border-white/10 dark:border-r-0 dark:bg-[#1C1C1E]/95 dark:hover:bg-[#27272A]"
    >
      <TomatoIcon className="h-5 w-5" />
    </button>
  );

  const globalPlanStartsAt = globalPlanSchedule[0] ? timeLabel(globalPlanSchedule[0].startsAt) : null;
  const globalPlanEndsAt = globalPlanSchedule.length > 0 ? timeLabel(globalPlanSchedule[globalPlanSchedule.length - 1].endsAt) : null;
  const globalPlanBreakCount = globalPlanSchedule.filter(item => item.phase !== 'focus').length;
  const globalPlanTotalMinutes = Math.ceil(globalPlanSchedule.reduce((sum, item) => sum + item.durationSeconds, 0) / 60);

  const globalPlannerModal = (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f1115]/20 p-4 backdrop-blur-md transition-opacity duration-200 ease"
      onPointerDown={event => {
        if (event.target === event.currentTarget) setIsGlobalPlannerOpen(false);
      }}
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="pomodoro-global-title"
        className="animate-pomodoro-open flex h-[min(68vh,720px)] min-h-[520px] w-[min(62vw,1120px)] min-w-[760px] overflow-hidden rounded-[18px] border border-white/40 bg-[#f7f7f4]/96 shadow-[0_32px_80px_-22px_rgba(15,17,21,.42)] backdrop-blur-xl max-lg:h-[calc(100vh-2rem)] max-lg:min-h-0 max-lg:w-[calc(100vw-2rem)] max-lg:min-w-0 max-lg:flex-col dark:border-white/10 dark:bg-[#18181B]/96"
        onPointerDown={event => event.stopPropagation()}
      >
        <div className="relative flex min-w-0 flex-[1.45] flex-col p-6 sm:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                <TomatoIcon className="h-4 w-4" /> Pomodoro
              </div>
              <h2 id="pomodoro-global-title" className="truncate text-xl font-semibold tracking-[-0.02em] text-[#0f1115] sm:text-2xl dark:text-white">Globalne skupienie</h2>
              <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Uruchom Pomodoro bez przypisywania go do konkretnego zadania.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsGlobalPlannerOpen(false)}
              title="Minimalizuj"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[#9098a4] transition-[background-color,color] duration-200 ease hover:bg-[#ecece8] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
            >
              <Minimize2 size={17} />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col items-center justify-center py-4">
            <div className="relative flex h-[min(34vh,320px)] w-[min(34vh,320px)] min-h-[250px] min-w-[250px] items-center justify-center rounded-full border border-[#e8e8e4] bg-white/60 shadow-[inset_0_0_0_8px_rgba(241,240,237,.7)] dark:border-white/8 dark:bg-white/[0.035] dark:shadow-[inset_0_0_0_8px_rgba(255,255,255,.035)]">
              <div className="relative flex flex-col items-center text-center">
                <TomatoIcon className="mb-3 h-12 w-12" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#9098a4]">Gotowe do startu</span>
                <span className="mt-2 text-[clamp(3.4rem,6vw,5.6rem)] font-semibold leading-none tracking-[-0.06em] tabular-nums text-[#0f1115] dark:text-white">{settings.focusMinutes}</span>
                <span className="mt-2 text-[12px] font-medium text-[#9098a4]">minut jednej sesji skupienia</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setIsGlobalPlannerOpen(false)}
              className="flex h-11 items-center justify-center rounded-xl border border-[#e8e8e4] bg-white px-4 text-sm font-semibold text-[#5a606b] transition-[background-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#f1f0ed] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8 dark:hover:text-white dark:focus:ring-white/15"
            >
              Anuluj
            </button>
            <button
              type="button"
              onClick={handleStartGlobalCycle}
              className="flex h-12 min-w-[150px] items-center justify-center gap-2 rounded-xl bg-[#0f1115] px-5 text-sm font-semibold text-white shadow-sm transition-[background-color,transform,opacity] duration-200 ease hover:-translate-y-px hover:bg-[#2b2e33] focus:outline-none focus:ring-2 focus:ring-[#0f1115]/25 focus:ring-offset-2 focus:ring-offset-[#f7f7f4] dark:bg-[#f7f7f4] dark:text-[#18181B] dark:hover:bg-white dark:focus:ring-white/20 dark:focus:ring-offset-[#18181B]"
            >
              <Play size={17} fill="currentColor" /> Start cyklu
            </button>
          </div>
        </div>

        <aside className="flex w-[36%] min-w-[290px] flex-col border-l border-[#e8e8e4] bg-white/75 p-6 max-lg:min-h-0 max-lg:w-full max-lg:min-w-0 max-lg:flex-1 max-lg:border-l-0 max-lg:border-t dark:border-white/8 dark:bg-white/[0.025]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Plan cyklu</p>
            <h3 className="mt-1 text-lg font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">Sesje skupienia</h3>
          </div>

          <label className="mt-5 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] p-4 transition-[border-color,background-color] duration-200 ease focus-within:border-[#c9c9c3] focus-within:bg-white dark:border-white/8 dark:bg-white/[0.03] dark:focus-within:border-white/20 dark:focus-within:bg-white/[0.05]">
            <span className="block text-sm font-semibold text-[#0f1115] dark:text-white">Ile sesji skupienia?</span>
            <span className="mt-0.5 block text-[12px] leading-snug text-[#9098a4]">Przerwy zostaną dodane pomiędzy sesjami zgodnie z ustawieniami Pomodoro.</span>
            <span className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={24}
                value={globalFocusSessionCount}
                onChange={event => updateGlobalFocusSessionCount(event.target.value)}
                className="h-10 min-w-0 flex-1 rounded-lg border border-[#e8e8e4] bg-white px-3 text-sm font-semibold tabular-nums text-[#0f1115] outline-none transition-[border-color,box-shadow] duration-200 ease focus:border-[#aeb1b5] focus:ring-2 focus:ring-[#0f1115]/8 dark:border-white/10 dark:bg-[#27272A] dark:text-white dark:focus:border-white/25 dark:focus:ring-white/10"
              />
              <span className="w-12 text-[12px] font-medium text-[#9098a4]">sesje</span>
            </span>
          </label>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Start</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[#0f1115] dark:text-white">{globalPlanStartsAt ?? '—'}</p>
            </div>
            <div className="rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-3 py-2.5 dark:border-white/8 dark:bg-white/[0.03]">
              <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Koniec</p>
              <p className="mt-1 text-sm font-semibold tabular-nums text-[#0f1115] dark:text-white">{globalPlanEndsAt ?? '—'}</p>
            </div>
          </div>

          <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            <div className="relative space-y-1.5 before:absolute before:bottom-4 before:left-[15px] before:top-4 before:w-px before:bg-[#e8e8e4] dark:before:bg-white/10">
              {globalPlanSchedule.map((item, index) => (
                <div
                  key={item.id}
                  className={`relative flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors duration-200 ease ${index === 0 ? 'bg-[#f7f7f4] dark:bg-white/[0.06]' : 'hover:bg-[#f7f7f4]/70 dark:hover:bg-white/[0.035]'}`}
                >
                  <span className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-4 border-white transition-colors duration-200 ease dark:border-[#1b1b1e] ${phaseDotClass(item.phase, index === 0)}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[13px] font-semibold ${index === 0 ? 'text-[#0f1115] dark:text-white' : 'text-[#5a606b] dark:text-gray-300'}`}>{POMODORO_PHASE_META[item.phase].label}</span>
                    <span className="mt-0.5 block text-[11px] font-medium text-[#9098a4]">{item.phase === 'focus' ? `Sesja ${Math.floor(index / 2) + 1}` : 'Regeneracja'}</span>
                  </span>
                  <span className="shrink-0 text-right text-[12px] font-semibold tabular-nums text-[#9098a4]">
                    <span className="block">{timeRangeLabel(item)}</span>
                    <span className="block text-[11px] font-medium">{durationLabel(item.durationSeconds)}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-3.5 py-3 text-[12px] leading-relaxed text-[#5a606b] dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-400">
            Plan obejmuje {globalFocusSessionCount} {focusSessionsLabel(globalFocusSessionCount)}, {globalPlanBreakCount} {breaksLabel(globalPlanBreakCount)} i potrwa około {globalPlanTotalMinutes} min.
          </div>
        </aside>
      </section>
    </div>
  );

  if (!session) return createPortal(isGlobalPlannerOpen ? globalPlannerModal : idleLauncher, document.body);

  const visibleSchedule = session.schedule ?? fallbackSchedule.map((item, index) => ({
    ...item,
    id: `fallback-${index}`,
    startsAt: '',
    endsAt: '',
  }));
  const scheduleTitle = session.taskEndsAt ? 'Do końca zadania' : 'Twój cykl';
  const taskEndLabel = session.taskEndsAt
    ? new Date(session.taskEndsAt).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
    : null;
  const visibleFocusSessionsCount = visibleSchedule.filter(item => item.phase === 'focus').length;
  const visibleBreaksCount = visibleSchedule.filter(item => item.phase !== 'focus').length;

  const handleStop = async () => {
    if (!session.isComplete) {
      const confirmed = await confirm({
        title: 'Przerwać cykl Pomodoro?',
        message: 'Aktualna sesja zostanie zakończona. Tej akcji nie da się cofnąć.',
        confirmLabel: 'Przerwij cykl',
        tone: 'danger',
      });
      if (!confirmed) return;
    }
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
                title="Zakończ cykl"
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#f3d4d4] bg-[#fff8f8] px-3 text-[12px] font-semibold text-[#b93838] transition-[background-color,border-color,color] duration-200 ease hover:border-[#efc3c3] hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-red-500/20 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30"
              >
                <Square size={13} /> Zakończ cykl
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
            {session.taskEndsAt
              ? `${visibleFocusSessionsCount} bloków skupienia i ${visibleBreaksCount} przerw mieszczą się w pozostałym czasie zadania.`
              : session.schedule
                ? `Ten cykl obejmuje ${visibleFocusSessionsCount} ${focusSessionsLabel(visibleFocusSessionsCount)} i ${visibleBreaksCount} ${breaksLabel(visibleBreaksCount)}.`
                : `Długa przerwa uruchamia się po ${session.settings.sessionsBeforeLongBreak} sesjach skupienia.`}
          </div>
        </aside>
      </section>
    </div>
  );

  return createPortal(session.isMinimized ? miniWidget : modal, document.body);
}
