import React, { useState } from 'react';
import type { Space, User } from '../types';

const SPACE_COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444', '#9CA3AF'];

interface SpaceSettingsModalProps {
  space: Space;
  user: User;
  onClose: () => void;
  onUpdateSpace: (id: string, name: string, color: string) => Promise<void>;
  onDeleteSpace: (id: string) => void;
}

type Tab = 'general' | 'members' | 'invite';

const SpaceSettingsModal: React.FC<SpaceSettingsModalProps> = ({
  space, onClose, onUpdateSpace, onDeleteSpace,
}) => {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [name, setName] = useState(space.name);
  const [color, setColor] = useState(space.color || '#9CA3AF');
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleSaveGeneral = async () => {
    if (!name.trim()) return;
    setIsSaving(true);
    await onUpdateSpace(space.id, name.trim(), color);
    setIsSaving(false);
    onClose();
  };

  const handleDeleteSpace = () => {
    onDeleteSpace(space.id);
    onClose();
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: 'general', label: 'Ogólne' },
    { id: 'members', label: 'Członkowie' },
    { id: 'invite', label: 'Zaproszenie' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-md relative z-10 border border-gray-100 dark:border-white/5 overflow-hidden animate-scale-in">

        <div className="flex items-center justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
            <h3 className="text-lg font-bold text-gray-900 dark:text-white truncate max-w-[220px]">{name}</h3>
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
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Nazwa przestrzeni</label>
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
                  {SPACE_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColor(c)}
                      className={`w-6 h-6 rounded-full transition-transform ${
                        color === c ? 'scale-125 ring-2 ring-offset-1 ring-gray-400 dark:ring-white/50 dark:ring-offset-black' : 'hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
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
                    Usuń przestrzeń
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-red-500 text-center">Czy na pewno? Tej operacji nie można cofnąć.</p>
                    <div className="flex gap-2">
                      <button onClick={() => setShowDeleteConfirm(false)} className="flex-1 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:bg-gray-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                        Anuluj
                      </button>
                      <button onClick={handleDeleteSpace} className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors">
                        Usuń
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'members' && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Funkcja współdzielenia przestrzeni będzie dostępna wkrótce.</p>
          )}

          {activeTab === 'invite' && (
            <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-8">Funkcja zaproszeń będzie dostępna wkrótce.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SpaceSettingsModal;
