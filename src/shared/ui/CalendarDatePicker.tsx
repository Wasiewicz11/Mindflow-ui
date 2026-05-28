import { useState } from 'react';

interface Props {
  value: string;
  onChange: (date: string) => void;
  onClose: () => void;
}

const MONTHS = ['Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec','Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień'];
const DAYS = ['Pn','Wt','Śr','Cz','Pt','So','Nd'];

function toYMD(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarDatePicker({ value, onChange, onClose }: Props) {
  const today = new Date();
  const initial = value ? new Date(value + 'T00:00:00') : today;

  const [view, setView] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const year = view.getFullYear();
  const month = view.getMonth();

  const firstDayOfWeek = (() => {
    const d = new Date(year, month, 1).getDay();
    return d === 0 ? 6 : d - 1;
  })();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const todayYMD = toYMD(today);
  const tomorrowYMD = toYMD(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));

  function prevMonth() {
    setView(new Date(year, month - 1, 1));
  }

  function nextMonth() {
    setView(new Date(year, month + 1, 1));
  }

  function selectDay(day: number) {
    const selected = toYMD(new Date(year, month, day));
    onChange(selected);
    onClose();
  }

  function selectQuick(ymd: string) {
    onChange(ymd);
    onClose();
  }

  function clearDate() {
    onChange('');
    onClose();
  }

  const cells: (number | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden select-none w-full"
      style={{
        background: '#f7f7f4',
        border: '1px solid #e8e8e4',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* Quick actions */}
      <div className="flex gap-1.5 px-3 pt-3 pb-2">
        <button
          onClick={() => selectQuick(todayYMD)}
          className="flex-1 text-[12px] font-medium rounded-lg transition-colors"
          style={{
            padding: '5px 0',
            background: value === todayYMD ? '#0f1115' : '#f1f0ed',
            color: value === todayYMD ? '#fff' : '#3a3f47',
          }}
        >
          Dziś
        </button>
        <button
          onClick={() => selectQuick(tomorrowYMD)}
          className="flex-1 text-[12px] font-medium rounded-lg transition-colors"
          style={{
            padding: '5px 0',
            background: value === tomorrowYMD ? '#0f1115' : '#f1f0ed',
            color: value === tomorrowYMD ? '#fff' : '#3a3f47',
          }}
        >
          Jutro
        </button>
        <button
          onClick={clearDate}
          className="flex-1 text-[12px] font-medium rounded-lg transition-colors"
          style={{ padding: '5px 0', background: '#f1f0ed', color: '#9098a4' }}
        >
          Wyczyść
        </button>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#f1f0ed', margin: '0 12px' }} />

      {/* Month header */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center rounded-lg transition-colors hover:bg-[#f1f0ed]"
          style={{ width: 26, height: 26 }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-[13px] font-semibold text-[#0f1115]">
          {MONTHS[month]} {year}
        </span>
        <button
          onClick={nextMonth}
          className="flex items-center justify-center rounded-lg transition-colors hover:bg-[#f1f0ed]"
          style={{ width: 26, height: 26 }}
        >
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 px-3 pb-1">
        {DAYS.map(d => (
          <div key={d} className="text-center text-[10.5px] font-medium text-[#b0b5be]" style={{ paddingBottom: 4 }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 px-3 pb-3 gap-y-0.5">
        {cells.map((day, i) => {
          if (!day) return <div key={`e-${i}`} />;

          const ymd = toYMD(new Date(year, month, day));
          const isSelected = ymd === value;
          const isToday = ymd === todayYMD;
          const isPast = ymd < todayYMD;

          return (
            <button
              key={ymd}
              onClick={() => selectDay(day)}
              className="flex items-center justify-center rounded-lg text-[12.5px] font-medium transition-all"
              style={{
                height: 30,
                background: isSelected ? '#0f1115' : 'transparent',
                color: isSelected ? '#fff' : isToday ? '#0f1115' : isPast ? '#c0c5cc' : '#3a3f47',
                fontWeight: isSelected || isToday ? 650 : 400,
                outline: isToday && !isSelected ? '1.5px solid #d4d4d0' : 'none',
                outlineOffset: -1,
              }}
              onMouseEnter={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = '#f1f0ed'; }}
              onMouseLeave={e => { if (!isSelected) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
