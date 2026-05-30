import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from 'tiptap-markdown';

interface Props {
  /** Aktualny opis w formacie markdown. */
  value: string;
  /** Tytuł zadania — pokazywany w nagłówku edytora dla kontekstu. */
  title?: string;
  /** Wywoływane przy zamknięciu, ze zserializowanym markdownem. */
  onChange: (value: string) => void;
  onClose: () => void;
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

/**
 * Pełnoekranowy edytor opisu w stylu dokumentu Notion.
 * Live markdown: `# ` -> nagłówek, `- ` -> lista, `[ ] ` -> checkbox, ``` -> blok kodu.
 * Dane trzymane są jako markdown string (kompatybilne wstecz ze zwykłym tekstem).
 */
export function DescriptionEditorModal({ value, title, onChange, onClose }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Pisz… Użyj # dla nagłówka, - dla listy, [ ] dla checkboxa.' }),
      Markdown.configure({ html: false, breaks: true }),
    ],
    content: value,
    autofocus: 'end',
    editorProps: {
      attributes: { class: 'mf-doc outline-none' },
    },
  });

  function handleClose() {
    if (editor) {
      // tiptap-markdown nie augmentuje typu Storage, więc zawężamy ręcznie.
      const md = (editor.storage as { markdown?: { getMarkdown: () => string } }).markdown;
      onChange(md?.getMarkdown() ?? '');
    }
    onClose();
  }

  // Trzymamy zdarzenia w obrębie tego okna, żeby Esc/klik nie zamknął modala zadania pod spodem.
  function handleKeyDown(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop — klik poza obszar zapisuje i wraca do widoku zadania */}
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.28)' }}
        onClick={handleClose}
      />

      <div
        className="relative z-10 w-full flex flex-col"
        style={{
          maxWidth: 820,
          height: '82vh',
          maxHeight: '82vh',
          background: '#fff',
          border: '1px solid #e8e8e4',
          borderRadius: 18,
          boxShadow: '0 24px 48px -12px rgba(15,17,21,.22)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-none flex items-start justify-between px-7 pt-5 pb-4" style={{ borderBottom: '1px solid #f1f0ed' }}>
          <div className="min-w-0">
            <p className="text-[11.5px] font-medium text-[#b0b5be] uppercase tracking-wider">Opis</p>
            {title && (
              <p className="text-[15px] font-semibold text-[#0f1115] truncate mt-0.5" style={{ letterSpacing: '-0.01em' }}>
                {title}
              </p>
            )}
          </div>
          <button
            onClick={handleClose}
            title="Zamknij (Esc)"
            className="flex items-center justify-center rounded-[6px] transition-colors text-[#9098a4] hover:text-[#0f1115] hover:bg-[#f1f1ef] flex-none"
            style={{ width: 28, height: 28 }}
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body — edytor */}
        <div
          className="flex-1 overflow-y-auto custom-scrollbar px-7 py-6"
          onClick={() => editor?.chain().focus().run()}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex-none flex items-center justify-between px-7 py-3" style={{ borderTop: '1px solid #f1f0ed' }}>
          <p className="text-[11.5px] text-[#c0c5cc]"># nagłówek · - lista · [ ] checkbox · ``` kod · Esc aby zamknąć</p>
          <button
            onClick={handleClose}
            className="text-[13px] font-semibold text-white rounded-xl transition-opacity hover:opacity-80"
            style={{ padding: '8px 16px', background: '#0f1115' }}
          >
            Gotowe
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
