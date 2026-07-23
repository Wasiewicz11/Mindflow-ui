import { useMemo, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Clock, X } from 'lucide-react';

type TimePickerSize = 'regular' | 'compact';

interface Props {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  clearable?: boolean;
  readOnly?: boolean;
  minMinutes?: number;
  maxMinutes?: number;
  stepMinutes?: number;
  size?: TimePickerSize;
}

function formatTime(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(normalized / 60)).padStart(2, '0');
  const minutes = String(normalized % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function buildTimeOptions(minMinutes: number, maxMinutes: number, stepMinutes: number) {
  const options: string[] = [];
  for (let minutes = minMinutes; minutes <= maxMinutes; minutes += stepMinutes) {
    options.push(formatTime(minutes));
  }
  return options;
}

function getPickerStyle(rect: DOMRect): CSSProperties {
  if (typeof window === 'undefined') {
    return { top: rect.bottom + 6, left: rect.left, width: rect.width };
  }

  const menuWidth = Math.max(240, rect.width);
  const menuHeight = 262;
  const openAbove = rect.bottom + menuHeight + 12 > window.innerHeight && rect.top > menuHeight;
  const top = openAbove ? rect.top - menuHeight - 6 : rect.bottom + 6;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - menuWidth - 12));

  return { top, left, width: menuWidth, maxHeight: menuHeight };
}

export function TimePickerField({
  label,
  value,
  onChange,
  onClear,
  clearable = true,
  readOnly = false,
  minMinutes = 0,
  maxMinutes = 23 * 60 + 45,
  stepMinutes = 15,
  size = 'regular',
}: Props) {
  const [pickerRect, setPickerRect] = useState<DOMRect | null>(null);
  const options = useMemo(
    () => buildTimeOptions(minMinutes, maxMinutes, stepMinutes),
    [maxMinutes, minMinutes, stepMinutes],
  );
  const isCompact = size === 'compact';

  const labelClass = isCompact
    ? 'text-[10.5px] font-medium text-[#9098a4]'
    : 'text-[12px] font-medium text-[#9098a4]';
  const controlClass = isCompact
    ? 'mt-1 h-[31px] rounded-[6px] px-2 text-[12px]'
    : 'h-10 rounded-lg px-3 text-[13px]';

  function openPicker(rect: DOMRect) {
    if (readOnly) return;
    setPickerRect(current => current ? null : rect);
  }

  function clearValue() {
    onClear?.();
    onChange('');
    setPickerRect(null);
  }

  function selectValue(nextValue: string) {
    onChange(nextValue);
    setPickerRect(null);
  }

  return (
    <div className="grid gap-1.5">
      <span className={labelClass}>{label}</span>
      <div
        className={`${controlClass} flex items-center gap-2 border border-[#e8e8e4] bg-[#f7f7f4] text-[#0f1115] transition-colors duration-200 ease dark:border-white/10 dark:bg-[#232326] dark:text-white ${
          readOnly ? 'cursor-default text-[#5a606b]' : 'hover:bg-[#f1f0ed] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#0f1115]/20'
        }`}
      >
        <button
          type="button"
          disabled={readOnly}
          aria-expanded={Boolean(pickerRect)}
          onClick={event => openPicker(event.currentTarget.getBoundingClientRect())}
          className="flex min-w-0 flex-1 items-center gap-2 text-left font-medium outline-none disabled:cursor-default"
        >
          <Clock size={isCompact ? 12 : 14} className="flex-none text-[#9098a4]" />
          <span className={`min-w-0 flex-1 truncate ${value ? 'text-[#0f1115] dark:text-white' : 'text-[#b0b5be]'}`}>
            {value || '--:--'}
          </span>
        </button>
        {clearable && value && !readOnly && (
          <button
            type="button"
            title="Wyczyść"
            onClick={clearValue}
            className="flex h-5 w-5 flex-none items-center justify-center rounded-md text-[#b0b5be] transition-colors hover:bg-[#e8e8e4] hover:text-[#0f1115] dark:hover:bg-white/10 dark:hover:text-white"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {pickerRect && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[90]" onClick={() => setPickerRect(null)} />
          <div
            className="fixed z-[91] overflow-hidden rounded-xl border border-[#e8e8e4] bg-white shadow-[0_16px_36px_-12px_rgba(15,17,21,.25)] dark:border-white/10 dark:bg-[#2D2D31]"
            style={getPickerStyle(pickerRect)}
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#f1f0ed] px-3 py-2 dark:border-white/8">
              <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9098a4]">
                {label}
              </span>
              {clearable && value && (
                <button
                  type="button"
                  onClick={clearValue}
                  className="rounded-md px-1.5 py-1 text-[11.5px] font-medium text-[#9098a4] transition-colors hover:bg-[#f7f7f4] hover:text-[#0f1115] dark:hover:bg-white/8 dark:hover:text-white"
                >
                  Wyczyść
                </button>
              )}
            </div>
            <div className="grid max-h-[218px] grid-cols-4 gap-1 overflow-y-auto p-2 custom-scrollbar">
              {options.map(option => {
                const active = option === value;

                return (
                  <button
                    key={option}
                    type="button"
                    onClick={() => selectValue(option)}
                    className={`h-8 rounded-lg text-[12.5px] font-semibold transition-colors duration-150 ease focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#0f1115] ${
                      active
                        ? 'bg-[#0f1115] text-white dark:bg-[#f7f7f4] dark:text-[#18181B]'
                        : 'text-[#0f1115] hover:bg-[#f1f0ed] dark:text-white dark:hover:bg-white/8'
                    }`}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </div>
        </>,
        document.body,
      )}
    </div>
  );
}
