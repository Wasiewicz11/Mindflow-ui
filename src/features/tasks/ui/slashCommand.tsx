import { Extension } from '@tiptap/core';
import type { Editor } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { SlashCommandList, type SlashItem, type SlashListRef } from './SlashCommandList';

const ITEMS: SlashItem[] = [
  { title: 'Tekst', subtitle: 'Zwykły akapit', keywords: ['tekst', 'paragraph', 'text', 'akapit'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setParagraph().run() },
  { title: 'Nagłówek 1', subtitle: 'Duży nagłówek', keywords: ['naglowek', 'h1', 'heading', 'tytul'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run() },
  { title: 'Nagłówek 2', subtitle: 'Średni nagłówek', keywords: ['naglowek', 'h2', 'heading'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run() },
  { title: 'Nagłówek 3', subtitle: 'Mały nagłówek', keywords: ['naglowek', 'h3', 'heading'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run() },
  { title: 'Lista punktowana', subtitle: 'Lista z kropkami', keywords: ['lista', 'bullet', 'punkty', 'ul'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBulletList().run() },
  { title: 'Lista numerowana', subtitle: 'Lista 1, 2, 3', keywords: ['lista', 'numer', 'ordered', 'ol'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleOrderedList().run() },
  { title: 'Lista zadań', subtitle: 'Checkboxy do odhaczania', keywords: ['checkbox', 'zadania', 'task', 'todo', 'lista'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleTaskList().run() },
  { title: 'Cytat', subtitle: 'Blok cytatu', keywords: ['cytat', 'quote', 'blockquote'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleBlockquote().run() },
  { title: 'Blok kodu', subtitle: 'Fragment kodu', keywords: ['kod', 'code', 'snippet'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).toggleCodeBlock().run() },
  { title: 'Linia', subtitle: 'Pozioma linia oddzielająca', keywords: ['linia', 'divider', 'hr', 'separator'],
    command: ({ editor, range }) => editor.chain().focus().deleteRange(range).setHorizontalRule().run() },
];

/** Ustawia popup tuż pod kursorem (clientRect z suggestion). */
function position(popup: HTMLDivElement, clientRect?: (() => DOMRect | null) | null) {
  const rect = clientRect?.();
  if (!rect) return;
  popup.style.left = `${rect.left}px`;
  popup.style.top = `${rect.bottom + 6}px`;
}

/**
 * Slash command (`/`) dla edytora opisu — menu z dostępnymi blokami
 * (nagłówki, listy, checkboxy, kod itd.) w stylu Notion.
 */
export const SlashCommand = Extension.create({
  name: 'slashCommand',

  addProseMirrorPlugins() {
    return [
      Suggestion<SlashItem>({
        editor: this.editor,
        char: '/',
        startOfLine: false,
        command: ({ editor, range, props }) => props.command({ editor, range }),
        items: ({ query }) => {
          const q = query.toLowerCase().trim();
          if (!q) return ITEMS;
          return ITEMS.filter(
            item =>
              item.title.toLowerCase().includes(q) ||
              item.keywords.some(k => k.includes(q)),
          );
        },
        render: () => {
          let renderer: ReactRenderer<SlashListRef> | null = null;
          let popup: HTMLDivElement | null = null;

          return {
            onStart: props => {
              renderer = new ReactRenderer(SlashCommandList, { props, editor: props.editor as Editor });
              popup = document.createElement('div');
              popup.style.position = 'fixed';
              popup.style.zIndex = '70';
              document.body.appendChild(popup);
              popup.appendChild(renderer.element);
              position(popup, props.clientRect);
            },
            onUpdate: props => {
              renderer?.updateProps(props);
              if (popup) position(popup, props.clientRect);
            },
            onKeyDown: props => renderer?.ref?.onKeyDown(props) ?? false,
            onExit: () => {
              popup?.remove();
              popup = null;
              renderer?.destroy();
              renderer = null;
            },
          };
        },
      }),
    ];
  },
});
