import React from 'react';
import { CustomSelect } from './CustomSelect';

interface ThemeSelectorProps {
  theme: 'light' | 'dark' | 'gray';
  setTheme: (theme: 'light' | 'dark' | 'gray') => void;
}

export const ThemeSelector: React.FC<ThemeSelectorProps> = ({ theme, setTheme }) => {
  const themes = [
    { id: 'light', name: 'Jasny', iconBg: 'bg-white', iconDot: 'bg-[#6366F1]', iconText: 'text-gray-900', iconBorder: 'border-gray-200' },
    { id: 'dark', name: 'Ciemny', iconBg: 'bg-[#18181B]', iconDot: 'bg-[#6366F1]', iconText: 'text-white', iconBorder: 'border-gray-700' },
    { id: 'gray', name: 'Szary', iconBg: 'bg-[#27272A]', iconDot: 'bg-[#6366F1]', iconText: 'text-white', iconBorder: 'border-gray-600' },
  ];

  const options = themes.map(t => ({
    id: t.id,
    label: t.name,
    icon: (
      <div className={`flex items-center justify-center gap-1.5 px-2 py-1 rounded-md border ${t.iconBorder} ${t.iconBg}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${t.iconDot}`}></div>
        <span className={`text-[11px] font-medium leading-none ${t.iconText}`}>Aa</span>
      </div>
    )
  }));

  return (
    <CustomSelect
      value={theme}
      onChange={(val) => setTheme(val as 'light' | 'dark' | 'gray')}
      options={options}
      dropdownWidth="w-48"
      className="w-48"
    />
  );
};
