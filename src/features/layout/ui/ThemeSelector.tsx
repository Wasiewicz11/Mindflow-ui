import React from 'react';
import { CustomSelect } from '../../../shared/ui/CustomSelect';

interface ThemeSelectorProps {
  theme: 'light' | 'dark' | 'gray' | 'system';
  setTheme: (theme: 'light' | 'dark' | 'gray' | 'system') => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ theme, setTheme }) => {
  const themes = [
    { id: 'system', name: 'Systemowy', iconBg: 'bg-linear-to-r from-[#f7f7f4] to-[#27272A]', iconDot: 'bg-[#0f1115]', iconText: 'text-white', iconBorder: 'border-[#d9d9d3]' },
    { id: 'light', name: 'Jasny', iconBg: 'bg-white', iconDot: 'bg-[#0f1115]', iconText: 'text-gray-900', iconBorder: 'border-gray-200' },
    { id: 'dark', name: 'Ciemny', iconBg: 'bg-[#0f1115]', iconDot: 'bg-[#f7f7f4]', iconText: 'text-white', iconBorder: 'border-[#3a3f47]' },
    { id: 'gray', name: 'Szary', iconBg: 'bg-[#27272A]', iconDot: 'bg-[#d4d4d8]', iconText: 'text-white', iconBorder: 'border-[#52525B]' },
  ];

  const options = themes.map(t => ({
    id: t.id,
    label: (
      <div className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium">{t.name}</span>
        <span className="text-[11px] text-[#9098a4]">{t.id === 'system' ? 'Dopasowany do urządzenia' : 'Stały wariant aplikacji'}</span>
      </div>
    ),
    icon: (
      <div className={`flex h-9 w-12 items-center justify-center gap-1.5 rounded-[10px] border ${t.iconBorder} ${t.iconBg}`}>
        <div className={`h-1.5 w-1.5 rounded-full ${t.iconDot}`}></div>
        <span className={`text-[11px] font-medium leading-none ${t.iconText}`}>Aa</span>
      </div>
    )
  }));

  return (
    <CustomSelect
      value={theme}
      onChange={(val) => setTheme(val as 'light' | 'dark' | 'gray' | 'system')}
      options={options}
      dropdownWidth="w-full lg:w-72"
      className="w-full lg:w-72"
    />
  );
};
