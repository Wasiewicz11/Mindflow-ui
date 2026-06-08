import { useEffect, useRef, useState } from 'react';
import type { Project, Space } from '../../../shared/types';

interface MobileTasksNavProps {
  spaces: Space[];
  projects: Project[];
  activeSpaceId: string | null;
  activeProjectId: string | null;
  taskCountByProjectId: Record<string, number>;
  onSelectSpace: (id: string | null) => void;
  onSelectProject: (id: string | null) => void;
}

function LayersIcon() {
  return (
    <svg className="h-3.5 w-3.5 flex-none text-[#9098a4]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="ml-auto h-4 w-4 flex-none text-[#0f1115] dark:text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
    </svg>
  );
}

const pillClass = (active: boolean) =>
  `flex flex-none items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-[background-color,border-color,color] duration-200 ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] ${
    active
      ? 'border-transparent bg-[#0f1115] text-white dark:bg-white dark:text-black'
      : 'border-[#e8e8e4] bg-white text-[#5a606b] hover:bg-[#f1f0ed] hover:text-[#0f1115] dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/10 dark:hover:text-white'
  }`;

const menuItemClass = (active: boolean) =>
  `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition-colors duration-200 ease ${
    active
      ? 'bg-[#f1f0ed] text-[#0f1115] dark:bg-[#3F3F46] dark:text-white'
      : 'text-[#5a606b] hover:bg-[#f7f7f4] hover:text-[#0f1115] dark:text-gray-300 dark:hover:bg-[#323238] dark:hover:text-white'
  }`;

export function MobileTasksNav({
  spaces,
  projects,
  activeSpaceId,
  activeProjectId,
  taskCountByProjectId,
  onSelectSpace,
  onSelectProject,
}: MobileTasksNavProps) {
  const [spaceMenuOpen, setSpaceMenuOpen] = useState(false);
  const spaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!spaceMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (spaceRef.current && !spaceRef.current.contains(e.target as Node)) setSpaceMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSpaceMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [spaceMenuOpen]);

  if (spaces.length === 0 && projects.length === 0) return null;

  const activeSpace = activeSpaceId ? spaces.find(s => s.id === activeSpaceId) ?? null : null;
  const visibleProjects = activeSpaceId ? projects.filter(p => p.space_id === activeSpaceId) : projects;

  const selectSpace = (id: string | null) => {
    onSelectSpace(id);
    onSelectProject(null);
    setSpaceMenuOpen(false);
  };

  return (
    <div className="lg:hidden mb-4 flex items-center gap-2">
      {spaces.length > 0 && (
        <div ref={spaceRef} className="relative flex-none">
          <button
            type="button"
            onClick={() => setSpaceMenuOpen(o => !o)}
            className={`flex flex-none items-center gap-1.5 rounded-full border border-[#e8e8e4] bg-white px-3 py-1.5 text-xs font-medium whitespace-nowrap text-[#3a3f47] transition-[background-color,border-color,color] duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c0c5cc] dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-white/10 dark:hover:text-white ${spaceMenuOpen ? 'bg-[#f1f0ed] dark:bg-white/10' : ''}`}
          >
            {activeSpace
              ? <span className="h-2 w-2 flex-none rounded-full" style={{ background: activeSpace.color || '#9098a4' }} />
              : <LayersIcon />}
            <span className="max-w-[110px] truncate">{activeSpace ? activeSpace.name : 'Wszystkie'}</span>
            <svg className={`h-3.5 w-3.5 flex-none text-[#9098a4] transition-transform duration-200 ease ${spaceMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          <div
            className={`absolute left-0 top-full z-30 mt-1 min-w-[200px] rounded-[12px] border border-[#e8e8e4] bg-white p-1 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] dark:shadow-none ${spaceMenuOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}
          >
            <button type="button" onClick={() => selectSpace(null)} className={menuItemClass(activeSpaceId === null)}>
              <LayersIcon />
              <span className="min-w-0 flex-1 truncate text-left">Wszystkie przestrzenie</span>
              {activeSpaceId === null && <CheckIcon />}
            </button>
            {spaces.map(space => (
              <button key={space.id} type="button" onClick={() => selectSpace(space.id)} className={menuItemClass(activeSpaceId === space.id)}>
                <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: space.color || '#9098a4' }} />
                <span className="min-w-0 flex-1 truncate text-left">{space.name}</span>
                {activeSpaceId === space.id && <CheckIcon />}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
        <button type="button" onClick={() => onSelectProject(null)} className={pillClass(activeProjectId === null)}>
          Wszystkie
        </button>
        {visibleProjects.map(project => (
          <button key={project.id} type="button" onClick={() => onSelectProject(project.id)} className={pillClass(activeProjectId === project.id)}>
            <span className="h-2 w-2 flex-none rounded-full" style={{ background: project.color || '#9aa0aa' }} />
            {project.name}
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${activeProjectId === project.id ? 'bg-white/20 text-white dark:bg-black/10 dark:text-black' : 'bg-[#f1f0ed] text-[#9098a4] dark:bg-white/10 dark:text-gray-400'}`}>
              {taskCountByProjectId[project.id] ?? 0}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
