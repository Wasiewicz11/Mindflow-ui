import React from 'react';
import { CustomSelect } from '../../../shared/ui/CustomSelect';
import type { AgendaPosition } from './AgendaOverlay';

interface AgendaPositionSelectorProps {
  position: AgendaPosition;
  setPosition: (position: AgendaPosition) => void;
}

const POSITIONS: { id: AgendaPosition; name: string; desc: string; dot: string }[] = [
  { id: 'bottom-right', name: 'Prawy dolny', desc: 'Domyślnie', dot: 'bottom-1 right-1' },
  { id: 'bottom-left', name: 'Lewy dolny', desc: 'Przy nawigacji', dot: 'bottom-1 left-1' },
  { id: 'top-right', name: 'Prawy górny', desc: 'Nad treścią', dot: 'top-1 right-1' },
  { id: 'top-left', name: 'Lewy górny', desc: 'Przy nagłówku', dot: 'top-1 left-1' },
];

export const AgendaPositionSelector: React.FC<AgendaPositionSelectorProps> = ({ position, setPosition }) => {
  const options = POSITIONS.map(p => ({
    id: p.id,
    label: (
      <div className="flex min-w-0 flex-col text-left">
        <span className="truncate font-medium">{p.name}</span>
        <span className="text-[11px] text-[#9098a4]">{p.desc}</span>
      </div>
    ),
    icon: (
      <div className="relative h-9 w-12 rounded-[8px] border border-[#e8e8e4] bg-[#f7f7f4] dark:border-white/10 dark:bg-white/5">
        <span className={`absolute h-1.5 w-1.5 rounded-full bg-[#0f1115] dark:bg-white ${p.dot}`} />
      </div>
    ),
  }));

  return (
    <CustomSelect
      value={position}
      onChange={(val) => setPosition(val as AgendaPosition)}
      options={options}
      dropdownWidth="w-full lg:w-72"
      className="w-full lg:w-72"
    />
  );
};
