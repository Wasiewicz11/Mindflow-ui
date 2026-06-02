import { useEffect, useState } from 'react';
import type { Project } from '../../../shared/types';
import { createProjectTag, deleteProjectTag, getProjectTags, renameProjectTag } from '../api/projectsApi';

const PROJECT_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#9CA3AF'];

interface ProjectSettingsModalProps {
  project: Project;
  onClose: () => void;
  onUpdateProject: (id: string, name: string, color: string) => Promise<void>;
  onDeleteProject: (id: string) => void;
  onTagsChanged: () => void;
}

type Tab = 'general' | 'labels';

export function ProjectSettingsModal({
  project,
  onClose,
  onUpdateProject,
  onDeleteProject,
  onTagsChanged,
}: ProjectSettingsModalProps) {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [name, setName] = useState(project.name);
  const [color, setColor] = useState(project.color || '#9CA3AF');
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    let isActive = true;

    getProjectTags(project.id)
      .then(projectTags => {
        if (isActive) setTags(projectTags);
      })
      .catch(error => {
        console.warn('Failed to fetch project tags:', error);
      });

    return () => {
      isActive = false;
    };
  }, [project.id]);

  async function handleSaveGeneral() {
    if (!name.trim()) return;
    setIsSaving(true);
    await onUpdateProject(project.id, name.trim(), color);
    setIsSaving(false);
  }

  async function handleAddTag() {
    const tag = newTag.trim();
    if (!tag) return;

    const nextTags = await createProjectTag(project.id, tag);
    setTags(nextTags);
    setNewTag('');
    onTagsChanged();
  }

  function startEditingTag(tag: string) {
    setEditingTag(tag);
    setEditingValue(tag);
  }

  async function handleRenameTag(tag: string) {
    const nextName = editingValue.trim();
    if (!nextName) return;

    const nextTags = await renameProjectTag(project.id, tag, nextName);
    setTags(nextTags);
    setEditingTag(null);
    setEditingValue('');
    onTagsChanged();
  }

  async function handleDeleteTag(tag: string) {
    const nextTags = await deleteProjectTag(project.id, tag);
    setTags(nextTags);
    onTagsChanged();
  }

  function handleDeleteProject() {
    onDeleteProject(project.id);
    onClose();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'labels', label: 'Etykiety' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md relative z-10 border border-gray-100 dark:border-white/5 overflow-hidden animate-scale-in">
        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate">{name}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors ml-2 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex border-b border-gray-100 dark:border-white/5 px-6 mt-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`text-sm font-medium pb-3 mr-6 border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-gray-900 dark:border-white text-gray-900 dark:text-white'
                  : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'general' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nazwa projektu</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Kolor</label>
                <div className="flex gap-2.5">
                  {PROJECT_COLORS.map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setColor(option)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        color === option ? 'scale-125 ring-2 ring-offset-1 ring-gray-400 dark:ring-white/50 dark:ring-offset-black' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: option }}
                    />
                  ))}
                </div>
              </div>
              <button
                onClick={handleSaveGeneral}
                disabled={isSaving || !name.trim()}
                className="w-full px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-black dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
              >
                {isSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
              <div className="pt-4 border-t border-gray-100 dark:border-white/5">
                {!showDeleteConfirm ? (
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    className="w-full px-4 py-2 text-sm font-medium text-red-500 hover:text-red-600 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl transition-colors"
                  >
                    Usuń projekt
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-500 text-center">Czy na pewno? Tej operacji nie można cofnąć.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                        Anuluj
                      </button>
                      <button onClick={handleDeleteProject} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                        Usuń
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'labels' && (
            <div className="space-y-3">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newTag}
                  onChange={e => setNewTag(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } }}
                  placeholder="Nowa etykieta"
                  className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                />
                <button
                  onClick={handleAddTag}
                  disabled={!newTag.trim()}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-black dark:hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  Dodaj
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                {tags.map(tag => (
                  <div key={tag} className="flex items-center gap-2 rounded-xl border border-gray-100 dark:border-white/10 px-3 py-2">
                    {editingTag === tag ? (
                      <input
                        autoFocus
                        type="text"
                        value={editingValue}
                        onChange={e => setEditingValue(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') handleRenameTag(tag);
                          if (e.key === 'Escape') setEditingTag(null);
                        }}
                        className="min-w-0 flex-1 bg-transparent text-sm text-gray-900 dark:text-white outline-none"
                      />
                    ) : (
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-700 dark:text-gray-200">{tag}</span>
                    )}

                    {editingTag === tag ? (
                      <button onClick={() => handleRenameTag(tag)} className="text-xs font-medium text-gray-900 dark:text-white">
                        Zapisz
                      </button>
                    ) : (
                      <button onClick={() => startEditingTag(tag)} className="text-xs font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200">
                        Edytuj
                      </button>
                    )}
                    <button onClick={() => handleDeleteTag(tag)} className="text-xs font-medium text-red-400 hover:text-red-500">
                      Usuń
                    </button>
                  </div>
                ))}
                {tags.length === 0 && (
                  <div className="rounded-xl border border-dashed border-gray-200 dark:border-white/10 px-4 py-8 text-center text-sm text-gray-400">
                    Brak etykiet
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
