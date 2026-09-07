import { lazy, Suspense, useState } from 'react';

// Tiptap jest ciężki — ładujemy edytor (osobny chunk) dopiero po otwarciu.
const DescriptionEditorModal = lazy(() =>
  import('./DescriptionEditorModal').then(m => ({ default: m.DescriptionEditorModal })),
);

interface Props {
  /** Opis w formacie markdown. */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Tytuł zadania przekazywany do pełnoekranowego edytora dla kontekstu. */
  title?: string;
  /** Dodatkowe klasy dla pola tekstowego, np. większa wysokość na desktopie. */
  textareaClassName?: string;
}

function ExpandIcon() {
  return (
    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}

/**
 * Pole opisu używane w modalach dodawania/edycji zadania.
 * Małe pole = szybka edycja markdown source. Ikona "Rozwiń" w prawym górnym
 * rogu otwiera pełnoekranowy edytor WYSIWYG ({@link DescriptionEditorModal}).
 */
export function DescriptionField({ value, onChange, placeholder = 'Dodaj kontekst, linki, kroki...', title, textareaClassName = '' }: Props) {
  const [editorOpen, setEditorOpen] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11.5px] font-medium text-[#b0b5be] uppercase tracking-wider">Opis</p>
        <button
          type="button"
          onClick={() => setEditorOpen(true)}
          title="Rozwiń edytor"
          className="flex items-center gap-1 text-[11px] font-medium text-[#9098a4] hover:text-[#0f1115] rounded-[6px] transition-colors"
          style={{ padding: '3px 7px' }}
        >
          <ExpandIcon /> Rozwiń
        </button>
      </div>

      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={3}
        placeholder={placeholder}
        className={`min-h-20 w-full resize-none rounded-xl text-[13.5px] leading-relaxed text-[#0f1115] outline-none ${textareaClassName}`}
        style={{ background: '#f7f7f4', border: '1px solid #ececec', padding: '10px 12px' }}
      />

      {editorOpen && (
        <Suspense fallback={null}>
          <DescriptionEditorModal
            value={value}
            title={title}
            onChange={onChange}
            onClose={() => setEditorOpen(false)}
          />
        </Suspense>
      )}
    </div>
  );
}
