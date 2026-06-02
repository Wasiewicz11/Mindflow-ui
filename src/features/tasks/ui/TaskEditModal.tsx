import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Task, Project, Subtask, TaskStatus } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';
import { CalendarDatePicker } from '../../../shared/ui/CalendarDatePicker';
import { getProjectTags } from '../../projects';
import { getTask } from '../api/tasksApi';
import { mapApiTask } from '../model/taskModel';
import { DescriptionField } from './DescriptionField';

const DescriptionEditorModal = lazy(() =>
  import('./DescriptionEditorModal').then(m => ({ default: m.DescriptionEditorModal })),
);

interface Props {
  task: Task;
  projects: Project[];
  onSave: (updates: Partial<Task>) => void | Promise<void>;
  onDelete: () => void;
  onToggleComplete: () => void;
  onClose: () => void;
}

const PRIORITY: Record<TaskPriority, { label: string; name: string; fg: string; bg: string }> = {
  [TaskPriority.P1]: { label: 'P1', name: 'Pilne',    fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  [TaskPriority.P2]: { label: 'P2', name: 'Wysokie',  fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  [TaskPriority.P3]: { label: 'P3', name: 'Średnie',  fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  [TaskPriority.P4]: { label: 'P4', name: 'Niskie',   fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const STATUS_OPTIONS: Record<TaskStatus, { name: string; fg: string; bg: string; dot: string }> = {
  NotStarted: { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
  InProgress:  { name: 'W trakcie',     fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
  Completed:   { name: 'Ukończone',     fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
};

function CalIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3.5" y="5" width="17" height="15" rx="2"/>
      <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/>
    </svg>
  );
}

function TagIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/>
      <circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
    </svg>
  );
}

function FlagSmall({ color }: { color: string }) {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ color }}>
      <path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd"/>
    </svg>
  );
}

function StatusIcon() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9"/>
      <path d="M12 7v5l3 3" strokeLinecap="round"/>
    </svg>
  );
}

function stringArraysEqual(a: string[] = [], b: string[] = []) {
  if (a.length !== b.length) return false;
  return a.every((value, index) => value === b[index]);
}

function subtasksEqual(a: Subtask[] = [], b: Subtask[] = []) {
  if (a.length !== b.length) return false;
  return a.every((item, index) => (
    item.id === b[index].id
    && item.content === b[index].content
    && item.isCompleted === b[index].isCompleted
    && (item.description ?? '') === (b[index].description ?? '')
    && (item.dueDate ?? '') === (b[index].dueDate ?? '')
    && (item.sortOrder ?? index) === (b[index].sortOrder ?? index)
  ));
}

export function TaskEditModal({ task, projects, onSave, onDelete, onToggleComplete, onClose }: Props) {
  const [loadedTask, setLoadedTask] = useState(task);
  const [content, setContent]       = useState(task.content);
  const [priority, setPriority]     = useState(task.priority);
  const [status, setStatus]         = useState<TaskStatus>((task.status && task.status in STATUS_OPTIONS) ? task.status : 'NotStarted');
  const [dueDate, setDueDate]       = useState(task.dueDate ?? '');
  const [projectId, setProjectId]   = useState(task.project_id ?? '');
  const [description, setDescription] = useState(task.description ?? '');
  const [tags, setTags]             = useState<string[]>(task.tags ?? []);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [subtasks, setSubtasks]     = useState<Subtask[]>(task.subtasks ?? []);
  const [newTag, setNewTag]         = useState('');
  const [newSubtask, setNewSubtask] = useState('');
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker]     = useState(false);
  const [showProjectPicker, setShowProjectPicker]   = useState(false);
  const [showDatePicker, setShowDatePicker]         = useState(false);
  const [subtaskDatePicker, setSubtaskDatePicker] = useState<{ id: string; rect: DOMRect } | null>(null);
  const [subtaskDescriptionEditorId, setSubtaskDescriptionEditorId] = useState<string | null>(null);

  const titleRef = useRef<HTMLTextAreaElement>(null);
  const subtaskSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  function applyTaskDetails(nextTask: Task) {
    setLoadedTask(nextTask);
    setContent(nextTask.content);
    setPriority(nextTask.priority);
    setStatus((nextTask.status && nextTask.status in STATUS_OPTIONS) ? nextTask.status : 'NotStarted');
    setDueDate(nextTask.dueDate ?? '');
    setProjectId(nextTask.project_id ?? '');
    setDescription(nextTask.description ?? '');
    setTags(nextTask.tags ?? []);
    setSubtasks(nextTask.subtasks ?? []);
    setNewTag('');
    setNewSubtask('');
  }

  useEffect(() => {
    let isActive = true;

    getTask(task.id)
      .then(apiTask => {
        if (!isActive) return;
        applyTaskDetails(mapApiTask(apiTask));
      })
      .catch(error => {
        console.warn('Failed to fetch task details:', error);
      });

    return () => {
      isActive = false;
    };
  }, [task.id]);

  useEffect(() => {
    let isActive = true;

    if (!projectId) {
      return () => {
        isActive = false;
      };
    }

    getProjectTags(projectId)
      .then(projectTags => {
        if (isActive) setAvailableTags(projectTags);
      })
      .catch(error => {
        console.warn('Failed to fetch project tags:', error);
      });

    return () => {
      isActive = false;
    };
  }, [projectId]);

  // auto-resize title textarea
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [content]);

  const activeProject = projects.find(p => p.id === projectId);
  const p = PRIORITY[priority] ?? PRIORITY[TaskPriority.P4];
  const s = STATUS_OPTIONS[status] ?? STATUS_OPTIONS.NotStarted;

  const completedSubtasks = subtasks.filter(s => s.isCompleted).length;
  const subtaskProgress = subtasks.length > 0 ? (completedSubtasks / subtasks.length) * 100 : 0;

  function save(nextSubtasks = subtasks) {
    const updates: Partial<Task> = {
      content: content.trim() || loadedTask.content,
      priority,
      status,
      project_id: projectId || null,
    };

    if (dueDate !== (loadedTask.dueDate ?? '')) {
      if (dueDate) updates.dueDate = dueDate;
      else updates.clearDueDate = true;
    }

    if (description !== (loadedTask.description ?? '')) {
      updates.description = description;
    }

    if (!stringArraysEqual(tags, loadedTask.tags ?? [])) {
      updates.tags = tags;
    }

    if (!subtasksEqual(nextSubtasks, loadedTask.subtasks ?? [])) {
      updates.subtasks = nextSubtasks;
    }

    onSave(updates);
  }

  function persistSubtasks(nextSubtasks: Subtask[]) {
    const subtasksToSave = nextSubtasks.map((subtask, index) => ({ ...subtask, sortOrder: subtask.sortOrder ?? index }));
    subtaskSaveQueueRef.current = subtaskSaveQueueRef.current
      .catch(() => undefined)
      .then(() => Promise.resolve(onSave({ subtasks: subtasksToSave })))
      .catch(error => {
        console.warn('Failed to persist subtasks:', error);
      });
  }

  function addTag() {
    const raw = newTag.trim();
    if (!raw || !projectId) {
      setNewTag('');
      return;
    }

    const canonical = availableTags.find(tag => tag.toLowerCase() === raw.toLowerCase()) ?? raw;
    if (!tags.some(tag => tag.toLowerCase() === canonical.toLowerCase())) {
      setTags(prev => [...prev, canonical]);
    }
    setNewTag('');
  }

  function addExistingTag(tag: string) {
    if (!tags.some(selected => selected.toLowerCase() === tag.toLowerCase())) {
      setTags(prev => [...prev, tag]);
    }
    setNewTag('');
  }

  function removeTag(tag: string) {
    setTags(prev => prev.filter(t => t !== tag));
  }

  function addSubtask() {
    const c = newSubtask.trim();
    if (!c) return;
    const next = [...subtasks, { id: crypto.randomUUID(), content: c, isCompleted: false, sortOrder: subtasks.length }];
    setSubtasks(next);
    persistSubtasks(next);
    setNewSubtask('');
  }

  function toggleSubtask(id: string) {
    const next = subtasks.map(s => s.id === id ? { ...s, isCompleted: !s.isCompleted } : s);
    setSubtasks(next);
    persistSubtasks(next);
  }

  function updateSubtask(id: string, updates: Partial<Subtask>, persist = false) {
    const next = subtasks.map(s => s.id === id ? { ...s, ...updates } : s);
    setSubtasks(next);
    if (persist) persistSubtasks(next);
  }

  function removeSubtask(id: string) {
    const next = subtasks.filter(s => s.id !== id).map((s, index) => ({ ...s, sortOrder: index }));
    setSubtasks(next);
    persistSubtasks(next);
    if (subtaskDatePicker?.id === id) setSubtaskDatePicker(null);
    if (subtaskDescriptionEditorId === id) setSubtaskDescriptionEditorId(null);
  }

  function moveSubtask(id: string, direction: -1 | 1) {
    const index = subtasks.findIndex(s => s.id === id);
    const nextIndex = index + direction;
    if (index < 0 || nextIndex < 0 || nextIndex >= subtasks.length) return;
    const next = [...subtasks];
    const [item] = next.splice(index, 1);
    next.splice(nextIndex, 0, item);
    const ordered = next.map((s, order) => ({ ...s, sortOrder: order }));
    setSubtasks(ordered);
    persistSubtasks(ordered);
  }

  // close pickers when clicking outside modal — handled by backdrop
  function handleBackdropClick() {
    save();
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { save(); onClose(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { save(); onClose(); }
  }

  const ROW = 'flex items-start gap-3 py-2.5 border-b border-[#f1f0ed] cursor-pointer';
  const LABEL = 'flex items-center gap-1.5 text-[12.5px] text-[#9098a4] flex-none w-[88px]';
  const VALUE = 'flex-1 text-[13px] text-[#0f1115]';
  const editingSubtaskDescription = subtasks.find(subtask => subtask.id === subtaskDescriptionEditorId);
  const matchingAvailableTags = availableTags.filter(tag => {
    const query = newTag.trim().toLowerCase();
    return !tags.some(selected => selected.toLowerCase() === tag.toLowerCase())
      && (!query || tag.toLowerCase().includes(query));
  });

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onKeyDown={handleKeyDown}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.18)' }}
        onClick={handleBackdropClick}
      />

      {/* Modal */}
      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 420,
          maxHeight: '90vh',
          background: '#fff',
          border: '1px solid #e8e8e4',
          borderRadius: 18,
          boxShadow: '0 24px 48px -12px rgba(15,17,21,.22)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div
          className="flex-none flex items-center gap-2.5 px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid #f1f0ed' }}
        >
          {/* Complete toggle */}
          <button
            onClick={onToggleComplete}
            title="Oznacz jako wykonane"
            className="flex-none rounded-full border-2 transition-all hover:border-[#0f1115]"
            style={{
              width: 20, height: 20,
              borderColor: loadedTask.isCompleted ? '#0f1115' : '#d4d4d0',
              background: loadedTask.isCompleted ? '#0f1115' : 'transparent',
              flexShrink: 0,
            }}
          >
            {loadedTask.isCompleted && (
              <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                <path d="M5 13l4 4L19 7"/>
              </svg>
            )}
          </button>

          {/* Project info */}
          <div className="flex items-center gap-1.5 text-[12.5px] text-[#9098a4] flex-1 min-w-0">
            {activeProject ? (
              <>
                <span
                  className="rounded-full flex-none"
                  style={{ width: 6, height: 6, background: activeProject.color || '#9aa0aa' }}
                />
                <span className="truncate">{activeProject.name}</span>
              </>
            ) : (
              <span>Bez projektu</span>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-0.5 flex-none">
            <button
              onClick={onDelete}
              title="Usuń zadanie"
              className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-red-500 hover:bg-red-50"
              style={{ width: 28, height: 28 }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>
              </svg>
            </button>
            <button
              onClick={() => { save(); onClose(); }}
              className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-[#0f1115] hover:bg-[#f1f1ef]"
              style={{ width: 28, height: 28 }}
            >
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6 6 18M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-1">

          {/* Title */}
          <textarea
            ref={titleRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={1}
            className="w-full resize-none outline-none bg-transparent leading-snug"
            style={{ fontSize: 20, fontWeight: 650, color: '#0f1115', letterSpacing: '-0.01em', minHeight: 32 }}
            placeholder="Nazwa zadania"
            autoFocus
          />

          {/* Properties */}
          <div style={{ marginTop: 12 }}>

            {/* Status */}
            <div className="relative">
              <div className={ROW} onClick={() => { setShowStatusPicker(o => !o); setShowPriorityPicker(false); setShowProjectPicker(false); setShowDatePicker(false); }}>
                <span className={LABEL}><StatusIcon /> Status</span>
                <span className={VALUE}>
                  <span
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-[5px]"
                    style={{ padding: '2px 7px', color: s.fg, background: s.bg }}
                  >
                    <span className="rounded-full flex-none" style={{ width: 5, height: 5, background: s.dot }} />
                    {s.name}
                  </span>
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 170,
                  opacity: showStatusPicker ? 1 : 0,
                  transform: showStatusPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showStatusPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                {(Object.entries(STATUS_OPTIONS) as [TaskStatus, typeof STATUS_OPTIONS.NotStarted][]).map(([k, v]) => (
                  <button
                    key={k}
                    className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]"
                    style={{ padding: '9px 13px', color: k === status ? v.fg : '#0f1115' }}
                    onClick={() => { setStatus(k); setShowStatusPicker(false); }}
                  >
                    <span className="rounded-full flex-none" style={{ width: 7, height: 7, background: v.dot }} />
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div className="relative">
              <div className={ROW} onClick={() => { setShowPriorityPicker(o => !o); setShowStatusPicker(false); setShowProjectPicker(false); setShowDatePicker(false); }}>
                <span className={LABEL}><FlagSmall color={p.fg} /> Priorytet</span>
                <span className={VALUE}>
                  <span
                    className="inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-[5px]"
                    style={{ padding: '2px 7px', color: p.fg, background: p.bg }}
                  >
                    {p.label} — {p.name}
                  </span>
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 160,
                  opacity: showPriorityPicker ? 1 : 0,
                  transform: showPriorityPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showPriorityPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                {(Object.entries(PRIORITY) as [TaskPriority, (typeof PRIORITY)[TaskPriority]][]).map(([k, v]) => (
                  <button
                    key={k}
                    className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]"
                    style={{ padding: '9px 13px', color: k === priority ? v.fg : '#0f1115' }}
                    onClick={() => { setPriority(k); setShowPriorityPicker(false); }}
                  >
                    <span
                      className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-[4px] flex-none"
                      style={{ padding: '1px 5px', color: v.fg, background: v.bg }}
                    >
                      {v.label}
                    </span>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Project */}
            <div className="relative">
              <div className={ROW} onClick={() => { setShowProjectPicker(o => !o); setShowPriorityPicker(false); setShowStatusPicker(false); setShowDatePicker(false); }}>
                <span className={LABEL}><FolderIcon /> Projekt</span>
                <span className={VALUE}>
                  {activeProject ? (
                    <span className="flex items-center gap-1.5">
                      <span className="rounded-full" style={{ width: 7, height: 7, background: activeProject.color || '#9aa0aa', flexShrink: 0, display: 'inline-block' }} />
                      {activeProject.name}
                    </span>
                  ) : (
                    <span className="text-[#b0b5be]">Bez projektu</span>
                  )}
                </span>
              </div>
              <div
                className="absolute left-[88px] top-full mt-1 z-20 rounded-xl overflow-hidden"
                style={{
                  background: '#fff', border: '1px solid #e8e8e4', boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)', minWidth: 180,
                  opacity: showProjectPicker ? 1 : 0,
                  transform: showProjectPicker ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.97)',
                  pointerEvents: showProjectPicker ? 'auto' : 'none',
                  transition: 'opacity 0.18s ease, transform 0.18s cubic-bezier(0.34, 1.2, 0.64, 1)',
                }}
              >
                <button
                  className="w-full flex items-center gap-2.5 text-[13px] text-[#9098a4] transition-colors hover:bg-[#f7f7f4]"
                  style={{ padding: '9px 13px' }}
                  onClick={() => { setProjectId(''); setTags([]); setAvailableTags([]); setShowProjectPicker(false); }}
                >
                  Bez projektu
                </button>
                {projects.map(proj => (
                  <button
                    key={proj.id}
                    className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]"
                    style={{ padding: '9px 13px', color: proj.id === projectId ? '#0f1115' : '#3a3f47', fontWeight: proj.id === projectId ? 600 : 400 }}
                    onClick={() => { setProjectId(proj.id); setShowProjectPicker(false); }}
                  >
                    <span className="rounded-full flex-none" style={{ width: 7, height: 7, background: proj.color || '#9aa0aa' }} />
                    {proj.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Due date */}
            <div>
              <div
                className={ROW}
                style={{ borderBottom: showDatePicker ? 'none' : undefined }}
                onClick={() => { setShowDatePicker(o => !o); setShowPriorityPicker(false); setShowStatusPicker(false); setShowProjectPicker(false); }}
              >
                <span className={LABEL}><CalIcon /> Termin</span>
                <span className={VALUE} style={{ color: dueDate ? '#0f1115' : '#b0b5be' }}>
                  {dueDate
                    ? new Date(dueDate + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Brak terminu'}
                </span>
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateRows: showDatePicker ? '1fr' : '0fr',
                  transition: 'grid-template-rows 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
                }}
              >
                <div style={{ overflow: 'hidden' }}>
                  <div
                    className="pb-2"
                    style={{
                      opacity: showDatePicker ? 1 : 0,
                      transform: showDatePicker ? 'translateY(0)' : 'translateY(-4px)',
                      transition: 'opacity 0.22s ease, transform 0.22s ease',
                    }}
                  >
                    <CalendarDatePicker
                      value={dueDate}
                      onChange={val => setDueDate(val)}
                      onClose={() => setShowDatePicker(false)}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tags */}
            <div className={`${ROW} flex-wrap`} style={{ borderBottom: 'none' }}>
              <span className={LABEL} style={{ paddingTop: 1 }}><TagIcon /> Etykiety</span>
              <div className="flex-1 flex flex-wrap items-center gap-1.5">
                {tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 text-[11.5px] font-medium rounded-[5px]"
                    style={{ padding: '2px 6px 2px 8px', background: '#f1f0ed', color: '#5a606b' }}
                  >
                    {tag}
                    <button
                      onClick={() => removeTag(tag)}
                      className="text-[#9098a4] hover:text-[#0f1115] transition-colors"
                      style={{ lineHeight: 1, marginLeft: 1 }}
                    >
                      <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M18 6 6 18M6 6l12 12"/>
                      </svg>
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                  placeholder={projectId ? '+ Etykieta' : 'Wybierz projekt'}
                  disabled={!projectId}
                  className="text-[11.5px] outline-none bg-transparent"
                  style={{ color: '#9098a4', minWidth: 70, maxWidth: 100 }}
                />
                {projectId && matchingAvailableTags.slice(0, 6).map(tag => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => addExistingTag(tag)}
                    className="inline-flex items-center text-[11.5px] font-medium rounded-[5px] transition-colors hover:bg-[#e8e8e4]"
                    style={{ padding: '2px 7px', background: '#f7f7f4', color: '#5a606b' }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f0ed', margin: '4px 0 12px' }} />

          {/* Description */}
          <DescriptionField
            value={description}
            onChange={setDescription}
            title={content.trim() || undefined}
          />

          {/* Subtasks */}
          <div style={{ paddingTop: 6 }}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11.5px] font-medium text-[#b0b5be] uppercase tracking-wider">
                Podzadania{subtasks.length > 0 ? ` ${completedSubtasks}/${subtasks.length}` : ''}
              </p>
            </div>

            {/* Progress bar */}
            {subtasks.length > 0 && (
              <div className="rounded-full overflow-hidden mb-3" style={{ height: 3, background: '#ececec' }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${subtaskProgress}%`, background: '#0f1115' }}
                />
              </div>
            )}

            {/* Subtask list */}
            <div className="space-y-1">
              {subtasks.map((sub, index) => {
                return (
                  <div key={sub.id} className="group/sub rounded-xl transition-colors hover:bg-[#f7f7f4]" style={{ padding: '6px 7px' }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSubtask(sub.id)}
                        className="flex-none rounded-[5px] border transition-all duration-200 ease hover:scale-110 hover:border-[#0f1115]"
                        style={{
                          width: 17, height: 17,
                          borderColor: sub.isCompleted ? '#0f1115' : '#d4d4d0',
                          background: sub.isCompleted ? '#0f1115' : 'transparent',
                          flexShrink: 0,
                        }}
                        title={sub.isCompleted ? 'Oznacz jako otwarte' : 'Oznacz jako wykonane'}
                      >
                        {sub.isCompleted && (
                          <svg viewBox="0 0 24 24" width="8" height="8" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
                            <path d="M5 13l4 4L19 7"/>
                          </svg>
                        )}
                      </button>

                      <input
                        value={sub.content}
                        onChange={e => updateSubtask(sub.id, { content: e.target.value })}
                        onBlur={e => persistSubtasks(subtasks.map(s => s.id === sub.id ? { ...s, content: e.currentTarget.value } : s))}
                        className="min-w-0 flex-1 bg-transparent text-[13px] outline-none transition-colors"
                        style={{
                          color: sub.isCompleted ? '#9098a4' : '#0f1115',
                          textDecoration: sub.isCompleted ? 'line-through' : 'none',
                        }}
                      />

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setSubtaskDatePicker(current => current?.id === sub.id ? null : { id: sub.id, rect });
                        }}
                        className="inline-flex h-7 flex-none items-center gap-1 rounded-lg px-1.5 text-[11.5px] font-medium text-[#9098a4] transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115]"
                        title="Termin podzadania"
                      >
                        <CalIcon />
                        <span>{sub.dueDate ? new Date(sub.dueDate + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' }) : '—'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSubtaskDescriptionEditorId(sub.id);
                          setSubtaskDatePicker(null);
                        }}
                        className="flex h-7 w-7 flex-none items-center justify-center rounded-lg transition-colors duration-200 ease hover:bg-[#f1f0ed] hover:text-[#0f1115] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f1115]"
                        style={{ color: sub.description?.trim() ? '#9098a4' : '#c0c5cc' }}
                        title={sub.description?.trim() ? 'Opis dostępny' : 'Dodaj opis'}
                      >
                        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                          <path d="M14 2v6h6M8 13h8M8 17h5" />
                        </svg>
                      </button>

                      <div className="flex flex-none items-center opacity-0 transition-opacity group-hover/sub:opacity-100">
                        <button
                          type="button"
                          onClick={() => moveSubtask(sub.id, -1)}
                          disabled={index === 0}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9098a4] transition-colors hover:bg-[#f1f0ed] hover:text-[#0f1115] disabled:cursor-not-allowed disabled:opacity-40"
                          title="Przesuń wyżej"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 15 6-6 6 6"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => moveSubtask(sub.id, 1)}
                          disabled={index === subtasks.length - 1}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9098a4] transition-colors hover:bg-[#f1f0ed] hover:text-[#0f1115] disabled:cursor-not-allowed disabled:opacity-40"
                          title="Przesuń niżej"
                        >
                          <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="m6 9 6 6 6-6"/></svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSubtask(sub.id)}
                          className="flex h-6 w-6 items-center justify-center rounded-md text-[#9098a4] transition-colors hover:bg-red-50 hover:text-red-500"
                          title="Usuń podzadanie"
                        >
                          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M18 6 6 18M6 6l12 12"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Add subtask input */}
            <div
              className="flex items-center gap-2 mt-1.5 rounded-xl border border-dashed transition-colors"
              style={{ padding: '7px 10px', borderColor: '#e3e3df' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#c8c8c0'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e3e3df'; }}
            >
              <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="#9098a4" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <input
                type="text"
                value={newSubtask}
                onChange={e => setNewSubtask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSubtask(); } }}
                placeholder="Dodaj podzadanie..."
                className="flex-1 text-[12.5px] outline-none bg-transparent"
                style={{ color: '#9098a4' }}
              />
            </div>
          </div>
        </div>

        {subtaskDatePicker && typeof document !== 'undefined' && createPortal(
          <>
            <div
              className="fixed inset-0 z-[70]"
              onClick={() => setSubtaskDatePicker(null)}
            />
            <div
              className="fixed z-[71] animate-calendar-reveal"
              style={{
                top: subtaskDatePicker.rect.bottom + 6,
                left: Math.max(8, Math.min(subtaskDatePicker.rect.right - 240, window.innerWidth - 248)),
                width: 240,
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
              }}
              onClick={e => e.stopPropagation()}
            >
              <CalendarDatePicker
                value={subtasks.find(subtask => subtask.id === subtaskDatePicker.id)?.dueDate ?? ''}
                onChange={date => updateSubtask(subtaskDatePicker.id, { dueDate: date || undefined }, true)}
                onClose={() => setSubtaskDatePicker(null)}
              />
            </div>
          </>,
          document.body
        )}

        {editingSubtaskDescription && (
          <Suspense fallback={null}>
            <DescriptionEditorModal
              value={editingSubtaskDescription.description ?? ''}
              title={editingSubtaskDescription.content.trim() || content.trim() || undefined}
              onChange={description => updateSubtask(editingSubtaskDescription.id, { description }, true)}
              onClose={() => setSubtaskDescriptionEditorId(null)}
            />
          </Suspense>
        )}

        {/* ── Footer ── */}
        <div
          className="flex-none flex items-center justify-between px-5 py-3"
          style={{ borderTop: '1px solid #f1f0ed' }}
        >
          <div className="text-[11.5px] text-[#c0c5cc] flex flex-col gap-0.5">
            {loadedTask.createdAt && (
              <span>Dodano {new Date(loadedTask.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</span>
            )}
            <span>⌘ + Enter aby zapisać</span>
          </div>
          <button
            onClick={() => { onToggleComplete(); onClose(); }}
            className="flex items-center gap-2 text-[13px] font-semibold text-white rounded-xl transition-opacity hover:opacity-80"
            style={{ padding: '8px 16px', background: '#0f1115' }}
          >
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M5 13l4 4L19 7"/>
            </svg>
            {loadedTask.isCompleted ? 'Oznacz jako otwarte' : 'Oznacz jako wykonane'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
