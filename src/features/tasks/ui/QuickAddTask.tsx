import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowUp, CalendarDays, Check, Folder, Plus, X } from 'lucide-react';
import type { Project } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';

interface Props {
  activeProjectId: string | null;
  projects: Project[];
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../../../shared/types').TaskStatus, description?: string) => unknown | Promise<unknown>;
}

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  [TaskPriority.P1]: 'text-red-500',
  [TaskPriority.P2]: 'text-amber-500',
  [TaskPriority.P3]: 'text-blue-500',
  [TaskPriority.P4]: 'text-gray-300 dark:text-gray-500',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  [TaskPriority.P1]: 'Priorytet 1',
  [TaskPriority.P2]: 'Priorytet 2',
  [TaskPriority.P3]: 'Priorytet 3',
  [TaskPriority.P4]: 'Priorytet 4',
};

function formatQuickDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return 'Termin';

  return new Intl.DateTimeFormat('pl-PL', {
    day: 'numeric',
    month: 'short',
    ...(year !== new Date().getFullYear() ? { year: 'numeric' } : {}),
  }).format(new Date(year, month - 1, day));
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  );
}

export function QuickAddTask({ activeProjectId, projects, onAdd }: Props) {
  const [value, setValue] = useState('');
  const [priority, setPriority] = useState<TaskPriority>(TaskPriority.P4);
  const [dueDate, setDueDate] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(activeProjectId);
  const [showPicker, setShowPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const desktopInputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const desktopPickerRef = useRef<HTMLDivElement>(null);
  const mobilePickerRef = useRef<HTMLDivElement>(null);
  const mobileProjectPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker && !showProjectPicker) return;
    const handler = (event: MouseEvent) => {
      if (
        !desktopPickerRef.current?.contains(event.target as Node)
        && !mobilePickerRef.current?.contains(event.target as Node)
        && !mobileProjectPickerRef.current?.contains(event.target as Node)
      ) {
        setShowPicker(false);
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker, showProjectPicker]);

  useEffect(() => {
    if (!mobileOpen) return;
    const frame = window.requestAnimationFrame(() => mobileInputRef.current?.focus());
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false);
        setShowPicker(false);
        setShowProjectPicker(false);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileOpen]);

  const activeProject = activeProjectId ? projects.find(project => project.id === activeProjectId) : null;
  const selectedProject = selectedProjectId ? projects.find(project => project.id === selectedProjectId) : null;

  const handleSubmit = async (source: 'desktop' | 'mobile') => {
    if (!value.trim() || isSaving) return;
    setError(null);
    setIsSaving(true);
    try {
      await onAdd(
        value.trim(),
        priority,
        source === 'mobile' && dueDate ? dueDate : undefined,
        source === 'mobile' ? selectedProjectId ?? '' : activeProjectId ?? undefined,
      );
      setValue('');
      setPriority(TaskPriority.P4);
      setDueDate('');
      setSelectedProjectId(activeProjectId);
      setShowPicker(false);
      setShowProjectPicker(false);
      if (source === 'mobile') {
        setMobileOpen(false);
      } else {
        desktopInputRef.current?.focus();
      }
    } catch (error) {
      console.warn('Failed to quickly add task:', error);
      setError('Nie udało się dodać zadania. Spróbuj ponownie.');
    } finally {
      setIsSaving(false);
    }
  };

  return createPortal(
    <>
      <div className="pointer-events-none fixed bottom-4 left-[220px] right-0 z-40 hidden px-6 lg:block">
        <div className="pointer-events-auto mx-auto max-w-3xl">
          <form
            onSubmit={(event) => { event.preventDefault(); void handleSubmit('desktop'); }}
            aria-busy={isSaving}
            className="relative flex items-center gap-2 rounded-xl border border-gray-200 bg-white/95 px-3 py-2 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-[#1C1C1E]/95"
          >
            {error && (
              <p role="alert" className="absolute inset-x-0 bottom-full mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 shadow-sm dark:bg-red-950/80 dark:text-red-300">
                {error}
              </p>
            )}
            <input
              ref={desktopInputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={isSaving}
              placeholder="Dodaj zadanie..."
              className="min-w-0 flex-1 bg-transparent text-sm text-gray-600 outline-none placeholder:text-gray-300 dark:text-gray-300 dark:placeholder:text-gray-600"
            />

            {activeProject && (
              <span
                className="inline-flex flex-none items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium"
                style={{
                  color: activeProject.color || '#9098a4',
                  background: (activeProject.color || '#9098a4') + '22',
                }}
              >
                <span className="h-1.5 w-1.5 flex-none rounded-full" style={{ background: activeProject.color || '#9098a4' }} />
                {activeProject.name}
              </span>
            )}

            <div ref={desktopPickerRef} className="relative flex-none">
              <button
                type="button"
                onClick={() => setShowPicker(!showPicker)}
                disabled={isSaving}
                title={PRIORITY_LABELS[priority]}
                className={`rounded-lg p-1.5 transition-colors ${showPicker ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
              >
                <FlagIcon className={`h-4 w-4 ${PRIORITY_COLORS[priority]}`} />
              </button>

              {showPicker && (
                <PriorityPicker priority={priority} onChange={setPriority} onClose={() => setShowPicker(false)} />
              )}
            </div>
          </form>
        </div>
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          aria-label="Dodaj zadanie"
          onClick={() => {
            setError(null);
            setSelectedProjectId(activeProjectId);
            setMobileOpen(true);
          }}
          className={`fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-4 z-40 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#0f1115] text-white shadow-[0_8px_24px_rgba(15,17,21,.22)] transition duration-200 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${mobileOpen ? 'pointer-events-none scale-90 opacity-0' : 'scale-100 opacity-100'}`}
        >
          <Plus size={23} strokeWidth={2.2} />
        </button>

        <button
          type="button"
          aria-label="Zamknij szybkie dodawanie"
          aria-hidden={!mobileOpen}
          tabIndex={mobileOpen ? 0 : -1}
          onClick={() => {
            setMobileOpen(false);
            setShowPicker(false);
            setShowProjectPicker(false);
            setError(null);
          }}
          className={`fixed inset-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-40 bg-[#0f1115]/10 backdrop-blur-[1px] transition-opacity duration-200 ${mobileOpen ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-0'}`}
        />

        <form
          onSubmit={(event) => { event.preventDefault(); void handleSubmit('mobile'); }}
          aria-hidden={!mobileOpen}
          aria-busy={isSaving}
          inert={!mobileOpen}
          className={`mf-mobile-form fixed inset-x-0 bottom-[calc(3.75rem+env(safe-area-inset-bottom))] z-[45] flex flex-col gap-1.5 border-t border-[#e8e8e4] bg-white px-3 py-2.5 shadow-[0_-12px_32px_rgba(15,17,21,.10)] transition-transform duration-200 ease dark:border-white/10 dark:bg-[#1C1C1E] ${mobileOpen ? 'translate-y-0' : 'pointer-events-none translate-y-[calc(100%+1px)]'}`}
        >
          {error && (
            <p role="alert" className="absolute inset-x-3 bottom-full mb-2 rounded-lg bg-red-50 px-3 py-2 text-[12px] font-medium text-red-600 shadow-sm dark:bg-red-950/80 dark:text-red-300">
              {error}
            </p>
          )}
          <div className="flex w-full items-center gap-1.5">
            <button
              type="button"
              aria-label="Zamknij"
              onClick={() => {
                setMobileOpen(false);
                setShowPicker(false);
                setShowProjectPicker(false);
                setError(null);
              }}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-lg text-[#9098a4] transition-colors hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] dark:hover:bg-white/10 dark:hover:text-white"
            >
              <X size={19} />
            </button>

            <input
              ref={mobileInputRef}
              type="text"
              value={value}
              onChange={(event) => setValue(event.target.value)}
              disabled={isSaving}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  void handleSubmit('mobile');
                }
              }}
              placeholder="Co trzeba zrobić?"
              enterKeyHint="done"
              className="min-w-0 flex-1 bg-transparent text-[16px] font-medium text-[#0f1115] outline-none placeholder:font-normal placeholder:text-[#b0b5be] dark:text-white dark:placeholder:text-gray-600"
            />

            <button
              type="submit"
              aria-label="Zapisz zadanie"
              disabled={!value.trim() || isSaving}
              className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[#0f1115] text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-25 dark:bg-white dark:text-[#0f1115]"
            >
              <ArrowUp size={19} strokeWidth={2.3} />
            </button>
          </div>

          <div className="flex w-full items-center gap-1.5 border-t border-[#efefec] pt-1.5 dark:border-white/8">
            <label
              className={`relative flex h-9 flex-none cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors hover:bg-[#f1f0ed] dark:hover:bg-white/10 ${dueDate ? 'text-[#ef5350]' : 'text-[#7f8793]'}`}
            >
              <CalendarDays size={16} strokeWidth={1.9} />
              <span>{dueDate ? formatQuickDate(dueDate) : 'Termin'}</span>
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                disabled={isSaving}
                aria-label="Wybierz termin zadania"
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <div ref={mobileProjectPickerRef} className="relative min-w-0 flex-1">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={showProjectPicker}
                onClick={() => {
                  setShowPicker(false);
                  setShowProjectPicker(current => !current);
                }}
                disabled={isSaving}
                className={`flex h-9 w-full min-w-0 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-semibold transition-colors ${showProjectPicker ? 'bg-[#f1f0ed] text-[#0f1115] dark:bg-white/10 dark:text-white' : 'text-[#7f8793] hover:bg-[#f1f0ed] dark:hover:bg-white/10'}`}
              >
                <Folder size={16} strokeWidth={1.9} className="flex-none" />
                {selectedProject && (
                  <span
                    className="h-1.5 w-1.5 flex-none rounded-full"
                    style={{ background: selectedProject.color || '#9098a4' }}
                  />
                )}
                <span className="truncate">{selectedProject?.name ?? 'Projekt'}</span>
              </button>

              {showProjectPicker && (
                <ProjectPicker
                  projects={projects}
                  selectedProjectId={selectedProjectId}
                  onChange={setSelectedProjectId}
                  onClose={() => setShowProjectPicker(false)}
                />
              )}
            </div>

            <div ref={mobilePickerRef} className="relative flex-none">
              <button
                type="button"
                onClick={() => {
                  setShowProjectPicker(false);
                  setShowPicker(current => !current);
                }}
                disabled={isSaving}
                title={PRIORITY_LABELS[priority]}
                className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${showPicker ? 'bg-[#f1f0ed] dark:bg-white/10' : 'text-[#9098a4] hover:bg-[#f1f0ed] dark:hover:bg-white/10'}`}
              >
                <FlagIcon className={`h-4 w-4 ${PRIORITY_COLORS[priority]}`} />
              </button>
              {showPicker && (
                <PriorityPicker priority={priority} onChange={setPriority} onClose={() => setShowPicker(false)} />
              )}
            </div>
          </div>
        </form>
      </div>
    </>,
    document.body
  );
}

function PriorityPicker({
  priority,
  onChange,
  onClose,
}: {
  priority: TaskPriority;
  onChange: (priority: TaskPriority) => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute bottom-full right-0 z-50 mb-2 w-40 overflow-hidden rounded-xl border border-gray-100 bg-white py-1 shadow-lg dark:border-white/10 dark:bg-[#2C2C2E]">
      {Object.values(TaskPriority).map(option => (
        <button
          key={option}
          type="button"
          onClick={() => { onChange(option); onClose(); }}
          className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${priority === option ? 'bg-gray-50 dark:bg-white/5' : ''}`}
        >
          <FlagIcon className={`h-3.5 w-3.5 flex-none ${PRIORITY_COLORS[option]}`} />
          <span className="text-gray-700 dark:text-gray-300">{PRIORITY_LABELS[option]}</span>
        </button>
      ))}
    </div>
  );
}

function ProjectPicker({
  projects,
  selectedProjectId,
  onChange,
  onClose,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  onChange: (projectId: string | null) => void;
  onClose: () => void;
}) {
  const chooseProject = (projectId: string | null) => {
    onChange(projectId);
    onClose();
  };

  return (
    <div
      role="listbox"
      aria-label="Projekt zadania"
      className="absolute bottom-full right-0 z-[60] mb-2 w-[min(18rem,calc(100vw-1.5rem))] overflow-hidden rounded-xl border border-[#e8e8e4] bg-white shadow-[0_18px_48px_rgba(15,17,21,.18)] dark:border-white/10 dark:bg-[#27272A]"
    >
      <div className="border-b border-[#efefec] px-3.5 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-[#9098a4] dark:border-white/8">
        Projekt
      </div>
      <div className="max-h-[min(17rem,45dvh)] overflow-y-auto p-1.5">
        <button
          type="button"
          role="option"
          aria-selected={selectedProjectId === null}
          onClick={() => chooseProject(null)}
          className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[14px] transition-colors hover:bg-[#f5f4f1] dark:hover:bg-white/8 ${selectedProjectId === null ? 'font-semibold text-[#0f1115] dark:text-white' : 'text-[#5f6670] dark:text-gray-300'}`}
        >
          <Folder size={16} className="flex-none text-[#a1a8b2]" />
          <span className="min-w-0 flex-1 truncate">Bez projektu</span>
          {selectedProjectId === null && <Check size={17} className="flex-none text-[#0f1115] dark:text-white" />}
        </button>

        {projects.map(project => (
          <button
            key={project.id}
            type="button"
            role="option"
            aria-selected={selectedProjectId === project.id}
            onClick={() => chooseProject(project.id)}
            className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-left text-[14px] transition-colors hover:bg-[#f5f4f1] dark:hover:bg-white/8 ${selectedProjectId === project.id ? 'font-semibold text-[#0f1115] dark:text-white' : 'text-[#5f6670] dark:text-gray-300'}`}
          >
            <span
              className="h-2.5 w-2.5 flex-none rounded-full"
              style={{ background: project.color || '#a1a8b2' }}
            />
            <span className="min-w-0 flex-1 truncate">{project.name}</span>
            {selectedProjectId === project.id && <Check size={17} className="flex-none text-[#0f1115] dark:text-white" />}
          </button>
        ))}
      </div>
    </div>
  );
}
