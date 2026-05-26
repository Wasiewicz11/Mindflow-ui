import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project } from '../types';
import { TaskPriority } from '../types';

interface Props {
  activeProjectId: string | null;
  projects: Project[];
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../types').TaskStatus, description?: string) => void;
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
  const [showPicker, setShowPicker] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showPicker) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowPicker(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : null;

  const handleSubmit = () => {
    if (!value.trim()) return;
    onAdd(value.trim(), priority, undefined, activeProjectId ?? undefined);
    setValue('');
    setPriority(TaskPriority.P4);
    inputRef.current?.focus();
  };

  return createPortal(
    <div className="fixed bottom-[90px] lg:bottom-4 left-0 lg:left-[220px] right-0 px-4 lg:px-6 z-40 pointer-events-none">
      <div className="max-w-3xl pointer-events-auto">
        <div className="relative flex items-center bg-white/95 dark:bg-[#1C1C1E]/95 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-xl shadow-sm px-3 py-2 gap-2">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            placeholder="Dodaj zadanie..."
            className="flex-1 bg-transparent text-sm text-gray-600 dark:text-gray-300 placeholder-gray-300 dark:placeholder-gray-600 outline-none min-w-0"
          />

          {activeProject && (
            <span
              className="flex-none inline-flex items-center gap-1 text-[11px] font-medium rounded-md px-2 py-0.5 whitespace-nowrap"
              style={{
                color: activeProject.color || '#9098a4',
                background: (activeProject.color || '#9098a4') + '22',
              }}
            >
              <span
                className="rounded-full flex-none"
                style={{ width: 6, height: 6, background: activeProject.color || '#9098a4' }}
              />
              {activeProject.name}
            </span>
          )}

          <div ref={pickerRef} className="relative flex-none">
            <button
              type="button"
              onClick={() => setShowPicker(!showPicker)}
              title={PRIORITY_LABELS[priority]}
              className={`p-1.5 rounded-lg transition-colors ${showPicker ? 'bg-gray-100 dark:bg-white/10' : 'hover:bg-gray-100 dark:hover:bg-white/5'}`}
            >
              <FlagIcon className={`w-4 h-4 ${PRIORITY_COLORS[priority]}`} />
            </button>

            {showPicker && (
              <div className="absolute bottom-full right-0 mb-1.5 bg-white dark:bg-[#2C2C2E] border border-gray-100 dark:border-white/10 rounded-xl shadow-lg overflow-hidden z-50 w-36">
                {(Object.values(TaskPriority)).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => { setPriority(p); setShowPicker(false); }}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-gray-50 dark:hover:bg-white/5 ${priority === p ? 'bg-gray-50 dark:bg-white/5' : ''}`}
                  >
                    <FlagIcon className={`w-3.5 h-3.5 flex-none ${PRIORITY_COLORS[p]}`} />
                    <span className="text-gray-700 dark:text-gray-300">{PRIORITY_LABELS[p]}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
