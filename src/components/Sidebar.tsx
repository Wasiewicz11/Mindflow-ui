import React, { useState } from 'react';
import type { User, Space, Project } from '../types';

interface SidebarProps {
  activeTab: 'dashboard' | 'notes' | 'tasks' | 'settings';
  setActiveTab: (tab: 'dashboard' | 'notes' | 'tasks' | 'settings') => void;
  user: User | null;
  spaces: Space[];
  projects: Project[];
  activeProjectId: string | null;
  onSelectProject: (id: string | null) => void;
  onCreateProject: (name: string, color: string, spaceId: string | null) => void;
  onDeleteProject: (id: string) => void;
  onMoveProject: (projectId: string, newSpaceId: string | null) => void;
  onCreateSpace: (name: string) => void;
  onDeleteSpace: (id: string) => void;
  onOpenSpaceSettings: (spaceId: string) => void;
  onOpenJoinSpace: () => void;
}

const PROJECT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#9CA3AF'];

const Sidebar: React.FC<SidebarProps> = ({
  activeTab, setActiveTab, user,
  spaces, projects, activeProjectId, onSelectProject, onCreateProject, onDeleteProject, onMoveProject, onCreateSpace, onOpenSpaceSettings, onOpenJoinSpace
}) => {
  const [imgError, setImgError] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState<string | null>(null);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#9CA3AF');
  const [isAddingSpace, setIsAddingSpace] = useState(false);
  const [newSpaceName, setNewSpaceName] = useState('');
  const [expandedSpaces, setExpandedSpaces] = useState<Record<string, boolean>>({});
  const [draggingProjectId, setDraggingProjectId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);

  const menuItems = [
    {
      id: 'dashboard', label: 'Centrum', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
      )
    },
    {
      id: 'notes', label: 'Wiedza', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
      )
    },
    {
      id: 'tasks', label: 'Zadania', icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      )
    },
  ];

  const getInitials = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : 'U';
  };

  const handleCreateProjectSubmit = (e: React.FormEvent, spaceId: string | null) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onCreateProject(newProjectName, newProjectColor, spaceId);
      setNewProjectName('');
      setNewProjectColor('#9CA3AF');
      setIsAddingProject(null);
    }
  };

  const handleCreateSpaceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSpaceName.trim()) {
      onCreateSpace(newSpaceName);
      setNewSpaceName('');
      setIsAddingSpace(false);
    }
  };

  const toggleSpace = (id: string) => {
    setExpandedSpaces(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDragStart = (e: React.DragEvent, projectId: string) => {
    setDraggingProjectId(projectId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggingProjectId(null);
    setDragOverTarget(null);
  };

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget(targetId);
    if (targetId !== 'none') {
      setExpandedSpaces(prev => ({ ...prev, [targetId]: true }));
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetSpaceId: string | null) => {
    e.preventDefault();
    if (draggingProjectId) {
      const project = projects.find(p => p.id === draggingProjectId);
      const currentSpaceId = project?.space_id ?? null;
      if (currentSpaceId !== targetSpaceId) {
        onMoveProject(draggingProjectId, targetSpaceId);
      }
    }
    setDraggingProjectId(null);
    setDragOverTarget(null);
  };

  const renderProjectForm = (spaceId: string | null) => {
    if (isAddingProject !== (spaceId || 'none')) return null;
    return (
      <form onSubmit={(e) => handleCreateProjectSubmit(e, spaceId)} className="mb-3 px-3 animate-fade-in-up">
        <input
          autoFocus
          type="text"
          value={newProjectName}
          onChange={(e) => setNewProjectName(e.target.value)}
          placeholder="Nazwa projektu..."
          className="w-full text-xs px-3 py-2 mb-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:border-gray-400 dark:focus:border-white/30 focus:ring-2 focus:ring-gray-100 dark:focus:ring-white/5 transition-all"
        />
        <div className="flex justify-between items-center px-1 mb-2">
          {PROJECT_COLORS.map(color => (
            <button
              key={color}
              type="button"
              onClick={() => setNewProjectColor(color)}
              className={`w-4 h-4 rounded-full transition-transform ${newProjectColor === color ? 'scale-125 ring-2 ring-offset-1 ring-gray-400 dark:ring-white/50 dark:ring-offset-black' : 'hover:scale-110'}`}
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setIsAddingProject(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Anuluj</button>
          <button type="submit" className="text-xs bg-gray-900 dark:bg-white text-white dark:text-black px-2 py-1 rounded-md hover:bg-black dark:hover:bg-gray-200">Dodaj</button>
        </div>
      </form>
    );
  };

  const renderProject = (project: Project) => (
    <div
      key={project.id}
      draggable
      onDragStart={(e) => handleDragStart(e, project.id)}
      onDragEnd={handleDragEnd}
      className={`group relative flex items-center pl-4 transition-opacity duration-150 ${draggingProjectId === project.id ? 'opacity-40' : 'opacity-100'}`}
    >
      <button
        onClick={() => { setActiveTab('tasks'); onSelectProject(project.id); }}
        className={`w-full flex items-center px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-grab active:cursor-grabbing ${
          activeProjectId === project.id && activeTab === 'tasks'
            ? 'bg-gray-100 dark:bg-white/10 text-gray-900 dark:text-white font-medium translate-x-1'
            : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5 hover:translate-x-1'
        }`}
      >
        <span className="w-2 h-2 rounded-full mr-2 transition-transform duration-300 group-hover:scale-110" style={{ backgroundColor: project.color || '#9CA3AF' }}></span>
        <span className="truncate max-w-[120px] text-left">{project.name}</span>
      </button>
      <button
        onClick={() => onDeleteProject(project.id)}
        className="absolute right-2 opacity-0 group-hover:opacity-100 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-all hover:scale-110"
        title="Usuń projekt"
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );

  const isDropTarget = (id: string) => draggingProjectId !== null && dragOverTarget === id;

  return (
    <div className="hidden lg:flex w-64 h-full bg-white/80 dark:bg-[#1C1C1E]/80 backdrop-blur-xl border-r border-gray-100/50 dark:border-white/5 flex-col py-6 relative z-10">

      {/* LOGO */}
      <div className="flex-none px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-gray-900 to-gray-700 dark:from-white dark:to-gray-300 flex items-center justify-center shadow-lg shadow-gray-900/20 dark:shadow-white/10">
          <svg className="w-5 h-5 text-white dark:text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
        </div>
        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400 tracking-tight">MindFlow</span>
      </div>

      {/* MAIN NAV */}
      <nav className="flex-none px-4 space-y-1.5 mb-8">
        {menuItems.map(item => (
          <button
            key={item.id}
            onClick={() => { setActiveTab(item.id as any); if (item.id === 'tasks') onSelectProject(null); }}
            className={`w-full flex items-center px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ease-out group ${
              activeTab === item.id
                ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm scale-[1.02]'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/5 hover:translate-x-1'
            }`}
          >
            <div className={`mr-3 transition-transform duration-300 ${activeTab === item.id ? 'scale-110' : 'group-hover:scale-110'}`}>
              {item.icon}
            </div>
            {item.label}
          </button>
        ))}
      </nav>

      {/* SPACES & PROJECTS - SCROLLABLE */}
      <nav className="flex-1 px-4 overflow-y-auto custom-scrollbar">
        <div className="mb-4">
          <div className="flex items-center justify-between px-3 mb-2 group">
            <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Przestrzenie</h3>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button
                onClick={onOpenJoinSpace}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:scale-110 transition-all"
                title="Dołącz z kodem"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
              </button>
              <button
                onClick={() => setIsAddingSpace(true)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:scale-110 transition-all"
                title="Dodaj przestrzeń"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              </button>
            </div>
          </div>

          {isAddingSpace && (
            <form onSubmit={handleCreateSpaceSubmit} className="mb-3 px-3 animate-fade-in-up">
              <input
                autoFocus
                type="text"
                value={newSpaceName}
                onChange={(e) => setNewSpaceName(e.target.value)}
                placeholder="Nazwa przestrzeni..."
                className="w-full text-xs px-3 py-2 mb-2 border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:border-gray-400 dark:focus:border-white/30 focus:ring-2 focus:ring-gray-100 dark:focus:ring-white/5 transition-all"
              />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAddingSpace(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">Anuluj</button>
                <button type="submit" className="text-xs bg-gray-900 dark:bg-white text-white dark:text-black px-2 py-1 rounded-md hover:bg-black dark:hover:bg-gray-200">Dodaj</button>
              </div>
            </form>
          )}

          <div className="space-y-1">
            {spaces.map(space => (
              <div
                key={space.id}
                className="flex flex-col"
                onDragOver={(e) => handleDragOver(e, space.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, space.id)}
              >
                <div className={`group relative flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-all duration-150 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 ${
                  isDropTarget(space.id) ? 'bg-gray-100 dark:bg-white/10 ring-1 ring-gray-300 dark:ring-white/20' : ''
                }`}>
                  <button onClick={() => toggleSpace(space.id)} className="flex items-center flex-1 text-left font-medium">
                    <svg className={`w-4 h-4 mr-2 transition-transform ${expandedSpaces[space.id] ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                    <span className="truncate max-w-[120px]">{space.name}</span>
                  </button>
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => { setExpandedSpaces(prev => ({ ...prev, [space.id]: true })); setIsAddingProject(space.id); }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                      title="Dodaj projekt"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); onOpenSpaceSettings(space.id); }}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 ml-1"
                      title="Ustawienia przestrzeni"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    </button>
                  </div>
                </div>

                {expandedSpaces[space.id] && (
                  <div className="mt-1 space-y-1">
                    {renderProjectForm(space.id)}
                    {projects.filter(p => p.space_id === space.id).map(renderProject)}
                  </div>
                )}
              </div>
            ))}

            {/* Projects without a space */}
            <div
              className="mt-4"
              onDragOver={(e) => handleDragOver(e, 'none')}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
            >
              <div className={`flex items-center justify-between px-3 mb-2 rounded-lg py-1 transition-all duration-150 group ${
                isDropTarget('none') ? 'bg-gray-100 dark:bg-white/10 ring-1 ring-gray-300 dark:ring-white/20' : ''
              }`}>
                <h3 className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest">Inne Projekty</h3>
                <button
                  onClick={() => setIsAddingProject('none')}
                  className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all hover:scale-110"
                  title="Dodaj projekt"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
                </button>
              </div>
              {renderProjectForm(null)}
              {projects.filter(p => !p.space_id).map(renderProject)}
            </div>
          </div>
        </div>
      </nav>

      {/* USER PROFILE - PINNED BOTTOM */}
      <div className="flex-none w-full px-4 pt-4 mt-2 border-t border-gray-100/50 dark:border-white/5">
        <button
          onClick={() => setActiveTab('settings')}
          className={`w-full flex items-center p-3 rounded-xl transition-all duration-300 ease-out group ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-white/10 text-gray-900 dark:text-white shadow-sm scale-[1.02]'
              : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/5 hover:translate-x-1'
          }`}
        >
          <div className="w-5 h-5 flex-shrink-0">
            {user?.picture && !imgError ? (
              <img
                src={user.picture}
                alt="Profile"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
                className="w-full h-full rounded-full object-cover shadow-sm"
              />
            ) : (
              <div className="w-full h-full rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-gray-600 dark:text-gray-400">
                {user ? getInitials(user.name) : '?'}
              </div>
            )}
          </div>
          <span className="block ml-3 font-medium text-sm truncate">{user?.name || 'Użytkownik'}</span>
        </button>
      </div>

    </div>
  );
};

export default Sidebar;
