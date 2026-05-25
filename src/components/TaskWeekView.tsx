import React, { useState } from 'react';
import type { Task, Project } from '../types';

const STATUS_META: Record<string, { label: string; dot: string }> = {
  NotStarted: { label: 'Nie rozpoczęto', dot: 'oklch(0.75 0.01 260)' },
  InProgress:  { label: 'W trakcie',     dot: 'oklch(0.60 0.18 230)' },
  Completed:   { label: 'Ukończone',     dot: 'oklch(0.55 0.18 145)' },
};

interface TaskWeekViewProps {
  tasks: Task[];
  projects?: Project[];
  onEdit: (id: string, updates: Partial<Task>) => void;
  onToggle: (id: string) => void;
  onAdd: (content: string, priority: 'p1' | 'p2' | 'p3' | 'p4', dueDate?: string, projectId?: string) => void;
  onDelete?: (id: string) => void;
}

const TaskWeekView: React.FC<TaskWeekViewProps> = ({ tasks, projects = [], onEdit, onToggle, onAdd, onDelete }) => {
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPriorityOpen, setIsPriorityOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formData, setFormData] = useState<{ content: string, priority: 'p1' | 'p2' | 'p3' | 'p4', dueDate: string, projectId: string }>({
    content: '',
    priority: 'p4',
    dueDate: '',
    projectId: ''
  });

  const getDaysArray = () => {
    const days = [];
    const today = new Date();
    for (let i = 0; i < 5; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const days = getDaysArray();
  const todayStr = new Date().toISOString().split('T')[0];

  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getTomorrowStr = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'p1': return 'text-red-500 fill-red-500';
      case 'p2': return 'text-amber-500 fill-amber-500';
      case 'p3': return 'text-blue-500 fill-blue-500';
      case 'p4': return 'text-gray-400';
      default: return 'text-gray-300';
    }
  };

  const getPriorityLabel = (p: string) => {
    switch (p) {
      case 'p1': return 'Priorytet 1';
      case 'p2': return 'Priorytet 2';
      case 'p3': return 'Priorytet 3';
      case 'p4': return 'Priorytet 4';
      default: return 'Priorytet 4';
    }
  };

  const renderPriorityFlag = (p: string) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`w-5 h-5 ${getPriorityColor(p)}`}>
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clipRule="evenodd" />
    </svg>
  );

  const openAddModal = (dateStr?: string) => {
    setEditingTask(null);
    setFormData({
      content: '',
      priority: 'p4',
      dueDate: dateStr === 'nodate' ? '' : (dateStr || ''),
      projectId: ''
    });
    setIsPriorityOpen(false);
    setIsModalOpen(true);
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setFormData({
      content: task.content,
      priority: task.priority,
      dueDate: task.dueDate || '',
      projectId: task.project_id || ''
    });
    setIsPriorityOpen(false);
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTask) {
      onEdit(editingTask.id, {
        content: formData.content,
        priority: formData.priority,
        dueDate: formData.dueDate || undefined,
        project_id: formData.projectId || null
      });
    } else {
      onAdd(formData.content, formData.priority, formData.dueDate || undefined, formData.projectId || undefined);
    }
    setIsModalOpen(false);
  };

  const activeTasks = tasks.filter(t => !t.isCompleted);
  const overdueTasks = activeTasks.filter(t => t.dueDate && t.dueDate < todayStr);
  const noDateTasks = activeTasks.filter(t => !t.dueDate);

  const getTasksForDate = (dateStr: string) => {
    return activeTasks.filter(t => t.dueDate === dateStr);
  };

  const formatDateLabel = (date: Date) => {
    const dStr = date.toISOString().split('T')[0];
    const isToday = dStr === todayStr;
    const tomorrow = new Date();
    tomorrow.setDate(new Date().getDate() + 1);
    const isTomorrow = dStr === tomorrow.toISOString().split('T')[0];

    const dayName = date.toLocaleDateString('pl-PL', { weekday: 'long' });
    const dayMonth = date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });

    if (isToday) return { main: 'Dziś', sub: dayMonth };
    if (isTomorrow) return { main: 'Jutro', sub: dayMonth };

    const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);
    return { main: dayNameCap, sub: dayMonth };
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', taskId);
    setTimeout(() => { setDraggedTaskId(taskId); }, 0);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragEnter = (e: React.DragEvent, dateKey: string | null) => {
    e.preventDefault();
    if (!draggedTaskId) return;
    if (dateKey === 'overdue') return;
    setDragOverColumn(dateKey);
  };

  const handleDragOver = (e: React.DragEvent, dateKey: string | null) => {
    e.preventDefault();
    if (dateKey === 'overdue') { e.dataTransfer.dropEffect = 'none'; return; }
    e.dataTransfer.dropEffect = 'move';
    if (draggedTaskId && dragOverColumn !== dateKey) { setDragOverColumn(dateKey); }
  };

  const handleDrop = (e: React.DragEvent, targetDateStr: string | null) => {
    e.preventDefault();
    setDragOverColumn(null);
    if (!draggedTaskId) return;
    if (targetDateStr === 'overdue') return;

    const updates: Partial<Task> = {};
    if (targetDateStr === 'nodate') {
      updates.dueDate = undefined;
    } else if (targetDateStr) {
      updates.dueDate = targetDateStr;
    }
    onEdit(draggedTaskId, updates);
    setDraggedTaskId(null);
  };

  const renderTaskCard = (task: Task) => {
    const project = projects.find(p => p.id === task.project_id);
    const isBeingDragged = draggedTaskId === task.id;

    const formatDateDetail = (dateStr?: string) => {
      if (!dateStr) return null;
      const d = new Date(dateStr);
      return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
    };

    const dateDisplay = formatDateDetail(task.dueDate);
    const isOverdueOrToday = task.dueDate && new Date(task.dueDate).toISOString().split('T')[0] <= todayStr;

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onClick={() => openEditModal(task)}
        className={`relative p-2.5 rounded-xl border mb-2 cursor-pointer transition-all group animate-fade-in-up
          ${isBeingDragged
            ? 'bg-gray-50 dark:bg-white/5 border-dashed border-gray-300 dark:border-white/20 opacity-40 shadow-none scale-[0.98]'
            : 'bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-white/5 shadow-sm hover:shadow-md hover:-translate-y-0.5'
          }
        `}
      >
        <div className={`flex items-start gap-2 ${isBeingDragged ? 'opacity-50' : ''}`}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
            className="mt-0.5 flex-shrink-0 w-3.5 h-3.5 rounded-full border border-gray-300 dark:border-white/20 hover:border-gray-400 dark:hover:border-white/40 hover:bg-gray-50 dark:hover:bg-white/10 transition-colors flex items-center justify-center group/check"
          >
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-gray-800 dark:text-gray-200 leading-snug mb-1 break-words">
              {task.content}
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {dateDisplay && (
                <div className={`flex items-center gap-1 text-[9px] font-medium ${isOverdueOrToday ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  <span>{dateDisplay}</span>
                </div>
              )}

              <div className="flex items-center gap-1 text-[9px] text-gray-400 dark:text-gray-500 font-medium">
                <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" /></svg>
                <span className="truncate max-w-[80px]">{project ? project.name : 'Skrzynka'}</span>
              </div>

              {(() => {
                const st = STATUS_META[task.status ?? 'NotStarted'] ?? STATUS_META.NotStarted;
                return (
                  <div className="flex items-center gap-1 text-[9px] font-medium text-gray-400 dark:text-gray-500" title={st.label}>
                    <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: st.dot }} />
                    <span>{st.label}</span>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderColumn = (title: string, subTitle: string | null, columnTasks: Task[], dateKey: string | null, isSpecial = false) => {
    const isOver = dragOverColumn === dateKey;

    return (
      <div
        key={dateKey || title}
        className="flex-shrink-0 w-[280px] lg:w-72 flex flex-col h-full rounded-2xl border-2 border-transparent transition-colors snap-center lg:snap-align-none"
        onDragOver={(e) => handleDragOver(e, dateKey)}
        onDragEnter={(e) => handleDragEnter(e, dateKey)}
        onDrop={(e) => handleDrop(e, dateKey)}
      >
        <div className={`mb-4 px-2 ${isSpecial ? 'text-red-500' : 'text-gray-900 dark:text-white'}`}>
          <h3 className="text-sm font-bold flex items-baseline gap-2">
            {title} <span className={`text-xs font-normal ${isSpecial ? 'text-red-400' : 'text-gray-400 dark:text-gray-500'}`}>{columnTasks.length}</span>
          </h3>
          {subTitle && <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{subTitle}</span>}
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar px-1 pb-48 lg:pb-20 min-h-[200px]">
          {columnTasks.length > 0 || isOver ? (
            <>
              {columnTasks.map(task => renderTaskCard(task))}
              {isOver && draggedTaskId && (
                <div className="mb-3 p-4 h-[50px] rounded-xl border-2 border-dashed border-gray-300 dark:border-white/20 bg-gray-50/50 dark:bg-white/5 flex flex-col items-center justify-center animate-pulse">
                  <span className="text-[9px] font-semibold text-gray-400 dark:text-gray-500">Upuść tutaj</span>
                </div>
              )}
            </>
          ) : (
            <div className="h-20 border-2 border-dashed border-gray-100 dark:border-white/10 rounded-xl flex items-center justify-center text-gray-300 dark:text-gray-600 text-xs font-medium">
              Brak zadań
            </div>
          )}

          {dateKey && dateKey !== 'overdue' && !isOver && (
            <button
              onClick={() => openAddModal(dateKey)}
              className="mt-2 w-full py-2 text-xs text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 hover:opacity-100"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
              Dodaj
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="h-full flex flex-col">
        <div className="flex-1 overflow-x-auto overflow-y-hidden custom-scrollbar pb-4 snap-x snap-mandatory lg:snap-none">
          <div className="flex gap-4 lg:gap-8 h-full min-w-max px-4 lg:px-2">
            {overdueTasks.length > 0 && renderColumn("Zaległe", null, overdueTasks, 'overdue', true)}
            {days.map(date => {
              const { main, sub } = formatDateLabel(date);
              const dStr = date.toISOString().split('T')[0];
              return renderColumn(main, sub, getTasksForDate(dStr), dStr);
            })}
            {renderColumn("Bez terminu", "Inbox", noDateTasks, 'nodate')}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm p-6 relative animate-scale-in z-10 transform origin-center border border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {editingTask ? 'Edytuj zadanie' : 'Nowe zadanie'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Treść</label>
                <input
                  type="text"
                  autoFocus
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  placeholder="Co trzeba zrobić?"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Priorytet</label>
                  <button
                    type="button"
                    onClick={() => setIsPriorityOpen(!isPriorityOpen)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2 text-sm flex items-center justify-between text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all h-[38px]"
                  >
                    <div className="flex items-center space-x-2">
                      {renderPriorityFlag(formData.priority)}
                      <span className="text-gray-700 dark:text-gray-300">{getPriorityLabel(formData.priority)}</span>
                    </div>
                    <svg className={`w-4 h-4 text-gray-400 transition-transform ${isPriorityOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>

                  {isPriorityOpen && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-white dark:bg-[#2C2C2E] border border-gray-100 dark:border-white/10 rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
                      {(['p1', 'p2', 'p3', 'p4'] as const).map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => { setFormData({ ...formData, priority: p }); setIsPriorityOpen(false); }}
                          className={`w-full px-3 py-2 text-sm flex items-center space-x-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors ${formData.priority === p ? 'bg-gray-50 dark:bg-white/5 font-medium' : 'text-gray-600 dark:text-gray-400'}`}
                        >
                          {renderPriorityFlag(p)}
                          <span>{getPriorityLabel(p)}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Termin</label>

                  <div className="flex space-x-1.5 mb-2">
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dueDate: getTodayStr() })}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all border ${formData.dueDate === getTodayStr() ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                    >
                      Dziś
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dueDate: getTomorrowStr() })}
                      className={`flex-1 py-1.5 text-[10px] font-medium rounded-lg transition-all border ${formData.dueDate === getTomorrowStr() ? 'bg-gray-900 dark:bg-white text-white dark:text-black border-gray-900 dark:border-white' : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/10'}`}
                    >
                      Jutro
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, dueDate: '' })}
                      className="px-2 py-1.5 text-[10px] font-medium rounded-lg transition-all border bg-white dark:bg-white/5 text-gray-400 dark:text-gray-500 border-gray-100 dark:border-white/10 hover:text-red-500 dark:hover:text-red-400 hover:border-red-100 dark:hover:border-red-900/30"
                      title="Wyczyść"
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    type="date"
                    value={formData.dueDate}
                    onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  />
                </div>
              </div>

              {projects.length > 0 && (
                <div>
                  <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Projekt</label>
                  <select
                    value={formData.projectId}
                    onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-3 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all appearance-none"
                  >
                    <option value="" className="dark:bg-[#1C1C1E]">Brak (Ogólne)</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id} className="dark:bg-[#1C1C1E]">{project.name}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center pt-4">
                {editingTask && onDelete && (
                  <button
                    type="button"
                    onClick={() => { onDelete(editingTask.id); setIsModalOpen(false); }}
                    className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-colors mr-auto"
                  >
                    Usuń
                  </button>
                )}

                <div className="flex space-x-3 ml-auto">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm hover:shadow-md"
                  >
                    Zapisz
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default TaskWeekView;
