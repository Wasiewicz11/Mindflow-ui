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
        onClick={() => setIsOpen(true)}
        className={`w-full flex items-center gap-2.5 px-3 bg-white dark:bg-[#27272A] hover:bg-gray-50 dark:hover:bg-[#3F3F46] border border-gray-200 dark:border-white/10 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors ${isOpen ? 'opacity-0' : 'opacity-100'}`}
        style={{ height: `${itemHeight}px` }}
      >
        {selectedOption?.icon && (
          <div className="flex-shrink-0">{selectedOption.icon}</div>
        )}
        <span className="truncate">{selectedOption?.label}</span>
        <svg className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`absolute right-0 ${dropdownWidth} bg-white dark:bg-[#27272A] border border-gray-100 dark:border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden animate-fade-in`}
          style={{ top: `${offsetTop}px`, padding: `${dropdownPadding}px` }}
        >
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => {
                onChange(option.id);
                setIsOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3 text-sm rounded-lg transition-colors ${
                value === option.id
                  ? 'bg-gray-100 dark:bg-[#3F3F46] text-gray-900 dark:text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#3F3F46]/50'
              }`}
              style={{ height: `${itemHeight}px` }}
            >
              <div className="flex items-center gap-3 truncate">
                {option.icon && (
                  <div className="flex-shrink-0">{option.icon}</div>
                )}
                <span className="font-medium truncate">{option.label}</span>
              </div>
              {value === option.id && (
                <svg className="w-4 h-4 text-gray-900 dark:text-gray-400 flex-shrink-0 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
