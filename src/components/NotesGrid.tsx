import React, { useState } from 'react';
import type { Note } from '../types';

interface NotesGridProps {
  notes: Note[];
  onAdd: (title: string, content: string, tags: string[]) => void;
  onEdit: (id: string, updates: Partial<Note>) => void;
  onDelete: (id: string) => void;
  compactMode?: boolean;
  isLoading?: boolean;
}

const NotesGrid: React.FC<NotesGridProps> = ({ notes, onAdd, onEdit, onDelete, compactMode = false, isLoading = false }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [formData, setFormData] = useState({ title: '', content: '', tags: '' });

  const openAddModal = () => {
    setEditingNote(null);
    setFormData({ title: '', content: '', tags: '' });
    setIsModalOpen(true);
  };

  const openEditModal = (note: Note) => {
    setEditingNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      tags: note.tags ? note.tags.join(', ') : ''
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tagsArray = formData.tags.split(',').map(t => t.trim()).filter(t => t.length > 0);

    if (editingNote) {
      onEdit(editingNote.id, {
        title: formData.title,
        content: formData.content,
        tags: tagsArray
      });
    } else {
      onAdd(formData.title, formData.content, tagsArray);
    }
    setIsModalOpen(false);
  };

  const renderSkeleton = () => (
    <>
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="bg-white dark:bg-[#1C1C1E] p-4 rounded-xl border border-gray-100 dark:border-white/5 shadow-sm h-[180px] flex flex-col">
          <div className="flex justify-between items-start mb-2">
            <div className="h-4 bg-gray-100 dark:bg-white/5 rounded animate-pulse w-3/4"></div>
          </div>
          <div className="space-y-2 flex-1">
            <div className="h-3 bg-gray-50 dark:bg-white/5 rounded animate-pulse w-full"></div>
            <div className="h-3 bg-gray-50 dark:bg-white/5 rounded animate-pulse w-full"></div>
            <div className="h-3 bg-gray-50 dark:bg-white/5 rounded animate-pulse w-2/3"></div>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-50 dark:border-white/5 flex gap-1">
            <div className="h-3 w-10 bg-gray-100 dark:bg-white/5 rounded animate-pulse"></div>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-6">
        {/* Add Note Button */}
        {!compactMode && !isLoading && (
          <button
            onClick={openAddModal}
            className="group min-h-[140px] md:min-h-[200px] flex flex-col items-center justify-center border-2 border-dashed border-gray-200 dark:border-white/10 rounded-xl md:rounded-2xl hover:border-gray-400 dark:hover:border-white/30 hover:bg-gray-50/50 dark:hover:bg-white/5 transition-all duration-300 animate-fade-in"
          >
            <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gray-100 dark:bg-white/5 flex items-center justify-center text-gray-400 dark:text-gray-500 group-hover:bg-gray-200 dark:group-hover:bg-white/10 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors transform group-hover:scale-110">
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" /></svg>
            </div>
            <span className="mt-2 md:mt-3 text-xs md:text-sm font-medium text-gray-400 dark:text-gray-500 group-hover:text-gray-600 dark:group-hover:text-gray-300">Dodaj</span>
          </button>
        )}

        {isLoading ? renderSkeleton() : (
          notes.length === 0 && compactMode ? (
            <div className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-100 dark:border-white/10 rounded-xl bg-gray-50/50 dark:bg-white/5 col-span-2 md:col-span-3 xl:col-span-4 animate-fade-in">
              <p className="text-gray-400 dark:text-gray-500 font-medium text-xs">Brak notatek</p>
            </div>
          ) : (
            notes.map((note, index) => (
              <div
                key={note.id}
                onClick={() => openEditModal(note)}
                className={`group bg-white dark:bg-[#1C1C1E] p-3 md:p-6 rounded-xl md:rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 flex flex-col h-full relative cursor-pointer animate-fade-in-up ${index < 5 ? `delay-${index * 100}` : 'delay-0'}`}
              >
                {/* Action Buttons */}
                <div className="absolute top-2 right-2 md:top-4 md:right-4 flex space-x-1 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  <button
                    onClick={(e) => { e.stopPropagation(); onDelete(note.id); }}
                    className="p-1 md:p-1.5 text-gray-300 dark:text-gray-600 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <svg className="w-3.5 h-3.5 md:w-4 md:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>

                <div className="flex items-start justify-between mb-2 md:mb-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white leading-tight pr-6 md:pr-12 text-xs md:text-base line-clamp-2">{note.title}</h4>
                </div>

                <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400 leading-relaxed mb-3 md:mb-4 flex-grow whitespace-pre-wrap line-clamp-4 md:line-clamp-6">
                  {note.content}
                </p>

                <div className="flex items-center justify-between mt-auto pt-2 md:pt-4 border-t border-gray-50 dark:border-white/5">
                  <div className="flex flex-wrap gap-1 md:gap-2">
                    {note.tags && note.tags.length > 0 && note.tags.slice(0, 2).map((tag, idx) => (
                      <span key={idx} className="px-1.5 py-0.5 bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-gray-400 text-[9px] md:text-[10px] uppercase tracking-wider font-semibold rounded-md truncate max-w-[60px]">
                        #{tag}
                      </span>
                    ))}
                  </div>
                  <span className="text-[9px] md:text-[10px] text-gray-300 dark:text-gray-600 whitespace-nowrap ml-1">
                    {new Date(note.createdAt).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}
                  </span>
                </div>
              </div>
            ))
          )
        )}
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm transition-opacity animate-fade-in" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-lg p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-white/5">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
              {editingNote ? 'Edytuj notatkę' : 'Nowa notatka'}
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tytuł</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  placeholder="Np. Pomysł na projekt..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Treść</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all resize-none h-32"
                  placeholder="Wpisz treść notatki..."
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Tagi (oddzielone przecinkami)</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  placeholder="praca, pomysły, ważne"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
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
            </form>
          </div>
        </div>
      )}
    </>
  );
};

export default NotesGrid;
