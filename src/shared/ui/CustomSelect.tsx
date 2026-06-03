import React, { useState, useRef, useEffect } from 'react';

export interface SelectOption {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  dropdownWidth?: string;
  itemHeight?: number;
  dropdownPadding?: number;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({
  value,
  onChange,
  options,
  dropdownWidth = 'w-56',
  itemHeight = 40,
  dropdownPadding = 6,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectedIndex = options.findIndex(o => o.id === value);
  const selectedOption = options[selectedIndex] || options[0];

  const offsetTop = -dropdownPadding - (selectedIndex * itemHeight) - 2;

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className={`w-full flex items-center gap-3 rounded-[14px] border border-[#e8e8e4] bg-[#fdfdfd] px-3.5 text-sm text-[#3a3f47] shadow-[0_4px_14px_-10px_rgba(15,17,21,.2)] transition-[border-color,background-color,color,box-shadow,transform] duration-200 ease hover:-translate-y-px hover:bg-[#f7f7f4] hover:text-[#0f1115] focus:outline-none focus:ring-2 focus:ring-[#d9d9d3] focus:ring-offset-2 focus:ring-offset-white dark:border-white/10 dark:bg-[#27272A] dark:text-gray-200 dark:shadow-none dark:hover:bg-[#323238] dark:hover:text-white dark:focus:ring-white/15 dark:focus:ring-offset-[#1C1C1E] ${isOpen ? 'border-[#d9d9d3] bg-[#f7f7f4] text-[#0f1115] dark:border-white/15 dark:bg-[#323238] dark:text-white' : ''}`}
        style={{ height: `${itemHeight}px` }}
      >
        {selectedOption?.icon && (
          <div className="flex-shrink-0">{selectedOption.icon}</div>
        )}
        <span className="min-w-0 flex-1 truncate text-left">{selectedOption?.label}</span>
        <svg className={`ml-auto h-4 w-4 flex-shrink-0 text-[#9098a4] transition-transform duration-200 ease dark:text-gray-400 ${isOpen ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <div
        className={`absolute right-0 z-[100] overflow-hidden rounded-[16px] border border-[#e8e8e4] bg-white shadow-[0_8px_24px_-6px_rgba(15,17,21,.16)] transition-[opacity,transform] duration-200 ease dark:border-white/10 dark:bg-[#27272A] dark:shadow-none ${dropdownWidth} ${isOpen ? 'translate-y-0 scale-100 opacity-100' : 'pointer-events-none -translate-y-1.5 scale-[0.97] opacity-0'}`}
        style={{ top: `${offsetTop}px`, padding: `${dropdownPadding}px` }}
      >
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => {
              onChange(option.id);
              setIsOpen(false);
            }}
            className={`w-full rounded-xl px-3 text-sm transition-[background-color,color,transform] duration-200 ease ${
              value === option.id
                ? 'bg-[#f1f0ed] text-[#0f1115] dark:bg-[#3F3F46] dark:text-white'
                : 'text-[#5a606b] hover:bg-[#f7f7f4] hover:text-[#0f1115] dark:text-gray-300 dark:hover:bg-[#323238] dark:hover:text-white'
            }`}
            style={{ height: `${itemHeight}px` }}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                {option.icon && (
                  <div className="flex-shrink-0">{option.icon}</div>
                )}
                <div className="min-w-0 truncate text-left">{option.label}</div>
              </div>
              {value === option.id && (
                <svg className="ml-2 h-4 w-4 flex-shrink-0 text-[#0f1115] dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
