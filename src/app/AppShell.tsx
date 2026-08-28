import { useCallback, useEffect, useRef, useState } from 'react';
import { LoginScreen } from '../features/auth/ui';
import { Sidebar, MobileTasksNav, ThemeSelector, AgendaOverlay, AgendaPositionSelector, type AgendaPosition } from '../features/layout/ui';
import { CalendarView, TaskList, TaskListGrouped, TaskWeekView, TaskBoardView, QuickAddTask } from '../features/tasks/ui';
import { NotesGrid } from '../features/notes/ui';
import { BrainView } from '../features/brain';
import { GoalsView } from '../features/goals';
import { InsightsView } from '../features/insights';
import { useSuggestions, SuggestionsPanel } from '../features/suggestions';
import { ApiIntegrationsSettings, getGoogleCalendarStatus, GoogleCalendarSettings, syncGoogleCalendar } from '../features/integrations';
import { NotificationCenter, PushNotificationsSettings } from '../features/notifications';
import { BarChart3, Bell, CalendarDays, CheckCircle2, Plug, UserRound } from 'lucide-react';
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
import type { CompleteTaskDto, CreateTaskTimeEntryDto } from '../features/tasks/api/timeEntriesApi';
import { SpaceSettingsModal } from '../features/spaces/ui';
import { ProjectView } from '../views/ProjectView';
import { BrandMark } from '../shared/ui/BrandMark';
import { useConfirmDialog } from '../shared/ui/confirmDialog';
import { AppHeaderSkeleton, DashboardSkeleton, NotesSkeleton, SettingsSkeleton, SkeletonBlock } from '../shared/ui/LoadingSkeletons';
import type { Note, User, Space, Project, Task } from '../shared/types';
import { TaskPriority } from '../shared/types';

type ActiveTab = 'dashboard' | 'inbox' | 'notes' | 'tasks' | 'goals' | 'insights' | 'brain' | 'calendar' | 'settings';
type ThemePreference = 'light' | 'dark' | 'gray' | 'system';
type EffectiveTheme = 'light' | 'dark' | 'gray';

const MOBILE_MEDIA_QUERY = '(max-width: 1023px)';

function getIsMobileViewport() {
  return typeof window !== 'undefined' && window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function AppShell() {
  const { confirm } = useConfirmDialog();
  const { isAuthReady, isLoggedIn, logout, initGoogleButton } = useAuth();
  const { tasks, isLoading: isTasksLoading, addTask, editTask, completeTask, logTimeEntry, removeTask, refreshTasks } = useTasks(isLoggedIn);
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
  const [isMobileViewport, setIsMobileViewport] = useState(getIsMobileViewport);
  const [activeTab, setActiveTab] = useState<ActiveTab>(() => getIsMobileViewport() ? 'tasks' : 'dashboard');
  const [selectedNotificationId, setSelectedNotificationId] = useState<string | null>(null);
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
  const [settingsSection, setSettingsSection] = useState<'account' | 'notifications' | 'integrations' | 'pomodoro'>('account');
  const [pomodoroSettings, setPomodoroSettings] = useState<PomodoroSettingsValue>(loadPomodoroSettings);
  const [pomodoroLaunchRequest, setPomodoroLaunchRequest] = useState<PomodoroLaunchRequest | null>(null);

  useEffect(() => {
    const media = window.matchMedia(MOBILE_MEDIA_QUERY);
    const handleChange = (event: MediaQueryListEvent) => {
      setIsMobileViewport(event.matches);
      if (event.matches) {
        setActiveTab(current => (
          current === 'tasks' || current === 'insights' || current === 'calendar' || current === 'settings'
            ? current
            : 'tasks'
        ));
        setSettingsSection(current => current === 'pomodoro' ? 'account' : current);
      }
    };
    media.addEventListener('change', handleChange);
    return () => media.removeEventListener('change', handleChange);
  }, []);

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
      setSettingsSection('integrations');
      setGoogleNotice(message);
    });
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const notificationId = params.get('notification');
    if (!notificationId || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(notificationId)) return;

    params.delete('notification');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}`);
    void Promise.resolve().then(() => {
      setActiveTab('inbox');
      setSelectedNotificationId(notificationId);
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

  const handleAddTask = async (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../shared/types').TaskStatus, description?: string, tags?: string[], subtasks?: import('../shared/types').Subtask[], estimatedHours?: number, dueTime?: string) => {
    const finalProjectId = projectId === ''
      ? undefined
      : projectId || (activeProjectId !== null ? activeProjectId : undefined);
    return addTask(content, finalProjectId, status, description, priority, dueDate, tags, subtasks, estimatedHours, dueTime);
  };

  const handleEditTask = async (id: string, updates: Partial<Task>) => {
    await editTask(id, updates);
  };

  const handleCompleteTask = async (id: string, dto: CompleteTaskDto) => {
    await completeTask(id, dto);
  };

  const handleLogTimeEntry = async (id: string, dto: CreateTaskTimeEntryDto) => {
    await logTimeEntry(id, dto);
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

  const handleClearCompleted = async () => {
    const toDelete = tasks.filter(t => t.isCompleted);
    if (toDelete.length === 0) return;
    const confirmed = await confirm({
      title: 'Usunąć wykonane zadania?',
      message: `Zostanie usuniętych ${toDelete.length} wykonanych zadań. Tej akcji nie da się cofnąć.`,
      confirmLabel: 'Usuń zadania',
      tone: 'danger',
    });
    if (!confirmed) return;
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
    setActiveTab(isMobileViewport ? 'tasks' : 'dashboard');
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
  const effectiveMobileProjectId = isMobileViewport && activeSpaceId && activeProjectId
    && !projects.some(project => project.id === activeProjectId && project.space_id === activeSpaceId)
    ? null
    : activeProjectId;
  const visibleMobileTasks = isMobileViewport && effectiveMobileProjectId
    ? spaceSortedTasks.filter(task => task.project_id === effectiveMobileProjectId)
    : spaceSortedTasks;
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
  const mobileQuickAddProjectId = effectiveMobileProjectId ?? (
    isMobileViewport && activeSpaceId
      ? projects.find(project => project.space_id === activeSpaceId)?.id ?? null
      : null
  );
  const mobileQuickAddProjects = isMobileViewport && activeSpaceId
    ? projects.filter(project => project.space_id === activeSpaceId)
    : projects;
  const showProjectView = !isMobileViewport && activeTab === 'tasks' && !!activeProjectId && !!activeProject;

  const mobileNavButtonClass = (tab: ActiveTab) =>
    `flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-lg transition-[background-color,color] duration-200 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115] ${
      activeTab === tab
        ? 'text-[#0f1115] dark:text-white'
        : 'text-[#9098a4] active:bg-[#f1f0ed] dark:text-gray-500 dark:active:bg-white/8'
    }`;

  const mobileBottomNav = (
    <nav
      aria-label="Główna nawigacja"
      className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-4 border-t border-[#e8e8e4]/80 bg-white/95 px-4 pt-1.5 pb-[max(0.5rem,calc(0.375rem+env(safe-area-inset-bottom)))] backdrop-blur-xl transition-colors duration-200 ease lg:hidden dark:border-white/8 dark:bg-black/92"
    >
      <button onClick={() => setActiveTab('tasks')} className={mobileNavButtonClass('tasks')}>
        <CheckCircle2 className="h-[22px] w-[22px]" strokeWidth={activeTab === 'tasks' ? 2.4 : 1.9} />
        <span className="text-[10.5px] font-medium">Zadania</span>
      </button>
      <button onClick={() => { setActiveTab('insights'); setActiveProjectId(null); }} className={mobileNavButtonClass('insights')}>
        <BarChart3 className="h-[22px] w-[22px]" strokeWidth={activeTab === 'insights' ? 2.4 : 1.9} />
        <span className="text-[10.5px] font-medium">Insights</span>
      </button>
      <button onClick={() => { setActiveTab('calendar'); setActiveProjectId(null); }} className={mobileNavButtonClass('calendar')}>
        <CalendarDays className="h-[22px] w-[22px]" strokeWidth={activeTab === 'calendar' ? 2.4 : 1.9} />
        <span className="text-[10.5px] font-medium">Kalendarz</span>
      </button>
      <button onClick={() => setActiveTab('settings')} className={mobileNavButtonClass('settings')}>
        {isUserLoading ? (
          <SkeletonBlock className="h-[22px] w-[22px] rounded-full" />
        ) : user?.avatarUrl ? (
          <div className={`h-[22px] w-[22px] overflow-hidden rounded-full ${activeTab === 'settings' ? 'ring-1 ring-[#0f1115] ring-offset-1 dark:ring-white dark:ring-offset-black' : ''}`}>
            <img src={user.avatarUrl} alt="Profil" className="h-full w-full object-cover" />
          </div>
        ) : (
          <UserRound className="h-[22px] w-[22px]" strokeWidth={activeTab === 'settings' ? 2.4 : 1.9} />
        )}
        <span className="text-[10.5px] font-medium">Profil</span>
      </button>
    </nav>
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#FDFDFD] font-sans text-gray-900 transition-colors duration-300 lg:h-screen dark:bg-[#000000] dark:text-gray-100">
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
            <header className={`${activeTab === 'insights' ? 'hidden lg:flex' : 'flex'} relative ${activeTab === 'tasks' ? 'z-[30]' : 'z-auto'} flex-none items-center justify-between gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))] animate-fade-in lg:static lg:z-auto lg:flex-row lg:items-end lg:px-6 lg:py-8`}>
              {activeTab === 'dashboard' && isAppDataLoading ? (
                <AppHeaderSkeleton />
              ) : (
                <div>
                  <h1 className="text-[26px] font-bold tracking-[-0.025em] text-gray-900 lg:text-3xl dark:text-white">
                    {activeTab === 'dashboard' && `Dzień dobry, ${user?.firstName ?? 'Użytkowniku'}.`}
                    {activeTab === 'inbox' && 'Powiadomienia.'}
                    {activeTab === 'notes' && 'Twoja baza wiedzy.'}
                    {activeTab === 'tasks' && <><span className="lg:hidden">Zadania</span><span className="hidden lg:inline">Wszystkie zadania.</span></>}
                    {activeTab === 'goals' && 'Cele.'}
                    {activeTab === 'insights' && 'Insights.'}
                    {activeTab === 'brain' && 'Brain.'}
                    {activeTab === 'calendar' && 'Kalendarz.'}
                    {activeTab === 'settings' && <><span className="lg:hidden">Profil</span><span className="hidden lg:inline">Ustawienia.</span></>}
                  </h1>
                  <p className="mt-1 hidden text-sm font-medium text-gray-400 lg:mt-2 lg:block lg:text-base dark:text-gray-500">
                    {activeTab === 'dashboard' && `Masz ${tasks.filter(t => !t.isCompleted).length} zadań do zrobienia.`}
                    {activeTab === 'inbox' && 'Briefy i podsumowania dnia, które możesz przeczytać w dowolnym momencie.'}
                    {activeTab === 'tasks' && 'Zarządzaj swoimi zadaniami efektywnie.'}
                    {activeTab === 'goals' && 'Planuj dzień wokół konkretnych wyników i nawyków.'}
                    {activeTab === 'insights' && 'Przegląd zarejestrowanego czasu pracy.'}
                    {activeTab === 'brain' && 'Mapa celów i zależności.'}
                    {activeTab === 'calendar' && 'Planuj dzień, tydzień i miesiąc z timeblockingiem.'}
                    {activeTab === 'settings' && 'Dostosuj aplikację do swoich potrzeb.'}
                  </p>
                </div>
              )}

              <div className="flex min-w-0 items-center gap-2 lg:self-auto">
                {activeTab === 'tasks' && (
                  <>
                    <MobileTasksNav
                      spaces={spaces}
                      projects={projects}
                      activeSpaceId={activeSpaceId}
                      activeProjectId={effectiveMobileProjectId}
                      taskCountByProjectId={activeTaskCountByProjectId}
                      onSelectSpace={setActiveSpaceId}
                      onSelectProject={setActiveProjectId}
                      isLoading={isWorkspaceLoading}
                    />
                    <div className="mf-segmented hidden lg:flex">
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
                  </>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('inbox');
                    setActiveProjectId(null);
                  }}
                  title="Otwórz centrum powiadomień"
                  aria-label="Otwórz centrum powiadomień"
                  className={`hidden h-10 w-10 items-center justify-center rounded-lg border transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-[#d9d9d4] lg:inline-flex dark:focus:ring-white/15 ${
                    activeTab === 'inbox'
                      ? 'border-[#d9d9d4] bg-[#f1f0ed] text-[#0f1115] dark:border-white/15 dark:bg-white/10 dark:text-white'
                      : 'border-[#e8e8e4] bg-[#f7f7f4] text-[#5a606b] hover:bg-[#f1f0ed] dark:border-white/10 dark:bg-white/5 dark:text-gray-300 dark:hover:bg-white/8'
                  }`}
                >
                  <Bell size={18} />
                </button>
              </div>
            </header>

            <div
              className={`min-h-0 flex-1 custom-scrollbar px-4 lg:px-6 ${
                activeTab === 'calendar' || activeTab === 'brain' || activeTab === 'insights'
                  ? 'overflow-hidden pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-6'
                  : 'overflow-y-auto pb-[calc(7.5rem+env(safe-area-inset-bottom))] lg:pb-24'
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
                      <TaskList tasks={todayTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onComplete={handleCompleteTask} onLogTime={handleLogTimeEntry} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isWorkspaceLoading} showDueSubtasks />
                    </div>
                  )}

                  {importantTasks.length > 0 && (
                    <div>
                      <h2 className="text-sm font-bold text-gray-900 dark:text-white mb-4 uppercase tracking-wider">Ważne (P1)</h2>
                      <TaskList tasks={importantTasks} projects={projects} onToggle={handleToggleTask} onEdit={handleEditTask} onComplete={handleCompleteTask} onLogTime={handleLogTimeEntry} onDelete={handleDeleteTask} onAdd={handleAddTask} compactMode isLoading={isWorkspaceLoading} />
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

              {activeTab === 'inbox' && (
                <NotificationCenter
                  isLoggedIn={isLoggedIn}
                  selectedNotificationId={selectedNotificationId}
                />
              )}

              {activeTab === 'tasks' && (
                <>
                  <div className={`animate-fade-in ${!isMobileViewport && taskViewMode === 'week' ? 'h-full -mx-6 px-6' : !isMobileViewport && taskViewMode === 'board' ? 'h-full' : 'max-w-3xl mx-auto'}`}>
                    {(isMobileViewport || taskViewMode === 'list') && (
                      <TaskListGrouped
                        tasks={visibleMobileTasks}
                        projects={projects}
                        onToggle={handleToggleTask}
                        onEdit={handleEditTask}
                        onComplete={handleCompleteTask}
                        onLogTime={handleLogTimeEntry}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                        onBulkEdit={handleBulkEdit}
                        onClearCompleted={handleClearCompleted}
                        isLoading={isWorkspaceLoading}
                        activeProjectId={isMobileViewport ? effectiveMobileProjectId : activeProjectId}
                      />
                    )}
                    {!isMobileViewport && taskViewMode === 'week' && (
                      <div className="h-[calc(100vh-200px)]">
                        <TaskWeekView
                          tasks={spaceSortedTasks}
                          projects={projects}
                          onEdit={handleEditTask}
                          onComplete={handleCompleteTask}
                          onToggle={handleToggleTask}
                          onAdd={handleAddTask}
                          onDelete={handleDeleteTask}
                          isLoading={isWorkspaceLoading}
                        />
                      </div>
                    )}
                    {!isMobileViewport && taskViewMode === 'board' && (
                      <TaskBoardView
                        tasks={spaceTasks}
                        projects={projects}
                        onEdit={handleEditTask}
                        onComplete={handleCompleteTask}
                        onToggle={handleToggleTask}
                        onDelete={handleDeleteTask}
                        onAdd={handleAddTask}
                        isLoading={isWorkspaceLoading}
                      />
                    )}
                  </div>

                  {!isWorkspaceLoading && (
                    <QuickAddTask
                      activeProjectId={isMobileViewport ? mobileQuickAddProjectId : activeProjectId}
                      projects={mobileQuickAddProjects}
                      onAdd={handleAddTask}
                    />
                  )}
                </>
              )}

              {activeTab === 'brain' && (
                <div className="h-full min-h-0 animate-fade-in">
                  <BrainView />
                </div>
              )}

              {activeTab === 'insights' && (
                <div className="h-full min-h-0 animate-fade-in">
                  <InsightsView projects={projects} />
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="animate-fade-in">
                  <GoalsView tasks={sortedAllTasks} projects={projects} />
                </div>
              )}

              {activeTab === 'calendar' && (
                <div className="h-full min-h-0 animate-fade-in">
                  <CalendarView
                    tasks={sortedAllTasks}
                    projects={projects}
                    onAdd={handleAddTask}
                    onEdit={handleEditTask}
                    onComplete={handleCompleteTask}
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
                  <div className="mb-3 flex w-full flex-wrap gap-1 rounded-lg border border-[#e8e8e4] bg-[#f7f7f4] p-1 sm:w-fit dark:border-white/10 dark:bg-[#232326]">
                    <button
                      type="button"
                      onClick={() => setSettingsSection('account')}
                      className={`rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/15 ${settingsSection === 'account' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                    >
                      Konto i wygląd
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSection('notifications')}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/15 ${settingsSection === 'notifications' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                    >
                      <Bell className="h-4 w-4" /> Powiadomienia
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSection('integrations')}
                      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 dark:focus:ring-white/15 ${settingsSection === 'integrations' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
                    >
                      <Plug className="h-4 w-4" /> Integracje
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettingsSection('pomodoro')}
                      className={`hidden items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium transition-[background-color,color,box-shadow] duration-200 ease focus:outline-none focus:ring-2 focus:ring-[#0f1115]/20 lg:flex dark:focus:ring-white/15 ${settingsSection === 'pomodoro' ? 'bg-white text-[#0f1115] shadow-sm dark:bg-[#3F3F46] dark:text-white' : 'text-[#5a606b] hover:bg-[#f1f0ed] dark:text-gray-400 dark:hover:bg-[#323238]'}`}
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

                    </div>
                      </>
                    ) : settingsSection === 'integrations' ? (
                      <>
                        <div className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Połączenia</p>
                          <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">Integracje</h2>
                          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Połącz Mindflow z kalendarzem i zewnętrznymi narzędziami, które mają działać na Twoich zadaniach.</p>
                        </div>
                        <section className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
                          {googleNotice && (
                            <div className="mb-4 rounded-xl border border-[#e8e8e4] bg-[#fcfcfa] px-4 py-3 text-sm text-[#5a606b] dark:border-white/8 dark:bg-white/[0.03] dark:text-gray-300">
                              {googleNotice}
                            </div>
                          )}
                          <GoogleCalendarSettings isLoggedIn={isLoggedIn} />
                        </section>
                        <section className="px-6 py-5">
                          <ApiIntegrationsSettings isLoggedIn={isLoggedIn} />
                        </section>
                      </>
                    ) : settingsSection === 'notifications' ? (
                      <>
                        <div className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">Ustawienia powiadomień</p>
                          <h2 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-[#0f1115] dark:text-white">Powiadomienia</h2>
                          <p className="mt-1 text-sm text-[#5a606b] dark:text-gray-400">Ustaw briefy dnia, podsumowanie wieczorem oraz przypomnienia o blokach i zadaniach z godziną.</p>
                        </div>
                        <section className="px-6 py-5">
                          <PushNotificationsSettings isLoggedIn={isLoggedIn} />
                        </section>
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

      {!isMobileViewport && (
        <>
          <PomodoroOverlay settings={pomodoroSettings} launchRequest={pomodoroLaunchRequest} />
          <AgendaOverlay enabled={isLoggedIn} tasks={tasks} position={agendaPosition} isLoading={isWorkspaceLoading} />
        </>
      )}
    </div>
  );
}
