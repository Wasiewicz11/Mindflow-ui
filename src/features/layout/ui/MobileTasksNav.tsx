import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Folder, Layers3 } from 'lucide-react';
import type { Project, Space } from '../../../shared/types';
import { MobileTasksNavSkeleton } from '../../../shared/ui/LoadingSkeletons';

interface MobileTasksNavProps {
  spaces: Space[];
  projects: Project[];
  activeSpaceId: string | null;
  activeProjectId: string | null;
  taskCountByProjectId: Record<string, number>;
  onSelectSpace: (id: string | null) => void;
  onSelectProject: (id: string | null) => void;
  isLoading?: boolean;
}

type OpenMenu = 'space' | 'project' | null;

const triggerClass =
  'flex h-11 min-w-0 items-center gap-1.5 rounded-lg bg-[#f1f0ed]/80 px-2.5 text-[12px] font-medium text-[#3a3f47] transition-[background-color,color] duration-200 ease hover:bg-[#e8e8e4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] active:bg-[#e3e3df] dark:bg-white/8 dark:text-gray-200 dark:hover:bg-white/12 dark:focus-visible:outline-white/20';

const menuClass =
  'absolute right-0 top-full z-[70] mt-2 w-[min(17rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-[#e8e8e4] bg-white p-1.5 shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] dark:shadow-none';

const menuItemClass = (active: boolean) =>
  `flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-[background-color,color] duration-200 ease hover:bg-[#f7f7f4] focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-[#0f1115] dark:hover:bg-[#323238] dark:focus-visible:outline-white/20 ${
    active ? 'font-semibold text-[#0f1115] dark:text-white' : 'font-normal text-[#5a606b] dark:text-gray-300'
  }`;

export function MobileTasksNav({
  spaces,
  projects,
  activeSpaceId,
  activeProjectId,
  taskCountByProjectId,
  onSelectSpace,
  onSelectProject,
  isLoading = false,
}: MobileTasksNavProps) {
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpenMenu(null);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenu(null);
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu]);

  if (isLoading) return <MobileTasksNavSkeleton />;
  if (spaces.length === 0 && projects.length === 0) return null;

  const activeSpace = activeSpaceId ? spaces.find(space => space.id === activeSpaceId) ?? null : null;
  const visibleProjects = activeSpaceId ? projects.filter(project => project.space_id === activeSpaceId) : projects;
  const activeProject = activeProjectId
    ? visibleProjects.find(project => project.id === activeProjectId) ?? null
    : null;

  const selectSpace = (id: string | null) => {
    onSelectSpace(id);
    onSelectProject(null);
    setOpenMenu(null);
  };

  const selectProject = (id: string | null) => {
    onSelectProject(id);
    setOpenMenu(null);
  };

  return (
    <div ref={rootRef} className="relative ml-auto flex min-w-0 items-center gap-1.5 lg:hidden">
      {spaces.length > 0 && (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setOpenMenu(current => current === 'space' ? null : 'space')}
            className={triggerClass}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'space'}
            title={activeSpace?.name ?? 'Wszystkie przestrzenie'}
          >
            {activeSpace ? (
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: activeSpace.color || '#9098a4' }} />
            ) : (
              <Layers3 className="h-3.5 w-3.5 flex-none text-[#9098a4]" />
            )}
            <span className="max-w-[68px] truncate max-[359px]:max-w-10">{activeSpace?.name ?? 'Wszystkie'}</span>
            <ChevronDown className={`h-3.5 w-3.5 flex-none text-[#9098a4] transition-transform duration-200 ease max-[359px]:hidden ${openMenu === 'space' ? 'rotate-180' : ''}`} />
          </button>

          <div
            aria-hidden={openMenu !== 'space'}
            inert={openMenu !== 'space'}
            className={`${menuClass} ${openMenu === 'space' ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Przestrzeń</p>
            <button type="button" onClick={() => selectSpace(null)} className={menuItemClass(activeSpaceId === null)}>
              <Layers3 className="h-4 w-4 flex-none text-[#9098a4]" />
              <span className="min-w-0 flex-1 truncate">Wszystkie przestrzenie</span>
              {activeSpaceId === null && <Check className="h-4 w-4 flex-none" strokeWidth={2.4} />}
            </button>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {spaces.map(space => (
                <button key={space.id} type="button" onClick={() => selectSpace(space.id)} className={menuItemClass(activeSpaceId === space.id)}>
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: space.color || '#9098a4' }} />
                  <span className="min-w-0 flex-1 truncate">{space.name}</span>
                  {activeSpaceId === space.id && <Check className="h-4 w-4 flex-none" strokeWidth={2.4} />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {projects.length > 0 && (
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => setOpenMenu(current => current === 'project' ? null : 'project')}
            className={triggerClass}
            aria-haspopup="menu"
            aria-expanded={openMenu === 'project'}
            title={activeProject?.name ?? 'Wszystkie zadania'}
          >
            {activeProject ? (
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: activeProject.color || '#9098a4' }} />
            ) : (
              <Folder className="h-3.5 w-3.5 flex-none text-[#9098a4]" />
            )}
            <span className="max-w-[68px] truncate max-[359px]:max-w-10">{activeProject?.name ?? 'Wszystkie'}</span>
            <ChevronDown className={`h-3.5 w-3.5 flex-none text-[#9098a4] transition-transform duration-200 ease max-[359px]:hidden ${openMenu === 'project' ? 'rotate-180' : ''}`} />
          </button>

          <div
            aria-hidden={openMenu !== 'project'}
            inert={openMenu !== 'project'}
            className={`${menuClass} ${openMenu === 'project' ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Projekt</p>
            <button type="button" onClick={() => selectProject(null)} className={menuItemClass(activeProjectId === null)}>
              <Folder className="h-4 w-4 flex-none text-[#9098a4]" />
              <span className="min-w-0 flex-1 truncate">Wszystkie zadania</span>
              {activeProjectId === null && <Check className="h-4 w-4 flex-none" strokeWidth={2.4} />}
            </button>
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
              {visibleProjects.map(project => (
                <button key={project.id} type="button" onClick={() => selectProject(project.id)} className={menuItemClass(activeProjectId === project.id)}>
                  <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: project.color || '#9098a4' }} />
                  <span className="min-w-0 flex-1 truncate">{project.name}</span>
                  <span className="flex-none text-[11px] font-medium text-[#b0b5be]">{taskCountByProjectId[project.id] ?? 0}</span>
                  {activeProjectId === project.id && <Check className="h-4 w-4 flex-none" strokeWidth={2.4} />}
                </button>
              ))}
              {visibleProjects.length === 0 && (
                <p className="px-2.5 py-3 text-[12.5px] text-[#9098a4]">Brak projektów w tej przestrzeni.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
