import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginScreen } from '../features/auth/ui';
import { Sidebar, MobileTasksNav, ThemeSelector, AgendaOverlay, AgendaPositionSelector, type AgendaPosition } from '../features/layout/ui';
import { CalendarView, TaskList, TaskListGrouped, TaskWeekView, TaskBoardView, QuickAddTask } from '../features/tasks/ui';
import { NotesGrid } from '../features/notes/ui';
import { BrainView } from '../features/brain';
import { useSuggestions, SuggestionsPanel } from '../features/suggestions';
import { getGoogleCalendarStatus, GoogleCalendarSettings, syncGoogleCalendar } from '../features/integrations';
import { Brain } from 'lucide-react';
import {
  loadPomodoroSettings,
  PomodoroOverlay,
  PomodoroSettings,
  savePomodoroSettings,
  TomatoIcon,
  type PomodoroLaunchRequest,
  type PomodoroSettingsValue,
} from '../features/pomodoro';

import { useAuth } from '../features/auth';
import { useTasks } from '../features/tasks';
import { getSpaces, createSpace, deleteSpace, updateSpace } from '../features/spaces';
import { getMe, uploadAvatar } from '../features/users';
import { getProjects, createProject, deleteProject, updateProject, ProjectSettingsModal } from '../features/projects';
import { SpaceSettingsModal } from '../features/spaces/ui';
import { ProjectView } from '../views/ProjectView';
import { BrandMark } from '../shared/ui/BrandMark';
import { AppHeaderSkeleton, DashboardSkeleton, NotesSkeleton, SettingsSkeleton, SkeletonBlock } from '../shared/ui/LoadingSkeletons';
import type { Note, User, Space, Project, Task } from '../shared/types';
import { TaskPriority } from '../shared/types';

type ActiveTab = 'dashboard' | 'notes' | 'tasks' | 'brain' | 'calendar' | 'settings';
type ThemePreference = 'light' | 'dark' | 'gray' | 'system';
type EffectiveTheme = 'light' | 'dark' | 'gray';

export function AppShell() {
  const { isAuthReady, isLoggedIn, logout, initGoogleButton } = useAuth();
  const { tasks, isLoading: isTasksLoading, addTask, editTask, removeTask, refreshTasks } = useTasks(isLoggedIn);
  const {
    suggestions: aiSuggestions,
    quota: aiQuota,
    isGenerating: aiGenerating,
    isLoading: isSuggestionsLoading,
    notice: aiNotice,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
    generate: generateAiSuggestions,
  } = useSuggestions(isLoggedIn, refreshTasks);

  const [user, setUser] = useState<User | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [avatarSuccess, setAvatarSuccess] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [taskViewMode, setTaskViewMode] = useState<'list' | 'week' | 'board'>('list');
  const [isUserLoading, setIsUserLoading] = useState(false);
  const [isStructureLoading, setIsStructureLoading] = useState(false);
  const hasLoadedUserRef = useRef(false);
  const hasLoadedStructureRef = useRef(false);
  const [spaceSettingsId, setSpaceSettingsId] = useState<string | null>(null);
  const [projectSettingsId, setProjectSettingsId] = useState<string | null>(null);
  const [activeSpaceId, setActiveSpaceId] = useState<string | null>(null);

  const [spaces, setSpaces] = useState<Space[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const [googleNotice, setGoogleNotice] = useState<string | null>(null);
  const [settingsSection, setSettingsSection] = useState<'account' | 'pomodoro'>('account');
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettingsValue>(loadPomodoroSettings);
  const [pomodoroLaunchRequest, setPomodoroLaunchRequest] = useState<PomodoroLaunchRequest | null>(null);

  useEffect(() => {
    savePomodoroSettings(pomodoroSettings);
  }, [pomodoroSettings]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get('google');
    if (!result) return;
    const message = result === 'select-calendar'
      ? 'Konto Google zostało połączone. Wybierz kalendarz, który chcesz synchronizować.'
      : result === 'connected'
        ? 'Połączono z Google Calendar. Wydarzenia będą się synchronizować.'
        : 'Nie udało się połączyć z Google Calendar. Spróbuj ponownie.';
    params.delete('google');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    void Promise.resolve().then(() => {
      setActiveTab('settings');
      setGoogleNotice(message);
    });
  }, []);

  useEffect(() => {
    if (!isLoggedIn) return;

    let cancelled = false;
    const repairGoogleCalendar = async () => {
      try {
        await syncGoogleCalendar();
      } catch {
        // The status below explains whether reconnecting is required.
      }

      try {
        const status = await getGoogleCalendarStatus();
        if (cancelled) return;

        if (status.requiresReconnect) {
          setGoogleNotice('Połączenie z Google Calendar wygasło. Połącz konto ponownie w ustawieniach.');
        } else if (status.connected && !status.sourceCalendarId) {
          setGoogleNotice('Wybierz kalendarz Google, który chcesz synchronizować.');
        }
      } catch {
        // Login should not fail because an optional integration is temporarily unavailable.
      }
    };

    void repairGoogleCalendar();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const [theme, setTheme] = useState<ThemePreference>(() => {
    const stored = localStorage.getItem('mindflow_theme');
    if (stored === 'light' || stored === 'dark' || stored === 'gray' || stored === 'system') return stored;
    return 'system';
  });
  const [systemPrefersDark, setSystemPrefersDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);

  const [agendaPosition, setAgendaPosition] = useState<AgendaPosition>(() => {
    const stored = localStorage.getItem('mindflow_agenda_position');
    if (stored === 'bottom-right' || stored === 'bottom-left' || stored === 'top-right' || stored === 'top-left') return stored;
    return 'bottom-right';
  });

  useEffect(() => {
    localStorage.setItem('mindflow_agenda_position', agendaPosition);
  }, [agendaPosition]);

  const effectiveTheme: EffectiveTheme =
    theme === 'system'
      ? (systemPrefersDark ? 'gray' : 'light')
      : theme;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);

    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  useEffect(() => {
    document.documentElement.classList.remove('dark', 'theme-gray');
    if (effectiveTheme === 'dark') document.documentElement.classList.add('dark');
    else if (effectiveTheme === 'gray') document.documentElement.classList.add('dark', 'theme-gray');
    const favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (favicon) {
      favicon.href = effectiveTheme === 'light' ? '/mindle_mark_black.svg' : '/mindle_mark_white.svg';
    }
    localStorage.setItem('mindflow_theme', theme);
  }, [effectiveTheme, theme]);

  useEffect(() => {
    if (!isLoggedIn) {
      hasLoadedUserRef.current = false;
      void Promise.resolve().then(() => {
        setUser(null);
        setIsUserLoading(false);
      });
      return;
    }

    let cancelled = false;
    if (!hasLoadedUserRef.current) setIsUserLoading(true);

    getMe()
      .then(nextUser => {
        if (!cancelled) setUser(nextUser);
      })
      .catch(error => {
        console.error('Failed to fetch user profile:', error);
      })
      .finally(() => {
        if (!cancelled) {
          hasLoadedUserRef.current = true;
          setIsUserLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn]);

  const fetchSpaces = useCallback(async () => {
    if (!hasLoadedStructureRef.current) setIsStructureLoading(true);
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
    } finally {
      hasLoadedStructureRef.current = true;
      setIsStructureLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoggedIn) {
      hasLoadedStructureRef.current = false;
      void Promise.resolve().then(() => {
        setSpaces([]);
        setProjects([]);
        setIsStructureLoading(false);
      });
      return;
    }
    void Promise.resolve().then(fetchSpaces);
  }, [isLoggedIn, fetchSpaces]);

  const handleAddTask = async (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../shared/types').TaskStatus, description?: string, tags?: string[], subtasks?: import('../shared/types').Subtask[], estimatedHours?: number) => {
    const finalProjectId = projectId || (activeProjectId !== null ? activeProjectId : undefined);
    return addTask(content, finalProjectId, status, description, priority, dueDate, tags, subtasks, estimatedHours);
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

  const handleUpdateProject = async (id: string, name: string, color: string) => {
    const project = projects.find(p => p.id === id);
    if (!project?.space_id) return;

    try {
      const updated = await updateProject(project.space_id, id, { name, color });
      setProjects(prev => prev.map(p => p.id === id ? { ...p, ...updated, space_id: updated.spaceId } : p));
    } catch (e) {
      console.error('Failed to update project', e);
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
    setAvatarError(null);
    setAvatarSuccess(null);
    localStorage.removeItem('mindflow_user');
    setNotes([]);
    setActiveTab('dashboard');
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    const allowedTypes = ['image/png', 'image/jpeg'];
    if (!allowedTypes.includes(file.type)) {
      setAvatarSuccess(null);
      setAvatarError('Dozwolone są tylko pliki PNG, JPG i JPEG.');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      setAvatarSuccess(null);
      setAvatarError('Avatar może mieć maksymalnie 25 MB.');
      return;
    }

    try {
      setIsUploadingAvatar(true);
      setAvatarError(null);
      const updatedUser = await uploadAvatar(file);
      setUser(updatedUser);
      setAvatarSuccess('Avatar został zaktualizowany.');
    } catch (error) {
      setAvatarSuccess(null);
      setAvatarError(error instanceof Error ? error.message.replace(/^HTTP \d+:\s*/, '') : 'Nie udało się zaktualizować avatara.');
    } finally {
      setIsUploadingAvatar(false);
    }
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
  const todayTasks = tasks.filter(t => {
    if (t.isCompleted) return false;
    if (t.dueDate && t.dueDate <= todayStr) return true;
    return t.dueSubtasks?.some(subtask => !subtask.isCompleted && subtask.dueDate && subtask.dueDate <= todayStr) ?? false;
  });
  const importantTasks = tasks.filter(t => !t.isCompleted && t.priority === TaskPriority.P1 && (!t.dueDate || t.dueDate > todayStr));

  const activeSpaceProjectIds = activeSpaceId
    ? new Set(projects.filter(p => p.space_id === activeSpaceId).map(p => p.id))
    : null;
  const matchesActiveSpace = (task: Task) => !activeSpaceProjectIds || (!!task.project_id && activeSpaceProjectIds.has(task.project_id));
  const spaceTasks = activeSpaceProjectIds ? tasks.filter(matchesActiveSpace) : tasks;
  const spaceSortedTasks = activeSpaceProjectIds ? sortedAllTasks.filter(matchesActiveSpace) : sortedAllTasks;
  const isWorkspaceLoading = isTasksLoading || isStructureLoading;
  const isAppDataLoading = isWorkspaceLoading || isUserLoading;

  if (!isAuthReady) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-[#FDFDFD] text-[#0f1115] dark:bg-[#000000] dark:text-white">
        <BrandMark markClassName="h-11 w-11" />
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginScreen initGoogleButton={initGoogleButton} />;
  }

  const activeProject = projects.find(p => p.id === activeProjectId);
  const showProjectView = activeTab === 'tasks' && !!activeProjectId && !!activeProject;

  const mobileBottomNav = (
    <nav className="lg:hidden fixed bottom-0 left-0 w-full bg-white/95 dark:bg-black/90 backdrop-blur-xl border-t border-gray-100/50 dark:border-white/5 z-50 px-6 pt-3 pb-8 flex justify-between items-center shadow-lg shadow-gray-200/50 dark:shadow-none transition-colors duration-300">
      <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'dashboard' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        <span className="text-[10px] font-medium">Centrum</span>
      </button>
      <button onClick={() => { setActiveTab('tasks'); setActiveProjectId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'tasks' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span className="text-[10px] font-medium">Zadania</span>
      </button>
      <button onClick={() => { setActiveTab('brain'); setActiveProjectId(null); }} className={`flex flex-col items-center gap-1 transition-colors ${activeTab === 'brain' ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
        <Brain className="h-6 w-6" />
        <span className="text-[10px] font-medium">Brain</span>
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
        {isUserLoading ? (
          <SkeletonBlock className="h-6 w-6 rounded-full" />
        ) : (
          <div className="w-6 h-6 rounded-full overflow-hidden bg-gray-100 dark:bg-white/10">
            {user?.avatarUrl && <img src={user.avatarUrl} alt="Profile" className="w-full h-full object-cover" />}
          </div>
        )}
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
        onOpenProjectSettings={(id) => setProjectSettingsId(id)}
        onCreateSpace={handleCreateSpace}
        onDeleteSpace={handleDeleteSpace}
        onOpenSpaceSettings={(id) => setSpaceSettingsId(id)}
        onOpenJoinSpace={() => {}}
        isLoading={isAppDataLoading}
      />

      <main className="flex-1 overflow-hidden relative flex flex-col">
        {showProjectView && (
          <ProjectView
            projectId={activeProjectId}
            project={activeProject}
            projects={projects}
            spaces={spaces}
            activeSpaceId={activeSpaceId}
            taskCountByProjectId={activeTaskCountByProjectId}
            onSelectSpace={setActiveSpaceId}
            onSelectProject={setActiveProjectId}
          />
        )}

        {!showProjectView && (
          <>
            <header className="flex-none px-6 pt-8 pb-4 lg:py-8 flex flex-col lg:flex-row lg:items-end justify-between animate-fade-in gap-4">
              {activeTab === 'dashboard' && isAppDataLoading ? (
                <AppHeaderSkeleton />
              ) : (
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight text-gray-900 dark:text-white">
                    {activeTab === 'dashboard' && `Dzień dobry, ${user?.firstName ?? 'Użytkowniku'}.`}
                    {activeTab === 'notes' && 'Twoja baza wiedzy.'}
                    {activeTab === 'tasks' && 'Wszystkie zadania.'}
                    {activeTab === 'brain' && 'Brain.'}
                    {activeTab === 'calendar' && 'Kalendarz.'}
                    {activeTab === 'settings' && 'Ustawienia.'}
                  </h1>
                  <p className="text-gray-400 dark:text-gray-500 mt-1 lg:mt-2 font-medium text-sm lg:text-base">
                    {activeTab === 'dashboard' && `Masz ${tasks.filter(t => !t.isCompleted).length} zadań do zrobienia.`}
                    {activeTab === 'tasks' && 'Zarządzaj swoimi zadaniami efektywnie.'}
                    {activeTab === 'brain' && 'Mapa celów i zależności.'}
                    {activeTab === 'calendar' && 'Planuj dzień, tydzień i miesiąc z timeblockingiem.'}
                    {activeTab === 'settings' && 'Dostosuj aplikację do swoich potrzeb.'}
                  </p>
                </div>
              )}

              {activeTab === 'tasks' && (
                <div className="mf-segmented">
                  {(['list', 'week', 'board'] as const).map(mode => (
                    <button
                      key={mode}
                      onClick={() => setTaskViewMode(mode)}
                      className={`mf-segmented-option ${taskViewMode === mode ? 'is-active' : ''}`}
                    >
                      {{ list: 'Lista', week: 'Tydzień', board: 'Tablica' }[mode]}
                    </button>
                  ))}
                </div>
              )}
            </header>

            <div
              className={`min-h-0 flex-1 custom-scrollbar px-6 ${
                activeTab === 'calendar' || activeTab === 'brain'
                  ? 'overflow-hidden pb-28 lg:pb-6'
                  : 'overflow-y-auto pb-36 lg:pb-24'
              }`}
            >
              {activeTab === 'dashboard' && (
                <div className="mx-auto w-full max-w-5xl space-y-8 animate-fade-in">
                  {isAppDataLoading ? (
                    <DashboardSkeleton />
                  ) : (
                    <>
                  <SuggestionsPanel
                    suggestions={aiSuggestions}
                    quota={aiQuota}
                    isGenerating={aiGenerating}
                    isLoading={isSuggestionsLoading}
                    notice={aiNotice}
                    onGenerate={generateAiSuggestions}
                    onAccept={acceptSuggestion}
                    onReject={rejectSuggestion}
                  />

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
                      <TaskList tasks={todayTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isWorkspaceLoading} showDueSubtasks />
                    </div>
                  )}

                  {importantTasks.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Ważne (P1)</h2>
                      <TaskList tasks={importantTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isWorkspaceLoading} />
                    </div>
                  )}

                  {notes.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Ostatnie notatki</h2>
                      <NotesGrid notes={notes.slice(0, 4)} onAdd={handleAddNote} onEdit={handleEditNote} onDelete={handleDeleteNote} compactMode isLoading={false} />
                    </div>
                  )}

                  {todayTasks.length === 0 && importantTasks.length === 0 && notes.length === 0 && !isAppDataLoading && (
                    <div className="flex flex-col items-center justify-center py-24 animate-fade-in">
                      <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mb-4">
                        <svg className="w-8 h-8 text-gray-300 dark:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      </div>
                      <p className="text-gray-400 dark:text-gray-500 font-medium">Wszystko gotowe. Dodaj pierwsze zadanie!</p>
                    </div>
                  )}
                    </>
                  )}
                </div>
              )}

              {activeTab === 'tasks' && (
                <>
                  <MobileTasksNav
                    spaces={spaces}
                    projects={projects}
                    activeSpaceId={activeSpaceId}
                    activeProjectId={activeProjectId}
                    taskCountByProjectId={activeTaskCountByProjectId}
                    onSelectSpace={setActiveSpaceId}
                    onSelectProject={setActiveProjectId}
                    isLoading={isWorkspaceLoading}
                  />

                  <div className={`animate-fade-in ${taskViewMode === 'week' ? 'h-full -mx-6 px-6' : taskViewMode === 'board' ? 'h-full' : 'max-w-3xl mx-auto'}`}>
                    {taskViewMode === 'list' && (
                      <TaskListGrouped
                        tasks={spaceSortedTasks}
                        projects={projects}
                        onToggle={handleToggleTask}
                        onEdit={handleEditTask}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                        onBulkEdit={handleBulkEdit}
                        onClearCompleted={handleClearCompleted}
                        isLoading={isWorkspaceLoading}
                        activeProjectId={null}
                      />
                    )}
                    {taskViewMode === 'week' && (
                      <div className="h-[calc(100vh-200px)]">
                        <TaskWeekView
                          tasks={spaceSortedTasks}
                          projects={projects}
                          onEdit={handleEditTask}
                          onToggle={handleToggleTask}
                          onAdd={handleAddTask}
                          onDelete={handleDeleteTask}
                          isLoading={isWorkspaceLoading}
                        />
                      </div>
                    )}
                    {taskViewMode === 'board' && (
                      <TaskBoardView
                        tasks={spaceTasks}
                        projects={projects}
                        onEdit={handleEditTask}
                        onToggle={handleToggleTask}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                        isLoading={isWorkspaceLoading}
                      />
                    )}
                  </div>

                  {!isWorkspaceLoading && <QuickAddTask activeProjectId={null} projects={projects} onAdd={handleAddTask} />}
                </>
              )}

              {activeTab === 'brain' && (
                <div className="h-full min-h-0 animate-fade-in">
                  <BrainView />
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="h-full min-h-0 animate-fade-in">
                  <CalendarView
                    tasks={sortedAllTasks}
                    projects={projects}
                    onAdd={handleAddTask}
                    onEdit={handleEditTask}
                    onToggle={handleToggleTask}
                    onDelete={handleDeleteTask}
                    onStartFocus={setPomodoroLaunchRequest}
                    isLoading={isWorkspaceLoading}
                  />
                </div>
              )}

              {activeTab === 'notes' && (
                <div className="animate-fade-in">
                  {isAppDataLoading ? (
                    <NotesSkeleton />
                  ) : (
                    <NotesGrid notes={notes} onAdd={handleAddNote} onEdit={handleEditNote} onDelete={handleDeleteNote} isLoading={false} />
                  )}
                </div>
              )}

              {activeTab === 'settings' && (
                <div className="mx-auto w-full max-w-3xl animate-fade-in">
                  <div className="mb-3 flex w-fit rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] p-1 dark:border-white/10 dark:bg-[#232326]">
                    <button
                      type="button"
                      onClick={() => setSettingsSection('account')}
                      className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/15 ${settingsSection === 'account' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                    >
                      Konto i wygląd
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSection('pomodoro')}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/15 ${settingsSection === 'pomodoro' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                    >
                      <TomatoIcon className="h-4 w-4" /> Pomodoro
                    </button>
                  </div>
                  <div className="overflow-visible rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_8px_24px_-6px_rgba(15,17,21,.08)] transition-colors duration-300 dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
                    {settingsSection === 'account' && isUserLoading ? (
                      <SettingsSkeleton framed={false} />
                    ) : settingsSection === 'account' ? (
                      <>
                    <div className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Ustawienia konta</p>
                      <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">Profil i wygląd</h2>
                      <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Dostosuj konto i wybierz motyw, który najlepiej pasuje do Twojego rytmu pracy.</p>
                    </div>

                    <div className="divide-y divide-[#f1f0ed] dark:divide-white/6">
                      <section className="px-6 py-5">
                        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex items-center gap-4">
                            <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border border-[#e8e8e4] bg-[#f7f7f4] dark:border-white/10 dark:bg-white/5">
                              {user?.avatarUrl ? (
                                <img src={user.avatarUrl} alt="Avatar" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-lg font-semibold text-[#0f1115] dark:text-white">
                                  {user?.firstName?.[0]}
                                  {user?.lastName?.[0]}
                                </span>
                              )}
                            </div>
                            <div>
                              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Profil</p>
                              <p className="mt-1 text-base font-semibold text-[#0f1115] dark:text-white">{user ? `${user.firstName} ${user.lastName}` : ''}</p>
                              <p className="text-sm text-[#5a606b] dark:text-gray-400">{user?.email}</p>
                            </div>
                          </div>

                          <div className="flex flex-col items-stretch gap-2 sm:items-end">
                            <input
                              ref={avatarInputRef}
                              type="file"
                              accept=".png,.jpg,.jpeg,image/png,image/jpeg"
                              onChange={handleAvatarChange}
                              className="hidden"
                            />
                            <button
                              type="button"
                              onClick={() => avatarInputRef.current?.click()}
                              disabled={isUploadingAvatar}
                              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#e8e8e4] bg-[#f7f7f4] px-4 text-sm font-medium text-[#0f1115] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:border-[#d9d9d4] hover:bg-[#f1f0ed] focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] focus:ring-offset-2 focus:ring-offset-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:hover:bg-white/8 dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E]"
                            >
                              {isUploadingAvatar ? 'Wgrywanie...' : 'Zmień avatar'}
                            </button>
                            <button
                              onClick={handleLogout}
                              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#f3d4d4] bg-[#fff8f8] px-4 text-sm font-medium text-[#b93838] transition-[background-color,border-color,color,transform,opacity] duration-200 ease hover:-translate-y-px hover:border-[#efc3c3] hover:bg-[#fff1f1] focus:outline-none focus:ring-2 focus:ring-[#efc3c3] focus:ring-offset-2 focus:ring-offset-white dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-300 dark:hover:bg-red-950/30 dark:focus:ring-red-900/60 dark:focus:ring-offset-[#1C1C1E]"
                            >
                              Wyloguj się
                            </button>
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-[#f1f0ed] bg-[#fcfcfa] px-4 py-3 transition-colors duration-200 dark:border-white/8 dark:bg-white/[0.03]">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Avatar</p>
                          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Obsługiwane formaty: PNG, JPG, JPEG. Maksymalny rozmiar: 25 MB. Przechowujemy tylko jedno zdjęcie na użytkownika i każde kolejne nadpisuje poprzednie.</p>
                          {avatarError && (
                            <p className="mt-2 text-sm text-[#b93838] dark:text-red-300">{avatarError}</p>
                          )}
                          {avatarSuccess && (
                            <p className="mt-2 text-sm text-[#2f7a52] dark:text-emerald-300">{avatarSuccess}</p>
                          )}
                        </div>
                      </section>

                      <section className="px-6 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="max-w-md">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Wygląd</p>
                            <p className="mt-1 text-base font-semibold text-[#0f1115] dark:text-white">Motyw interfejsu</p>
                            <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Tryb systemowy używa jasnego wyglądu, a przy ciemnym systemie automatycznie przełącza aplikację na szary wariant.</p>
                          </div>
                          <ThemeSelector theme={theme} setTheme={setTheme} />
                        </div>
                      </section>

                      <section className="px-6 py-5">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="max-w-md">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Przegląd dnia</p>
                            <p className="mt-1 text-base font-semibold text-[#0f1115] dark:text-white">Pozycja widżetu</p>
                            <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Widżet pokazuje aktualny blok z kalendarza, ile zostało do jego końca oraz następny blok. Możesz go zwinąć do zakładki przy krawędzi.</p>
                          </div>
                          <AgendaPositionSelector position={agendaPosition} setPosition={setAgendaPosition} />
                        </div>
                      </section>

                      <section className="px-6 py-5">
                        {googleNotice && (
                          <div className="mb-4 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-4 py-3 text-sm text-[#5a606b] dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-300">
                            {googleNotice}
                          </div>
                        )}
                        <GoogleCalendarSettings isLoggedIn={isLoggedIn} />
                      </section>
                    </div>
                      </>
                    ) : (
                      <>
                        <div className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Ustawienia timera</p>
                          <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">Pomodoro</h2>
                          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Dopasuj rytm skupienia i przerw do swojego sposobu pracy.</p>
                        </div>
                        <PomodoroSettings settings={pomodoroSettings} onChange={setPomodoroSettings} />
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

          </>
        )}

        {mobileBottomNav}
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
      {projectSettingsId && (() => {
        const project = projects.find(p => p.id === projectSettingsId);
        if (!project) return null;
        return (
          <ProjectSettingsModal
            project={project}
            onClose={() => setProjectSettingsId(null)}
            onUpdateProject={handleUpdateProject}
            onDeleteProject={handleDeleteProject}
            onTagsChanged={refreshTasks}
          />
        );
      })()}

      <PomodoroOverlay settings={pomodoroSettings} launchRequest={pomodoroLaunchRequest} />
      <AgendaOverlay enabled={isLoggedIn} tasks={tasks} position={agendaPosition} isLoading={isWorkspaceLoading} />
    </div>
  );
}
