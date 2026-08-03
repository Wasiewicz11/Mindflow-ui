import { createPortal } from 'react-dom';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { Placeholder } from '@tiptap/extensions';
import { Markdown } from 'tiptap-markdown';
import { SlashCommand } from './slashCommand';

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
      SlashCommand,
      Placeholder.configure({ placeholder: "Pisz… Wpisz '/' aby wybrać blok." }),
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
    // Klawisz obsłużony już przez edytor (np. slash menu, nowa linia) — nie zamykaj.
    if (e.defaultPrevented) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      handleClose();
    }
    // Cmd/Ctrl+Enter — szybki zapis, jak przy zapisywaniu zadania.
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleClose();
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-stretch justify-stretch p-0 lg:items-center lg:justify-center lg:p-4" onKeyDown={handleKeyDown}>
      {/* Backdrop — klik poza obszar zapisuje i wraca do widoku zadania */}
      <div
        className="absolute inset-0 backdrop-blur-[2px]"
        style={{ background: 'rgba(15,17,21,.28)' }}
        onClick={handleClose}
      />

      <div
        className="relative z-10 flex h-[100dvh] w-full flex-col overflow-hidden bg-white lg:h-[82vh] lg:max-h-[82vh] lg:max-w-[820px] lg:rounded-[18px] lg:border lg:border-[#e8e8e4] lg:shadow-[0_24px_48px_-12px_rgba(15,17,21,.22)]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-none items-start justify-between px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] lg:px-7 lg:pb-4 lg:pt-5" style={{ borderBottom: '1px solid #f1f0ed' }}>
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
            className="flex h-10 w-10 flex-none items-center justify-center rounded-[8px] text-[#9098a4] transition-colors hover:bg-[#f1f1ef] hover:text-[#0f1115] lg:h-7 lg:w-7 lg:rounded-[6px]"
          >
            <CloseIcon />
          </button>
        </div>

        {/* Body — edytor */}
        <div
          className="custom-scrollbar flex-1 overflow-y-auto px-4 py-5 [&_.mf-doc]:!text-[16px] lg:px-7 lg:py-6 lg:[&_.mf-doc]:!text-[15px]"
          onClick={() => editor?.chain().focus().run()}
        >
          <EditorContent editor={editor} />
        </div>

        {/* Footer */}
        <div className="flex flex-none items-center justify-between px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:px-7 lg:py-3" style={{ borderTop: '1px solid #f1f0ed' }}>
          <p className="hidden text-[11.5px] text-[#c0c5cc] lg:block">/ menu bloków · # nagłówek · [ ] checkbox · ⌘+Enter zapisz · Esc zamknij</p>
          <button
            onClick={handleClose}
            className="ml-auto min-h-11 rounded-xl text-[13px] font-semibold text-white transition-opacity hover:opacity-80"
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
