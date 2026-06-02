import { useEffect, useState } from 'react';
import { createSpace, deleteSpace, getSpaces } from '../api/spacesApi';
import type { Space } from '../../../shared/types';
import { useAuth } from '../../auth/model/useAuth';
import { BrandMark } from '../../../shared/ui/BrandMark';

interface Props {
  onSelectSpace: (space: Space) => void;
}

export function SpacesView({ onSelectSpace }: Props) {
  const { logout } = useAuth();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    getSpaces()
      .then(setSpaces)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate() {
    if (!formName.trim()) return;
    setCreating(true);
    try {
      const space = await createSpace({
        name: formName.trim(),
        description: formDesc.trim(),
      });
      setSpaces((prev) => [...prev, space]);
      setShowModal(false);
      setFormName('');
      setFormDesc('');
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    await deleteSpace(id);
    setSpaces((prev) => prev.filter((s) => s.id !== id));
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-[#000000] p-8">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-10">
          <div className="flex items-center gap-3">
            <BrandMark markClassName="h-8 w-8" />
            <span className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">
              Mindle
            </span>
          </div>

          <button
            onClick={logout}
            className="text-sm px-4 py-2 rounded-xl border border-gray-200 dark:border-white/10 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-gray-100/50 dark:hover:bg-white/5 transition-all"
          >
            Wyloguj
          </button>
        </div>

        {/* Page title */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
            Przestrzenie
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Wybierz przestrzeń, aby zarządzać zadaniami
          </p>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-xl p-5 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 animate-pulse h-24"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {spaces.map((space) => (
              <div
                key={space.id}
                onClick={() => onSelectSpace(space)}
                className="group rounded-xl p-5 cursor-pointer transition-all duration-200 bg-white dark:bg-[#1C1C1E] border border-gray-100 dark:border-white/5 hover:border-gray-200 dark:hover:border-white/10 hover:shadow-md hover:-translate-y-0.5 animate-fade-in"
              >
                <div className="flex items-start justify-between mb-3">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-gray-600 dark:text-gray-300"
                    style={{ backgroundColor: 'rgba(0,0,0,0.05)' }}
                  >
                    {space.name[0]?.toUpperCase()}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, space.id)}
                    className="opacity-0 group-hover:opacity-100 transition-all p-1.5 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Usuń przestrzeń"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>

                <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-1">
                  {space.name}
                </h3>
                {space.description && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
                    {space.description}
                  </p>
                )}

                <div className="flex items-center gap-1 text-xs font-medium text-gray-400 dark:text-gray-500 mt-3 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                  Otwórz
                  <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            ))}

            {/* New space card */}
            <button
              onClick={() => setShowModal(true)}
              className="rounded-xl p-5 cursor-pointer transition-all duration-200 flex flex-col items-center justify-center gap-2 min-h-32 border-2 border-dashed border-gray-200 dark:border-white/10 text-gray-400 dark:text-gray-500 hover:border-gray-400 dark:hover:border-white/30 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-50/50 dark:hover:bg-white/5"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
              </svg>
              <span className="text-xs font-medium">Nowa przestrzeń</span>
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={() => setShowModal(false)}
        >
          <div className="absolute inset-0 bg-gray-900/20 dark:bg-black/40 backdrop-blur-sm animate-fade-in" />
          <div
            className="bg-white dark:bg-[#1C1C1E] rounded-2xl shadow-xl w-full max-w-sm p-6 relative animate-scale-in z-10 border border-gray-100 dark:border-white/5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Nowa przestrzeń
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-lg transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Nazwa
                </label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="np. Praca, Dom..."
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                  Opis{' '}
                  <span className="text-gray-300 dark:text-gray-600">(opcjonalnie)</span>
                </label>
                <input
                  type="text"
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Do czego służy ta przestrzeń?"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-white focus:bg-white dark:focus:bg-white/10 focus:ring-2 focus:ring-gray-200 dark:focus:ring-white/10 outline-none transition-all"
                />
              </div>

              <div className="flex items-center pt-2 gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl transition-colors"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !formName.trim()}
                  className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl hover:bg-gray-800 dark:hover:bg-gray-200 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? 'Tworzenie...' : 'Utwórz'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
