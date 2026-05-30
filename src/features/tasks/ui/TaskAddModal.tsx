import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Project, TaskStatus } from '../../../shared/types';
import { TaskPriority } from '../../../shared/types';
import { CalendarDatePicker } from '../../../shared/ui/CalendarDatePicker';
import { DescriptionField } from './DescriptionField';

interface Props {
  projects: Project[];
  initialStatus?: TaskStatus;
  initialPriority?: TaskPriority;
  initialDueDate?: string;
  initialProjectId?: string;
  onAdd: (content: string, priority: TaskPriority, dueDate?: string, projectId?: string, status?: TaskStatus, description?: string) => void;
  onClose: () => void;
}

const PRIORITY: Record<TaskPriority, { label: string; name: string; fg: string; bg: string }> = {
  [TaskPriority.P1]: { label: 'P1', name: 'Pilne',   fg: 'oklch(0.62 0.18 25)',  bg: 'oklch(0.96 0.03 25)'   },
  [TaskPriority.P2]: { label: 'P2', name: 'Wysokie', fg: 'oklch(0.70 0.16 55)',  bg: 'oklch(0.96 0.03 55)'   },
  [TaskPriority.P3]: { label: 'P3', name: 'Średnie', fg: 'oklch(0.70 0.13 230)', bg: 'oklch(0.96 0.03 230)'  },
  [TaskPriority.P4]: { label: 'P4', name: 'Niskie',  fg: 'oklch(0.65 0.01 260)', bg: 'oklch(0.95 0.005 260)' },
};

const STATUS_OPTIONS: Record<TaskStatus, { name: string; fg: string; bg: string; dot: string }> = {
  NotStarted: { name: 'Nie rozpoczęto', fg: 'oklch(0.55 0.01 260)', bg: 'oklch(0.96 0.005 260)', dot: 'oklch(0.75 0.01 260)' },
  InProgress:  { name: 'W trakcie',     fg: 'oklch(0.55 0.15 230)', bg: 'oklch(0.96 0.03 230)',  dot: 'oklch(0.60 0.18 230)' },
  Completed:   { name: 'Ukończone',     fg: 'oklch(0.50 0.15 145)', bg: 'oklch(0.96 0.03 145)',  dot: 'oklch(0.55 0.18 145)' },
};

function CalIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3"/></svg>;
}
function FolderIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>;
}
function FlagSmall({ color }: { color: string }) {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" style={{ color }}><path fillRule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054a8.25 8.25 0 005.58.652l3.109-.732a.75.75 0 01.917.81 47.784 47.784 0 00.005 10.337.75.75 0 01-.574.812l-3.114.733a9.75 9.75 0 01-6.594-.158l-.108-.054a8.25 8.25 0 00-5.69-.625l-2.202.55V21a.75.75 0 01-1.5 0V3A.75.75 0 013 2.25z" clipRule="evenodd"/></svg>;
}
function StatusIcon() {
  return <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3" strokeLinecap="round"/></svg>;
}

export function TaskAddModal({ projects, initialStatus = 'NotStarted', initialPriority = TaskPriority.P4, initialDueDate = '', initialProjectId = '', onAdd, onClose }: Props) {
  const [content, setContent]         = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority]       = useState<TaskPriority>(initialPriority);
  const [status, setStatus]           = useState<TaskStatus>(initialStatus);
  const [dueDate, setDueDate]         = useState(initialDueDate);
  const [projectId, setProjectId]     = useState(initialProjectId);

  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showStatusPicker, setShowStatusPicker]     = useState(false);
  const [showProjectPicker, setShowProjectPicker]   = useState(false);
  const [showDatePicker, setShowDatePicker]         = useState(false);

  const titleRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [content]);

  const activeProject = projects.find(p => p.id === projectId);
  const p = PRIORITY[priority] ?? PRIORITY[TaskPriority.P4];
  const s = STATUS_OPTIONS[status] ?? STATUS_OPTIONS.NotStarted;

  function handleSave() {
    if (!content.trim()) return;
    onAdd(content.trim(), priority, dueDate || undefined, projectId || undefined, status, description || undefined);
    onClose();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
  }

  const ROW   = 'flex items-start gap-3 py-2.5 border-b border-[#f1f0ed] cursor-pointer';
  const LABEL = 'flex items-center gap-1.5 text-[12.5px] text-[#9098a4] flex-none w-[88px]';
  const VALUE = 'flex-1 text-[13px] text-[#0f1115]';

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.18)' }}
        onClick={onClose}
      />

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
        {/* Header */}
        <div className="flex-none flex items-center justify-between px-5 pt-4 pb-3" style={{ borderBottom: '1px solid #f1f0ed' }}>
          <span className="text-[13px] font-semibold text-[#0f1115]">Nowe zadanie</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-[#0f1115] hover:bg-[#f1f1ef]"
            style={{ width: 28, height: 28 }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar px-5 py-4 space-y-1">
          <textarea
            ref={titleRef}
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={1}
            autoFocus
            placeholder="Nazwa zadania"
            className="w-full resize-none outline-none bg-transparent leading-snug"
            style={{ fontSize: 20, fontWeight: 650, color: '#0f1115', letterSpacing: '-0.01em', minHeight: 32 }}
          />

          <div style={{ marginTop: 12 }}>
            {/* Status */}
            <div className="relative">
              <div className={ROW} onClick={() => { setShowStatusPicker(o => !o); setShowPriorityPicker(false); setShowProjectPicker(false); setShowDatePicker(false); }}>
                <span className={LABEL}><StatusIcon /> Status</span>
                <span className={VALUE}>
                  <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold rounded-[5px]" style={{ padding: '2px 7px', color: s.fg, background: s.bg }}>
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
                  <button key={k} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: k === status ? v.fg : '#0f1115' }} onClick={() => { setStatus(k); setShowStatusPicker(false); }}>
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
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold rounded-[5px]" style={{ padding: '2px 7px', color: p.fg, background: p.bg }}>
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
                  <button key={k} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: k === priority ? v.fg : '#0f1115' }} onClick={() => { setPriority(k); setShowPriorityPicker(false); }}>
                    <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold rounded-[4px] flex-none" style={{ padding: '1px 5px', color: v.fg, background: v.bg }}>{v.label}</span>
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
                      <span className="rounded-full inline-block" style={{ width: 7, height: 7, background: activeProject.color || '#9aa0aa', flexShrink: 0 }} />
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
                <button className="w-full flex items-center gap-2.5 text-[13px] text-[#9098a4] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px' }} onClick={() => { setProjectId(''); setShowProjectPicker(false); }}>Bez projektu</button>
                {projects.map(proj => (
                  <button key={proj.id} className="w-full flex items-center gap-2.5 text-[13px] transition-colors hover:bg-[#f7f7f4]" style={{ padding: '9px 13px', color: proj.id === projectId ? '#0f1115' : '#3a3f47', fontWeight: proj.id === projectId ? 600 : 400 }} onClick={() => { setProjectId(proj.id); setShowProjectPicker(false); }}>
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
                  {dueDate ? new Date(dueDate + 'T00:00:00').toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }) : 'Brak terminu'}
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
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f0ed', margin: '4px 0 12px' }} />

          {/* Description */}
          <DescriptionField
            value={description}
            onChange={setDescription}
            title={content.trim() || undefined}
          />
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between px-5 py-3" style={{ borderTop: '1px solid #f1f0ed' }}>
          <p className="text-[11.5px] text-[#c0c5cc]">⌘ + Enter aby zapisać</p>
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="text-[13px] font-medium text-[#9098a4] hover:text-[#0f1115] rounded-xl transition-colors" style={{ padding: '8px 14px' }}>
              Anuluj
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="flex items-center gap-2 text-[13px] font-semibold text-white rounded-xl transition-opacity hover:opacity-80 disabled:opacity-30"
              style={{ padding: '8px 16px', background: '#0f1115' }}
            >
              Dodaj zadanie
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
