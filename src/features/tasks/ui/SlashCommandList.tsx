import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import type { Editor, Range } from '@tiptap/core';

export interface SlashItem {
  title: string;
  subtitle: string;
  keywords: string[];
  command: (props: { editor: Editor; range: Range }) => void;
}

export interface SlashListRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

interface Props {
  items: SlashItem[];
  /** Dostarczane przez @tiptap/suggestion — wybiera komendę. */
  command: (item: SlashItem) => void;
}

/**
 * Lista podpowiedzi slash-command (`/`) w edytorze opisu.
 * Strzałki + Enter sterują wyborem (obsługiwane przez suggestion przez ref).
 */
export const SlashCommandList = forwardRef<SlashListRef, Props>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }) => {
      if (event.key === 'ArrowUp') {
        setSelected(s => (s + items.length - 1) % items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelected(s => (s + 1) % items.length);
        return true;
      }
      if (event.key === 'Enter') {
        const item = items[selected];
        if (item) command(item);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) return null;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: '#fff',
        border: '1px solid #e8e8e4',
        boxShadow: '0 8px 24px -6px rgba(15,17,21,.16)',
        minWidth: 240,
        maxHeight: 280,
        overflowY: 'auto',
        padding: 4,
      }}
    >
      {items.map((item, i) => (
        <button
          key={item.title}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
          className="w-full flex flex-col items-start rounded-[8px] transition-colors text-left"
          style={{
            padding: '7px 10px',
            background: i === selected ? '#f1f0ed' : 'transparent',
          }}
        >
          <span className="text-[13px] font-medium text-[#0f1115]">{item.title}</span>
          <span className="text-[11.5px] text-[#9098a4]">{item.subtitle}</span>
        </button>
      ))}
    </div>
  );
});

SlashCommandList.displayName = 'SlashCommandList';
