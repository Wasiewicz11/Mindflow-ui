import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Project } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';
import { TaskEditModal } from './TaskEditModal';
import { TaskAddModal } from './TaskAddModal';

const STATUS_META: Record<string, { label: string; dot: string; fg: string; bg: string }> = {
  NotStarted: { label: 'Nie rozpoczęto', dot: 'oklch(0.75 0.01 260)', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)' },
  InProgress:  { label: 'W trakcie',     dot: 'oklch(0.60 0.18 230)', fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)'  },
  Completed:   { label: 'Ukończone',     dot: 'oklch(0.55 0.18 145)', fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)'  },
};

interface TaskListProps {
  tasks: Task[];
  projects?: Project[];
  onToggle: (id: string) => void;
  onEdit: (id: string, updates: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: import('../../../shared/types').TaskStatus, description?: string, tags?: string[], subtasks?: import('../../../shared/types').Subtask[], estimatedHours?: number, dueTime?: string) => void;
  onClearCompleted?: () => void;
  onBulkEdit?: (ids: string[], updates: Partial<Task>) => void;
  compactMode?: boolean;
  isLoading?: boolean;
  activeProjectId?: string | null;
  showDueSubtasks?: boolean;
}

const TaskList: React.FC<TaskListProps> = ({
  tasks,
  projects = [],
  onToggle,
  onEdit,
  onDelete,
  onAdd,
  onClearCompleted,
  onBulkEdit,
  compactMode = false,
  isLoading = false,
  activeProjectId = null,
  showDueSubtasks = false
}) => {
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isCompletedExpanded, setIsCompletedExpanded] = useState(false);
  const [closingTasks, setClosingTasks] = useState<Record<string, 'fading' | 'collapsing'>>({});

  // Selection Mode State
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const lastSelectedIdRef = useRef<string | null>(null);

  useEffect(() => {
    const prevent = (e: KeyboardEvent) => {
      if (e.key !== 'Shift') return;
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      window.getSelection()?.removeAllRanges();
    };
    window.addEventListener('keydown', prevent);
    return () => window.removeEventListener('keydown', prevent);
  }, []);

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const completedTasks = tasks.filter(t => t.isCompleted);
  const completeTaskWithAnimation = (task: Task) => {
    if (task.isCompleted) {
      onToggle(task.id);
      return;
    }
    if (closingTasks[task.id]) return;
    setClosingTasks(prev => ({ ...prev, [task.id]: 'fading' }));
    window.setTimeout(() => {
      setClosingTasks(prev => ({ ...prev, [task.id]: 'collapsing' }));
      onToggle(task.id);
    }, 120);
  };

  const getPriorityColor = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.P1: return 'text-red-500 fill-red-500';
      case TaskPriority.P2: return 'text-amber-500 fill-amber-500';
      case TaskPriority.P3: return 'text-blue-500 fill-blue-500';
      case TaskPriority.P4: return 'text-gray-400';
    }
  };

  const getPriorityLabel = (p: TaskPriority) => {
    switch (p) {
      case TaskPriority.P1: return 'Priorytet 1';
      case TaskPriority.P2: return 'Priorytet 2';
      case TaskPriority.P3: return 'Priorytet 3';
      case TaskPriority.P4: return 'Priorytet 4';
    }
  };

  const renderPriorityFlag = (p: TaskPriority) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`${compactMode ? 'w-3.5 h-3.5' : 'w-5 h-5'} ${getPriorityColor(p)}`}>
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  );

  const formatDate = (dateString?: string) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    if (isToday) return 'Dzisiaj';
    if (isTomorrow) return 'Jutro';

    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  const getSubtaskProgress = (task: Task) => {
    const total = task.subtaskTotalCount ?? task.subtasks?.length ?? 0;
    const completed = task.subtaskCompletedCount ?? task.subtasks?.filter(subtask => subtask.isCompleted).length ?? 0;
    return { completed, total };
  };

  const openAddModal = () => {
    setAddModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    if (isSelectionMode) return;
    setEditingTask(task);
  };

  const toggleSelection = (id: string, shiftKey = false) => {
    if (shiftKey && lastSelectedIdRef.current && lastSelectedIdRef.current !== id) {
      const allIds = tasks.map(t => t.id);
      const from = allIds.indexOf(lastSelectedIdRef.current);
      const to = allIds.indexOf(id);
      const rangeIds = allIds.slice(Math.min(from, to), Math.max(from, to) + 1);
      setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
    } else {
      setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }
    lastSelectedIdRef.current = id;
  };

  const applyBulkPriority = (p: TaskPriority) => {
    if (onBulkEdit && selectedIds.length > 0) {
      onBulkEdit(selectedIds, { priority: p });
    }
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const applyBulkProject = (val: string) => {
    if (onBulkEdit && selectedIds.length > 0) {
      onBulkEdit(selectedIds, { project_id: val === 'none' ? null : val });
    }
    setIsSelectionMode(false);
    setSelectedIds([]);
  };

  const renderSkeleton = () => (
    <div className="space-y-3">
      {[1, 2, 3].map(i => (
        <div key={i} className={`flex items-center justify-between rounded-xl border border-gray-100 dark:border-white/5 bg-white dark:bg-[#1C1C1E] ${compactMode ? 'p-2' : 'p-4'}`}>
          <div className="flex items-center space-x-4 flex-1">
            <div className="w-5 h-5 rounded-md bg-gray-100 dark:bg-white/5 animate-pulse"></div>
            <div className="flex flex-col space-y-2 flex-1">
              <div className="h-4 bg-gray-100 dark:bg-white/5 rounded animate-pulse w-3/4"></div>
              {!compactMode && <div className="h-3 bg-gray-50 dark:bg-white/5 rounded animate-pulse w-1/4"></div>}
            </div>
          </div>
          <div className="w-16 h-6 rounded-md bg-gray-50 dark:bg-white/5 animate-pulse"></div>
        </div>
      ))}
    </div>
  );

  const renderTaskItem = (task: Task, index: number) => {
    const dateLabel = formatDate(task.dueDate);
    const dueLabel = [dateLabel || task.dueDate, task.dueTime].filter(Boolean).join(' · ');
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !new Date(task.dueDate).toDateString().match(new Date().toDateString()) && !task.isCompleted;
    const project = projects.find(p => p.id === task.project_id);
    const st = STATUS_META[task.status ?? 'NotStarted'] ?? STATUS_META.NotStarted;
    const staggerClass = index < 5 ? `delay-${index * 75}` : 'delay-0';
    const isSelected = selectedIds.includes(task.id);
    const closingPhase = task.isCompleted ? undefined : closingTasks[task.id];
    const isClosing = !!closingPhase;
    const subtaskProgress = getSubtaskProgress(task);
    const dueSubtasks = showDueSubtasks ? (task.dueSubtasks ?? []).filter(subtask => !subtask.isCompleted) : [];

    return (
      <div
        key={task.id}
        onClick={(e) => {
          if (isSelectionMode || e.shiftKey) { e.stopPropagation(); if (e.shiftKey) window.getSelection()?.removeAllRanges(); if (!isSelectionMode) setIsSelectionMode(true); toggleSelection(task.id, e.shiftKey); }
          else { openEditModal(task); }
        }}
        className={`task-complete-collapse group relative flex items-center justify-between rounded-xl border transition-all duration-300 cursor-pointer animate-fade-in-up ${staggerClass} ${closingPhase === 'fading' ? 'is-fading' : ''} ${closingPhase === 'collapsing' ? 'is-completing' : ''} ${compactMode ? 'py-1.5 px-3' : 'p-4'} ${isSelectionMode ? 'select-none' : ''} ${
          isSelectionMode && isSelected
            ? 'bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800 shadow-sm'
            : task.isCompleted || isClosing
              ? 'bg-[#f1f0ed] dark:bg-white/5 border-[#e8e8e4] dark:border-white/5 opacity-70 hover:opacity-100'
              : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5'
        }`}
      >
        <div className={`flex items-center flex-1 min-w-0 mr-4 ${compactMode ? 'space-x-2.5' : 'space-x-4'}`}>

          {isSelectionMode ? (
            <div className={`flex-shrink-0 flex items-center justify-center transition-all duration-200 ${compactMode ? 'w-3.5 h-3.5' : 'w-5 h-5'} rounded-full border ${isSelected ? 'bg-gray-900 dark:bg-white border-gray-900 dark:border-white text-white dark:text-black' : 'border-gray-300 dark:border-white/20 bg-white dark:bg-white/5'}`}>
              {isSelected && <svg className={compactMode ? 'w-2 h-2' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>}
            </div>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); completeTaskWithAnimation(task); }}
              className={`flex-shrink-0 rounded-full border flex items-center justify-center cursor-pointer transition-all duration-200 ease ${compactMode ? 'w-3.5 h-3.5' : 'w-5 h-5'} ${
                task.isCompleted || isClosing
                  ? 'bg-emerald-500 border-emerald-500 text-white scale-100'
                  : 'bg-white dark:bg-white/5 border-gray-300 dark:border-white/20 text-transparent hover:border-emerald-500 dark:hover:border-emerald-500 hover:scale-110'
              }`}
            >
              <svg className={compactMode ? 'w-2 h-2' : 'w-3.5 h-3.5'} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" /></svg>
            </button>
          )}

          <div className="flex flex-col truncate pr-2">
            <span className={`font-medium truncate transition-all duration-200 ease ${compactMode ? 'text-xs' : 'text-sm'} ${task.isCompleted || isClosing ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-700 dark:text-gray-200'}`}>
              {dueSubtasks.length > 0 ? `#${task.content}` : task.content}
            </span>

            {!compactMode && (
              <div className="flex items-center space-x-3 mt-0.5">
                {dueLabel && (
                  <div className={`relative flex items-center text-[10px] w-fit ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400 dark:text-gray-500'}`}>
                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <span>{dueLabel}</span>
                  </div>
                )}
                {project && (
                  <div className="flex items-center text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                    <span className="w-1.5 h-1.5 rounded-full mr-1.5" style={{ backgroundColor: project.color || '#9CA3AF' }}></span>
                    {project.name}
                  </div>
                )}
                <div
                  className="inline-flex items-center gap-1 text-[10px] font-semibold rounded-[4px]"
                  style={{ padding: '1px 5px', color: st.fg, background: st.bg }}
                >
                  <span className="rounded-full flex-none" style={{ width: 4, height: 4, background: st.dot }} />
                  {st.label}
                </div>
              </div>
            )}
            {compactMode && (dueLabel || isOverdue) && !task.isCompleted && (
              <div className={`flex items-center text-[9px] mt-0.5 ${isOverdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                <span>{dueLabel}</span>
                {project && <span className="mx-1">• {project.name}</span>}
              </div>
            )}
            {dueSubtasks.length > 0 && (
              <div className="mt-1 space-y-0.5">
                {dueSubtasks.slice(0, 3).map(subtask => (
                  <div key={subtask.id} className="flex min-w-0 items-center gap-1 text-[10px] text-gray-400 dark:text-gray-500">
                    <span className="text-gray-300 dark:text-gray-600">##</span>
                    <span className="truncate">{subtask.content}</span>
                    {subtask.dueDate && <span className="flex-none">{formatDate(subtask.dueDate)}</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {subtaskProgress.total > 0 && !isSelectionMode && (
            <span className="flex-none rounded-md bg-[#f7f7f4] px-1.5 py-0.5 text-[11px] font-semibold text-[#9098a4]" title="Wykonane podzadania">
              {subtaskProgress.completed}/{subtaskProgress.total}
            </span>
          )}

          {!compactMode && !isSelectionMode && (
            <div className="
              flex items-center justify-center
              w-0 opacity-0 translate-x-4
              group-hover:w-8 group-hover:opacity-100 group-hover:translate-x-0
              transition-all duration-300 ease-out
              overflow-hidden
            ">
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.id); }}
                className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                title="Usuń"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </button>
            </div>
          )}

          <div className={`flex-shrink-0 pl-2 bg-transparent z-10 ${isSelectionMode ? 'opacity-50' : ''}`} title={getPriorityLabel(task.priority)}>
            {renderPriorityFlag(task.priority)}
          </div>
        </div>
      </div>
    );
  };

  const floatingToolbar = isSelectionMode && selectedIds.length > 0 && typeof document !== 'undefined' ? createPortal(
    <div className="fixed z-[100] bottom-0 left-0 right-0 w-full lg:w-max lg:bottom-10 lg:left-1/2 lg:right-auto lg:-translate-x-1/2 bg-white/98 dark:bg-[#1C1C1E]/95 backdrop-blur-2xl border-t lg:border border-gray-200/60 dark:border-white/10 rounded-t-3xl lg:rounded-full shadow-[0_-20px_40px_rgba(0,0,0,0.1)] lg:shadow-[0_8px_32px_rgba(0,0,0,0.08)] px-4 pb-8 pt-5 lg:px-5 lg:py-2.5 animate-fade-in-up">
      <div className="flex lg:hidden justify-between items-center mb-4 w-full px-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-gray-800 dark:text-white">{selectedIds.length} zazn.</span>
          <button
            onClick={() => selectedIds.length === tasks.length ? setSelectedIds([]) : setSelectedIds(tasks.map(t => t.id))}
            className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {selectedIds.length === tasks.length ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
          </button>
        </div>
        <button
          onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
          className="p-1.5 bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 rounded-full text-gray-500 dark:text-gray-400 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-2 lg:flex items-center gap-3 lg:gap-4 w-full lg:w-auto">
        <button
          onClick={() => selectedIds.length === tasks.length ? setSelectedIds([]) : setSelectedIds(tasks.map(t => t.id))}
          className="hidden lg:flex items-center justify-center bg-gray-100/80 dark:bg-white/5 hover:bg-gray-200/80 dark:hover:bg-white/10 px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-semibold text-gray-700 dark:text-gray-300 whitespace-nowrap transition-colors"
        >
          {selectedIds.length === tasks.length ? 'Odznacz wszystko' : `${selectedIds.length} / ${tasks.length}`}
        </button>

        <div className="hidden lg:block h-5 w-px bg-gray-200/80 dark:bg-white/10"></div>

        <div className="col-span-1 lg:flex-none flex items-center justify-center gap-1 bg-gray-50 dark:bg-white/5 lg:bg-transparent py-2 px-1 lg:p-0 rounded-2xl lg:rounded-none border border-gray-100/80 dark:border-white/5 lg:border-none">
          <span className="text-[10px] text-gray-400 dark:text-gray-500 uppercase tracking-wider font-semibold mx-1 hidden sm:inline">Priorytet:</span>
          {(Object.values(TaskPriority)).map(p => (
            <button
              key={p}
              onClick={() => applyBulkPriority(p)}
              className="p-2 lg:p-1.5 rounded-xl lg:rounded-full hover:bg-white dark:hover:bg-white/10 lg:hover:bg-gray-200/80 dark:lg:hover:bg-white/10 transition-colors shadow-sm lg:shadow-none bg-white dark:bg-white/5 lg:bg-transparent"
              title={`Ustaw: ${getPriorityLabel(p)}`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 lg:w-4 lg:h-4 ${getPriorityColor(p)}`}>
                <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </button>
          ))}
        </div>

        <div className="hidden lg:block h-5 w-px bg-gray-200/80 dark:bg-white/10"></div>

        <div className="col-span-1 relative flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-100/80 dark:border-white/5 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 dark:lg:hover:bg-white/10 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors cursor-pointer">
          <select
            onChange={(e) => applyBulkProject(e.target.value)}
            className="bg-transparent text-xs lg:text-[11px] font-semibold text-gray-700 dark:text-gray-300 appearance-none outline-none cursor-pointer focus:ring-0 w-full text-center lg:text-left pr-4 lg:pr-5"
            value=""
          >
            <option value="" disabled className="dark:bg-[#1C1C1E]">Do projektu...</option>
            <option value="none" className="dark:bg-[#1C1C1E]">Skrzynka (Brak)</option>
            {projects.map(p => <option key={p.id} value={p.id} className="dark:bg-[#1C1C1E]">{p.name}</option>)}
          </select>
          <svg className="w-3.5 h-3.5 text-gray-400 absolute right-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
        </div>

        <div className="hidden lg:block h-5 w-px bg-gray-200/80 dark:bg-white/10 ml-1"></div>

        {/* Ukończ zaznaczone */}
        <button
          onClick={() => { onBulkEdit?.(selectedIds, { isCompleted: true }); setIsSelectionMode(false); setSelectedIds([]); }}
          className="col-span-1 flex items-center justify-center gap-1.5 bg-emerald-50 dark:bg-emerald-900/20 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-800/40 lg:border-none lg:bg-transparent lg:hover:bg-emerald-50 dark:lg:hover:bg-emerald-900/20 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold"
          title="Oznacz jako ukończone"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" /></svg>
          <span className="lg:hidden">Ukończ</span>
        </button>

        {/* Usuń zaznaczone */}
        <button
          onClick={() => {
            if (!window.confirm(`Czy na pewno chcesz usunąć ${selectedIds.length} zadań?`)) return;
            selectedIds.forEach(id => onDelete(id));
            setIsSelectionMode(false);
            setSelectedIds([]);
          }}
          className="col-span-1 flex items-center justify-center gap-1.5 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-500 dark:text-red-400 border border-red-200/60 dark:border-red-800/40 lg:border-none lg:bg-transparent lg:hover:bg-red-50 dark:lg:hover:bg-red-900/20 py-2.5 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors text-xs font-semibold"
          title="Usuń zaznaczone"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          <span className="lg:hidden">Usuń</span>
        </button>

        {/* Termin dla zaznaczonych */}
        <div className="col-span-1 relative flex items-center justify-center bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 border border-gray-100/80 dark:border-white/5 lg:border-none lg:bg-transparent lg:hover:bg-gray-100/80 dark:lg:hover:bg-white/10 py-2 px-3 lg:py-1.5 rounded-2xl lg:rounded-full transition-colors">
          <svg className="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          <input
            type="date"
            value={bulkDueDate}
            onChange={(e) => {
              const chosen = e.target.value;
              setBulkDueDate(chosen);
              if (onBulkEdit && selectedIds.length > 0) {
                onBulkEdit(selectedIds, { dueDate: chosen || undefined });
              }
              setIsSelectionMode(false);
              setSelectedIds([]);
              setBulkDueDate('');
            }}
            className="bg-transparent text-xs lg:text-[11px] font-semibold text-gray-700 dark:text-gray-300 outline-none cursor-pointer focus:ring-0 w-28 lg:w-24"
            title="Ustaw termin dla zaznaczonych"
          />
        </div>

        <div className="hidden lg:block h-5 w-px bg-gray-200/80 dark:bg-white/10 ml-1"></div>

        <button
          onClick={() => { setIsSelectionMode(false); setSelectedIds([]); }}
          className="hidden lg:flex ml-1 p-1.5 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100/80 dark:hover:bg-white/10 rounded-full transition-colors items-center justify-center"
          title="Zamknij"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className={compactMode ? 'space-y-1.5' : 'space-y-4'}>
      {!compactMode && (
        <button
          onClick={openAddModal}
          className="w-full py-3 border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-white/30 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-200 flex items-center justify-center mb-6"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
          Dodaj zadanie
        </button>
      )}

      {activeTasks.length > 0 && onBulkEdit && (
        <div className="flex justify-between items-center px-1 mb-2">
          <div className="w-full flex justify-end">
            <button
              onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]); }}
              className={`text-xs font-semibold transition-colors uppercase tracking-wider px-3 py-1.5 rounded-lg ${isSelectionMode ? 'bg-gray-900 dark:bg-white text-white dark:text-black' : 'text-gray-400 dark:text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'}`}
            >
              {isSelectionMode ? 'Gotowe' : 'Wybierz wiele'}
            </button>
          </div>
        </div>
      )}

      <div className={compactMode ? 'space-y-1.5' : 'space-y-3'}>
        {isLoading ? renderSkeleton() : (
          activeTasks.length > 0 ? (
            activeTasks.map((task, idx) => renderTaskItem(task, idx))
          ) : (
            <div className={`flex flex-col items-center justify-center border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50/30 dark:bg-white/5 animate-fade-in ${compactMode ? 'h-16' : 'h-32'}`}>
              <p className={`text-gray-400 dark:text-gray-500 ${compactMode ? 'text-xs' : 'text-sm'}`}>Brak zadań w tym widoku</p>
              {!compactMode && completedTasks.length > 0 && (
                <p className="text-xs text-gray-300 dark:text-gray-600 mt-1">Ale masz {completedTasks.length} wykonanych poniżej!</p>
              )}
            </div>
          )
        )}
      </div>

      {!isLoading && completedTasks.length > 0 && !compactMode && !isSelectionMode && (
        <div className="mt-8 pt-4 border-t border-gray-100 dark:border-white/5 animate-fade-in">
          <div className="flex items-center justify-between w-full">
            <button
              onClick={() => setIsCompletedExpanded(!isCompletedExpanded)}
              className="flex items-center space-x-2 text-xs font-semibold text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors uppercase tracking-wide flex-grow group text-left"
            >
              <span>Wykonane ({completedTasks.length})</span>
              <svg
                className={`w-3 h-3 transition-transform duration-200 ${isCompletedExpanded ? 'rotate-180' : ''}`}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
              </svg>
              <div className="flex-grow h-px bg-gray-100 dark:bg-white/5 ml-2 group-hover:bg-gray-200 dark:group-hover:bg-white/10 transition-colors mr-2"></div>
            </button>

            {onClearCompleted && (
              <button
                type="button"
                onClick={onClearCompleted}
                className="relative z-10 ml-2 text-[10px] text-gray-400 dark:text-gray-500 hover:text-red-600 dark:hover:text-red-400 font-medium px-2 py-1.5 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center cursor-pointer"
                title="Usuń wszystkie wykonane"
              >
                <span>Wyczyść</span>
              </button>
            )}
          </div>

          {isCompletedExpanded && (
            <div className="space-y-3 mt-4">
              {completedTasks.map((task, idx) => renderTaskItem(task, idx))}
            </div>
          )}
        </div>
      )}

      {floatingToolbar}

      {editingTask && (
        <TaskEditModal
          task={editingTask}
          projects={projects}
          onSave={updates => onEdit(editingTask.id, updates)}
          onDelete={() => { onDelete(editingTask.id); setEditingTask(null); }}
          onToggleComplete={() => { onToggle(editingTask.id); setEditingTask(null); }}
          onClose={() => setEditingTask(null)}
        />
      )}

      {addModalOpen && (
        <TaskAddModal
          projects={projects}
          initialProjectId={activeProjectId ?? undefined}
          onAdd={(content, priority, dueDate, projectId, status, description, tags, subtasks, estimatedHours, dueTime) => { onAdd(content, priority, dueDate, projectId, status, description, tags, subtasks, estimatedHours, dueTime); setAddModalOpen(false); }}
          onClose={() => setAddModalOpen(false)}
        />
      )}

    </div>
  );
};

export default TaskList;
