import { useCallback, useEffect, useState } from 'react';
import { LoginScreen } from '../features/auth/ui';
import { Sidebar, ThemeSelector } from '../features/layout/ui';
import { CalendarView, TaskList, TaskListGrouped, TaskWeekView, TaskBoardView, QuickAddTask } from '../features/tasks/ui';
import { NotesGrid } from '../features/notes/ui';

import { useAuth } from '../features/auth';
import { useTasks } from '../features/tasks';
import { getSpaces, createSpace, deleteSpace, updateSpace } from '../features/spaces';
import { getMe } from '../features/users';
import { getProjects, createProject, deleteProject } from '../features/projects';
import { SpaceSettingsModal } from '../features/spaces/ui';
import { ProjectView } from '../views/ProjectView';
import type { Note, User, Space, Project, Task } from '../shared/types';
import { TaskPriority } from '../shared/types';

type ActiveTab = 'dashboard' | 'notes' | 'tasks' | 'calendar' | 'settings';

export function AppShell() {
  const { isLoggedIn, logout, initGoogleButton } = useAuth();
  const { tasks, addTask, editTask, removeTask } = useTasks(isLoggedIn);

  const [user, setUser] = useState<User | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'week' | 'board'>('list');
  const [isLoading, setIsLoading] = useState(true);
  const [spaceSettingsId, setSpaceSettingsId] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  const [theme, setTheme] = useState<'light' | 'dark' | 'gray'>(() => {
    const stored = localStorage.getItem('mindflow_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'gray') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-gray');
    if (theme === 'dark') document.documentElement.classList.add('dark');
    else if (theme === 'gray') document.documentElement.classList.add('dark', 'theme-gray');
    localStorage.setItem('mindflow_theme', theme);
  }, [theme]);

  useEffect(() => {
    setIsLoading(false);
  }, [tasks]);

  useEffect(() => {
    if (!isLoggedIn) return;
    getMe().then(setUser).catch(() => {});
  }, [isLoggedIn]);

  const fetchSpaces = useCallback(async () => {
    try {
      const apiSpaces = await getSpaces();
      const mappedSpaces = apiSpaces.map(s => ({ ...s, color: '#9CA3AF' }));
      setSpaces(mappedSpaces);
      const allProjects = await Promise.all(
        mappedSpaces.map(s => getProjects(s.id).then(ps => ps.map(p => ({ ...p, space_id: p.spaceId }))))
      );
      setProjects(allProjects.flat());
    } catch (e) {
      console.error('Failed to fetch spaces/projects', e);
    }
  }, []);

  useEffect(() => {
    if (isLoggedIn) fetchSpaces();
  }, [isLoggedIn, fetchSpaces]);

  const handleAddTask = async (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../shared/types').TaskStatus, description?: string, tags?: string[], subtasks?: import('../shared/types').Subtask[]) => {
    const finalProjectId = projectId || (activeProjectId !== null ? activeProjectId : undefined);
    return addTask(content, finalProjectId, status, description, priority, dueDate, tags, subtasks);
  };

  const handleEditTask = async (id: string, updates: Partial<Task>) => {
    await editTask(id, updates);
  };

  const handleDeleteTask = async (id: string) => {
    await removeTask(id);
  };

  const handleToggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const newStatus: import('../shared/types').TaskStatus = task.status === 'Completed' ? 'NotStarted' : 'Completed';
    await editTask(id, { status: newStatus });
  };

  const handleBulkEdit = (ids: string[], updates: Partial<Task>) => {
    ids.forEach(id => handleEditTask(id, updates));
  };

  const handleClearCompleted = () => {
    const toDelete = tasks.filter(t => t.isCompleted);
    if (toDelete.length === 0) return;
    if (!window.confirm(`Czy na pewno chcesz usunąć ${toDelete.length} wykonanych zadań?`)) return;
    toDelete.forEach(t => removeTask(t.id));
  };

  const handleCreateSpace = async (name: string) => {
    try {
      const created = await createSpace({ name, description: '' });
      setSpaces(prev => [...prev, { ...created, color: '#9CA3AF' }]);
    } catch (e) {
      console.error('Failed to create space', e);
    }
  };

  const handleUpdateSpace = async (id: string, name: string, color: string) => {
    try {
      await updateSpace(id, { name });
      setSpaces(prev => prev.map(s => s.id === id ? { ...s, name, color } : s));
    } catch (e) {
      console.error('Failed to update space', e);
    }
  };

  const handleDeleteSpace = async (id: string) => {
    try {
      await deleteSpace(id);
      setSpaces(prev => prev.filter(s => s.id !== id));
      setProjects(prev => prev.filter(p => p.space_id !== id));
    } catch (e) {
      console.error('Failed to delete space', e);
    }
  };

  const handleCreateProject = async (name: string, color: string, spaceId: string | null) => {
    if (!spaceId) return;
    try {
      const created = await createProject(spaceId, { name, color });
      setProjects(prev => [...prev, { ...created, space_id: created.spaceId }]);
    } catch (e) {
      console.error('Failed to create project', e);
    }
  };

  const handleDeleteProject = async (id: string) => {
    const project = projects.find(p => p.id === id);
    if (!project?.space_id) return;
    try {
      await deleteProject(project.space_id, id);
      setProjects(prev => prev.filter(p => p.id !== id));
      if (activeProjectId === id) setActiveProjectId(null);
    } catch (e) {
      console.error('Failed to delete project', e);
    }
  };

  const handleMoveProject = (projectId: string, newSpaceId: string | null) => {
    setProjects(prev => prev.map(p => p.id === projectId ? { ...p, space_id: newSpaceId } : p));
  };

  const handleAddNote = (title: string, content: string, tags: string[]) => {
    setNotes(prev => [{ id: Date.now().toString(), title, content, tags, createdAt: new Date() }, ...prev]);
  };

  const handleEditNote = (id: string, updates: Partial<Note>) => {
    setNotes(prev => prev.map(n => n.id === id ? { ...n, ...updates } : n));
  };

  const handleDeleteNote = (id: string) => {
    setNotes(prev => prev.filter(n => n.id !== id));
  };

  const handleLogout = () => {
    logout();
    setUser(null);
    localStorage.removeItem('mindflow_user');
    setNotes([]);
    setActiveTab('dashboard');
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const activeTaskCountByProjectId = tasks.reduce<Record<string, number>>((acc, task) => {
    if (task.isCompleted || !task.project_id) return acc;
    acc[task.project_id] = (acc[task.project_id] ?? 0) + 1;
    return acc;
  }, {});
  const sortedAllTasks = [...tasks].sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate);
    if (a.dueDate) return -1;
    if (b.dueDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });
  const todayTasks = tasks.filter(t => !t.isCompleted && t.dueDate && t.dueDate <= todayStr);
  const importantTasks = tasks.filter(t => !t.isCompleted && t.priority === TaskPriority.P1 && (!t.dueDate || t.dueDate > todayStr));

  if (!isLoggedIn) {
    return <LoginScreen initGoogleButton={initGoogleButton} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const showProjectView = activeTab === 'tasks' && !!activeProjectId && !!activeProject;

  const MobileBottomNav = () => (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-black/90 backdrop-blur-xl border-t border-gray-100/50 dark:border-white/5 z-50 px-6 pt-3 pb-8 flex justify-between items-center shadow-lg shadow-gray-200/50 dark:shadow-none transition-colors duration-300">
      <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        <span className="text-[10px] font-medium">Centrum</span>
      </button>
      <button onClick={() => { setActiveTab('tasks'); setActiveProjectId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'tasks' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-[10px] font-medium">Zadania</span>
      </button>
      <button onClick={() => { setActiveTab('calendar'); setActiveProjectId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'calendar' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2" strokeWidth="2"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 2v4M8 2v4M3 10h18" /></svg>
        <span className="text-[10px] font-medium">Kalendarz</span>
      </button>
      <button onClick={() => setActiveTab('notes')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'notes' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
        <span className="text-[10px] font-medium">Wiedza</span>
      </button>
      <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'settings' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
          {user?.avatarUrl && <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />}
        </div>
        <span className="text-[10px] font-medium">Profil</span>
      </button>
    </nav>
  );

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-[#000000] font-sans text-gray-900 dark:text-gray-100 overflow-hidden transition-colors duration-300">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        spaces={spaces}
        projects={projects}
        activeTaskCountByProjectId={activeTaskCountByProjectId}
        activeProjectId={activeProjectId}
        onSelectProject={setActiveProjectId}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onMoveProject={handleMoveProject}
        onCreateSpace={handleCreateSpace}
        onDeleteSpace={handleDeleteSpace}
        onOpenSpaceSettings={(id) => setSpaceSettingsId(id)}
        onOpenJoinSpace={() => {}}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {showProjectView && (
          <ProjectView
            projectId={activeProjectId}
            project={activeProject}
            projects={projects}
          />
        )}

        {!showProjectView && (
          <>
            <header className="flex-none px-6 pt-8 pb-4 lg:py-8 flex flex-col lg:flex-row lg:items-end justify-between animate-fade-in gap-4">
              <div>
                <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                  {activeTab === 'dashboard' && `Dzień dobry, ${user?.firstName ?? 'Użytkowniku'}.`}
                  {activeTab === 'notes' && 'Twoja baza wiedzy.'}
                  {activeTab === 'tasks' && 'Wszystkie zadania.'}
                  {activeTab === 'calendar' && 'Kalendarz.'}
                  {activeTab === 'settings' && 'Ustawienia.'}
                </h1>
                <p className="text-gray-400 dark:text-gray-500 mt-1 lg:mt-2 font-medium text-sm lg:text-base">
                  {activeTab === 'dashboard' && `Masz ${tasks.filter(t => !t.isCompleted).length} zadań do zrobienia.`}
                  {activeTab === 'tasks' && 'Zarządzaj swoimi zadaniami efektywnie.'}
                  {activeTab === 'calendar' && 'Planuj dzień, tydzień i miesiąc z timeblockingiem.'}
                  {activeTab === 'settings' && 'Dostosuj aplikację do swoich potrzeb.'}
                </p>
              </div>

              {activeTab === 'tasks' && (
                <div
                  className="flex dark:bg-white/5"
                  style={{ padding: 2, background: '#fff', border: '1px solid #ececec', borderRadius: 7 }}
                >
                  {(['list', 'week', 'board'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTaskViewMode(mode)}
                      className="transition-all duration-150"
                      style={{
                        padding: '4px 11px',
                        borderRadius: 5,
                        fontSize: 12.5,
                        fontWeight: 500,
                        background: taskViewMode === mode ? '#0f1115' : 'transparent',
                        color: taskViewMode === mode ? '#fff' : '#5a606b',
                      }}
                    >
                      {{ list: 'Lista', week: 'Tydzień', board: 'Tablica' }[mode]}
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar px-6 pb-36 lg:pb-24">
              {activeTab === 'dashboard' && (
                <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {[
                      { label: 'Wszystkie zadania', value: tasks.filter(t => !t.isCompleted).length, color: 'text-gray-900 dark:text-white' },
                      { label: 'Na dziś / zaległe', value: todayTasks.length, color: 'text-red-500' },
                      { label: 'Priorytet P1', value: importantTasks.length, color: 'text-red-500' },
                      { label: 'Ukończone', value: tasks.filter(t => t.isCompleted).length, color: 'text-emerald-500' },
                    ].map((stat) => (
                      <div key={stat.label} className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-white/5 p-5 shadow-sm">
                        <p className="text-xs font-medium text-gray-400 dark:text-gray-500 mb-2">{stat.label}</p>
                        <p className={`text-3xl font-bold ${stat.color}`}>{stat.value}</p>
                      </div>
                    ))}
                  </div>

                  {todayTasks.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Na dziś / Zaległe</h2>
                      <TaskList tasks={todayTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isLoading} />
                    </div>
                  )}

                  {importantTasks.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Ważne (P1)</h2>
                      <TaskList tasks={importantTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isLoading} />
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Ostatnie notatki</h2>
                      <NotesGrid notes={notes.slice(0, 4)} onAdd={handleAddNote} onEdit={handleEditNote} onDelete={handleDeleteNote} compactMode isLoading={false} />
                    </div>
                  )}

                  {todayTasks.length === 0 && importantTasks.length === 0 && notes.length === 0 && !isLoading && (
                    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Wszystko gotowe. Dodaj pierwsze zadanie!</p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <>
                  {projects.length > 0 && (
                    <div className="lg:hidden -mx-6 px-4 mb-4 overflow-x-auto flex gap-2 scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <button
                        onClick={() => setActiveProjectId(null)}
                        className="flex-none text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                        style={{ background: '#0f1115', color: '#fff' }}
                      >
                        Wszystkie
                      </button>
                      {projects.map(p => (
                        <button
                          key={p.id}
                          onClick={() => setActiveProjectId(p.id)}
                          className="flex-none flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                          style={{ background: '#f1f0ed', color: '#5a606b' }}
                        >
                          <span className="rounded-full flex-none" style={{ width: 6, height: 6, background: p.color || '#9aa0aa' }} />
                          {p.name}
                          <span className="rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-medium text-[#9098a4]">
                            {activeTaskCountByProjectId[p.id] ?? 0}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className={`animate-fade-in ${taskViewMode === 'week' ? 'h-full -mx-6 px-6' : taskViewMode === 'board' ? 'h-full' : 'max-w-3xl mx-auto'}`}>
                    {taskViewMode === 'list' && (
                      <TaskListGrouped
                        tasks={sortedAllTasks}
                        projects={projects}
                        onToggle={handleToggleTask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                        onBulkEdit={handleBulkEdit}
                        onClearCompleted={handleClearCompleted}
                        isLoading={isLoading}
                        activeProjectId={null}
                      />
                    )}
                    {taskViewMode === 'week' && (
                      <div className="h-[calc(100vh-200px)]">
                        <TaskWeekView
                          tasks={sortedAllTasks}
                          projects={projects}
                          onEdit={handleEditTask}
                          onToggle={handleToggleTask}
                          onAdd={handleAddTask}
                          onDelete={handleDeleteTask}
                        />
                      </div>
                    )}
                    {taskViewMode === 'board' && (
                      <TaskBoardView
                        tasks={tasks}
                        projects={projects}
                        onEdit={handleEditTask}
                        onToggle={handleToggleTask}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                      />
                    )}
                  </div>

                  <QuickAddTask activeProjectId={null} projects={projects} onAdd={handleAddTask} />
                </>
              )}

              {activeTab === 'calendar' && (
                <div className="h-[calc(100vh-190px)] animate-fade-in">
                  <CalendarView
                    tasks={sortedAllTasks}
                    projects={projects}
                    onAdd={handleAddTask}
                    onEdit={handleEditTask}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                  />
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="animate-fade-in">
                  <NotesGrid notes={notes} onAdd={handleAddNote} onEdit={handleEditNote} onDelete={handleDeleteNote} isLoading={false} />
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="max-w-xl space-y-6 animate-fade-in">
                  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-white/5 p-6">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Profil</h2>
                    <div className="flex items-center gap-4">
                      {user?.avatarUrl && (
                        <img src={user.avatarUrl} alt="Avatar" referrerPolicy="no-referrer" className="w-12 h-12 rounded-full object-cover" />
                      )}
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-white">{user ? `${user.firstName} ${user.lastName}` : ''}</p>
                        <p className="text-sm text-gray-500 dark:text-gray:400">{user?.email}</p>
                      </div>
                    </div>
                    <button
                      onClick={handleLogout}
                      className="mt-4 w-full px-4 py-2 text-sm font-medium text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
                    >
                      Wyloguj się
                    </button>
                  </div>

                  <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl border border-gray-100 dark:border-white/5 p-6">
                    <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Wygląd</h2>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-white">Motyw</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Wybierz styl interfejsu</p>
                      </div>
                      <ThemeSelector theme={theme} setTheme={setTheme} />
                    </div>
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        <MobileBottomNav />
      </main>

      {spaceSettingsId && (() => {
        const space = spaces.find(s => s.id === spaceSettingsId);
        if (!space || !user) return null;
        return (
          <SpaceSettingsModal
            space={space}
            user={user}
            onClose={() => setSpaceSettingsId(null)}
            onUpdateSpace={handleUpdateSpace}
            onDeleteSpace={handleDeleteSpace}
          />
        );
      })()}
    </div>
  );
}
