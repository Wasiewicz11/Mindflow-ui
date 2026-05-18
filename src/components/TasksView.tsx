import { useEffect, useRef, useState } from 'react';
import type { Space } from '../api/spaces';
import type { Task } from '../api/tasks';
import { useTasks } from '../hooks/useTasks';

interface Props {
  space: Space;
  onBack: () => void;
}

export function TasksView({ space, onBack }: Props) {
  const { tasks, addTask, editTask, removeTask } = useTasks(true);
  const [inputValue, setInputValue] = useState('');
  const [adding, setAdding] = useState(false);
  const [connected, setConnected] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [formContent, setFormContent] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onOnline = () => setConnected(true);
    const onOffline = () => setConnected(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  async function handleAdd() {
    if (!inputValue.trim()) return;
    setAdding(true);
    try {
      await addTask(inputValue.trim());
      setInputValue('');
    } finally {
      setAdding(false);
      inputRef.current?.focus();
    }
  }

  function openEditModal(task: Task) {
    setEditingTask(task);
    setFormContent(task.content);
    setIsModalOpen(true);
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingTask || !formContent.trim()) return;
    await editTask(editingTask.id, { content: formContent.trim() });
    setIsModalOpen(false);
    setEditingTask(null);
  }

  async function handleDelete(id: string) {
    await removeTask(id);
    setIsModalOpen(false);
    setEditingTask(null);
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#000000] p-8">
      <div className="max-w-2xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <button
              onClick={onBack}
              className="p-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
                {space.name}
              </h1>
              {space.description && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {space.description}
                </p>
              )}
            </div>
          </div>

          {/* Live/Offline indicator */}
          <div
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              connected
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border-red-200 dark:border-red-800'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {connected ? 'Live' : 'Offline'}
          </div>
        </div>

        {/* Add task input */}
        <div className="flex gap-2 mb-8">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !adding && handleAdd()}
            placeholder="Dodaj zadanie..."
            className="flex-1 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:bg-white dark:focus:bg-[#1C1C1E] focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 focus:border-gray-200 dark:focus:border-white/10 outline-none transition-all"
          />
          <button
            onClick={handleAdd}
            disabled={adding || !inputValue.trim()}
            className="px-4 py-3 rounded-xl text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>

        {/* Task list */}
        <div className="space-y-2">
          {tasks.length === 0 && !adding && (
            <div className="flex flex-col items-center justify-center h-32 border border-gray-100 dark:border-white/5 rounded-2xl bg-gray-50/30 dark:bg-white/5 animate-fade-in">
              <p className="text-sm text-gray-400 dark:text-gray-500">Brak zadań. Dodaj pierwsze!</p>
            </div>
          )}

          {tasks.map((task, index) => (
            <TaskRow
              key={task.id}
              task={task}
              index={index}
              onEdit={() => openEditModal(task)}
              onDelete={() => removeTask(task.id)}
            />
          ))}
        </div>
      </div>

      {/* Edit modal */}
      {isModalOpen && editingTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setIsModalOpen(false)}
          />
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              Edytuj zadanie
            </h3>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Treść
                </label>
                <input
                  type="text"
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  placeholder="Co trzeba zrobić?"
                  required
                  autoFocus
                />
              </div>

              <div className="flex items-center pt-4">
                <button
                  type="button"
                  onClick={() => handleDelete(editingTask.id)}
                  className="text-sm font-medium text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-xl transition-colors mr-auto"
                >
                  Usuń
                </button>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm"
                  >
                    Zapisz
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: Task;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
}

function TaskRow({ task, index, onEdit, onDelete }: TaskRowProps) {
  const staggerClass = index < 5 ? `delay-${[0, 75, 150, 200, 300][index] ?? 0}` : 'delay-0';

  return (
    <div
      onClick={onEdit}
      className={`group relative flex items-center justify-between rounded-xl border bg-white dark:bg-[#1C1C1E] border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer p-4 animate-fade-in-up ${staggerClass}`}
    >
      <div className="flex items-center flex-1 min-w-0 mr-4 space-x-4">
        {/* Checkbox placeholder */}
        <div className="flex-shrink-0 w-5 h-5 rounded-md border border-gray-300 dark:border-white/20 bg-white dark:bg-white/5" />

        <span className="font-medium text-sm text-gray-700 dark:text-gray-200 truncate">
          {task.content}
        </span>
      </div>

      {/* Delete button — slides in on hover */}
      <div className="
        flex items-center justify-center
        w-0 opacity-0 translate-x-4
        group-hover:w-8 group-hover:opacity-100 group-hover:translate-x-0
        transition-all duration-300 ease-out
        overflow-hidden
      ">
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          title="Usuń"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
  );
}
