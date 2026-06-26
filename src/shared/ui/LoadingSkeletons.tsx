import type { ReactNode } from 'react';

function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-md bg-[#f1f0ed] dark:bg-white/10 ${className}`}
    />
  );
}

function SkeletonCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none ${className}`}>
      {children}
    </div>
  );
}

function SkeletonTaskCard() {
  return (
    <SkeletonCard className="rounded-xl p-3">
      <div className="mb-3 flex items-center gap-2">
        <SkeletonBlock className="h-5 w-10" />
        <SkeletonBlock className="h-5 w-24" />
      </div>
      <SkeletonBlock className="h-4 w-11/12" />
      <SkeletonBlock className="mt-2 h-3 w-1/2" />
    </SkeletonCard>
  );
}

export function AppHeaderSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className={compact ? 'space-y-2' : 'space-y-3'}>
      <SkeletonBlock className={compact ? 'h-6 w-48' : 'h-8 w-64'} />
      <SkeletonBlock className="h-4 w-56" />
    </div>
  );
}

export function SidebarSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie nawigacji" className="space-y-4 px-3">
      <div className="space-y-2">
        {[0, 1, 2].map(item => (
          <div key={item} className="flex items-center gap-2 rounded-lg px-2 py-1.5">
            <SkeletonBlock className="h-4 w-4 rounded-full" />
            <SkeletonBlock className={`h-3 ${item === 1 ? 'w-28' : 'w-20'}`} />
          </div>
        ))}
      </div>

      <div className="pt-2">
        <SkeletonBlock className="mb-3 h-3 w-20" />
        <div className="space-y-3">
          {[0, 1, 2].map(space => (
            <div key={space} className="space-y-2">
              <div className="flex items-center gap-2 px-2">
                <SkeletonBlock className="h-3 w-3 rounded-full" />
                <SkeletonBlock className={`h-4 ${space === 1 ? 'w-28' : 'w-24'}`} />
              </div>
              <div className="ml-5 space-y-2">
                <SkeletonBlock className="h-7 w-full rounded-lg" />
                <SkeletonBlock className="h-7 w-4/5 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function MobileTasksNavSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie projektow" className="lg:hidden mb-4 flex items-center gap-2 overflow-hidden">
      <SkeletonBlock className="h-8 w-28 flex-none rounded-full" />
      <SkeletonBlock className="h-8 w-24 flex-none rounded-full" />
      <SkeletonBlock className="h-8 w-32 flex-none rounded-full" />
      <SkeletonBlock className="h-8 w-20 flex-none rounded-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie centrum" className="space-y-8">
      <SkeletonCard className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <SkeletonBlock className="h-4 w-32" />
          <SkeletonBlock className="h-9 w-28 rounded-xl" />
        </div>
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-full" />
          <SkeletonBlock className="h-3 w-5/6" />
        </div>
      </SkeletonCard>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map(item => (
          <SkeletonCard key={item} className="p-5">
            <SkeletonBlock className="mb-4 h-3 w-24" />
            <SkeletonBlock className="h-8 w-16" />
          </SkeletonCard>
        ))}
      </div>

      <div className="space-y-3">
        <SkeletonBlock className="h-4 w-36" />
        {[0, 1, 2].map(item => (
          <SkeletonTaskCard key={item} />
        ))}
      </div>
    </div>
  );
}

export function NotesSkeleton({ compact = false }: { compact?: boolean }) {
  const count = compact ? 4 : 8;
  return (
    <div role="status" aria-label="Ladowanie notatek" className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-6 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, item) => (
        <SkeletonCard key={item} className="h-[180px] rounded-xl p-4 md:h-[200px]">
          <SkeletonBlock className="h-4 w-3/4" />
          <div className="mt-5 space-y-2">
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-full" />
            <SkeletonBlock className="h-3 w-2/3" />
          </div>
          <div className="mt-8 flex items-center justify-between border-t border-[#f1f0ed] pt-3 dark:border-white/8">
            <SkeletonBlock className="h-4 w-12" />
            <SkeletonBlock className="h-3 w-10" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function TaskListSkeleton({ rows = 5, compact = false }: { rows?: number; compact?: boolean }) {
  return (
    <div role="status" aria-label="Ladowanie listy zadan" className="space-y-3 pt-2">
      {Array.from({ length: rows }).map((_, item) => (
        <SkeletonCard key={item} className={`rounded-xl ${compact ? 'p-3' : 'p-4'}`}>
          <div className="flex items-center gap-3">
            <SkeletonBlock className="h-5 w-5 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <SkeletonBlock className={`h-4 ${item % 3 === 0 ? 'w-3/4' : 'w-11/12'}`} />
              {!compact && <SkeletonBlock className="h-3 w-1/3" />}
            </div>
            <SkeletonBlock className="h-6 w-16 rounded-lg" />
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function WeekViewSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie widoku tygodnia" className="flex h-full flex-col">
      <div className="flex-none px-4 pb-3">
        <SkeletonBlock className="h-8 w-[240px] rounded-lg" />
      </div>
      <div className="flex min-w-max flex-1 gap-4 overflow-hidden px-4 lg:gap-8 lg:px-2">
        {['Bez terminu', 'Dzisiaj', 'Jutro', 'Tydzien', 'Pozniej'].map((label, columnIndex) => (
          <section key={label} className="w-[280px] flex-none lg:w-72">
            <div className="mb-4 px-2">
              <SkeletonBlock className="h-4 w-28" />
              <SkeletonBlock className="mt-2 h-3 w-16" />
            </div>
            <div className="space-y-2 px-1">
              {Array.from({ length: columnIndex === 0 ? 3 : 2 }).map((_, item) => (
                <SkeletonTaskCard key={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function BoardViewSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="status" aria-label="Ladowanie tablicy" className="flex h-full min-h-0 flex-col">
      <div className="flex-none px-[18px] pb-3">
        <SkeletonBlock className="h-8 w-[240px] rounded-lg" />
      </div>
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div className="mx-auto flex h-full min-w-min">
          {Array.from({ length: columns }).map((_, column) => (
            <section
              key={column}
              className="flex h-full min-h-0 w-[288px] flex-none flex-col px-[18px]"
              style={{ borderLeft: column === 0 ? 'none' : '1px solid #ececec' }}
            >
              <SkeletonBlock className="mt-3 h-0.5 w-full rounded-sm" />
              <div className="flex items-center gap-2 py-4">
                <SkeletonBlock className="h-6 w-28 rounded-md" />
                <SkeletonBlock className="h-4 w-5" />
              </div>
              <div className="space-y-2">
                {Array.from({ length: column === 1 ? 3 : 2 }).map((_, item) => (
                  <SkeletonTaskCard key={item} />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CalendarSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie kalendarza" className="flex h-full min-h-0 gap-4">
      <section className="flex min-w-0 flex-1 flex-col gap-4">
        <div className="flex flex-none flex-wrap items-center justify-between gap-3">
          <AppHeaderSkeleton compact />
          <div className="flex items-center gap-2">
            <SkeletonBlock className="h-10 w-16 rounded-lg" />
            <SkeletonBlock className="h-10 w-20 rounded-lg" />
            <SkeletonBlock className="h-10 w-28 rounded-lg" />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-sm dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
          <div className="grid grid-cols-[56px_repeat(5,minmax(120px,1fr))] border-b border-[#f1f0ed] dark:border-white/8">
            <div />
            {Array.from({ length: 5 }).map((_, day) => (
              <div key={day} className="border-l border-[#f1f0ed] p-3 dark:border-white/8">
                <SkeletonBlock className="h-4 w-20" />
              </div>
            ))}
          </div>
          <div className="grid h-full grid-cols-[56px_repeat(5,minmax(120px,1fr))]">
            <div className="space-y-10 p-3">
              {Array.from({ length: 8 }).map((_, hour) => (
                <SkeletonBlock key={hour} className="h-3 w-7" />
              ))}
            </div>
            {Array.from({ length: 5 }).map((_, day) => (
              <div key={day} className="relative border-l border-[#f1f0ed] p-2 dark:border-white/8">
                <div className="space-y-10">
                  {Array.from({ length: 8 }).map((_, row) => (
                    <SkeletonBlock key={row} className="h-px w-full rounded-none" />
                  ))}
                </div>
                <SkeletonBlock className={`absolute left-3 right-3 h-16 rounded-xl ${day % 2 === 0 ? 'top-24' : 'top-44'}`} />
                {day === 2 && <SkeletonBlock className="absolute left-3 right-3 top-72 h-20 rounded-xl" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <aside className="hidden w-[330px] shrink-0 rounded-[18px] border border-[#e8e8e4] bg-white p-4 shadow-sm lg:block dark:border-white/10 dark:bg-[#27272A] dark:shadow-none">
        <SkeletonBlock className="h-4 w-40" />
        <SkeletonBlock className="mt-4 h-9 w-full rounded-lg" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2, 3].map(item => (
            <SkeletonTaskCard key={item} />
          ))}
        </div>
      </aside>
    </div>
  );
}

export function SettingsSkeleton({ framed = true }: { framed?: boolean }) {
  const content = (
    <>
      <div className="border-b border-[#f1f0ed] px-6 py-5 dark:border-white/6">
        <SkeletonBlock className="h-3 w-32" />
        <SkeletonBlock className="mt-3 h-7 w-52" />
        <SkeletonBlock className="mt-3 h-4 w-4/5" />
      </div>
      <div className="divide-y divide-[#f1f0ed] dark:divide-white/6">
        {[0, 1, 2, 3].map(item => (
          <section key={item} className="px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                {item === 0 && <SkeletonBlock className="h-14 w-14 flex-none rounded-full" />}
                <div className="min-w-0 flex-1 space-y-2">
                  <SkeletonBlock className="h-3 w-24" />
                  <SkeletonBlock className="h-5 w-44" />
                  <SkeletonBlock className="h-4 w-64 max-w-full" />
                </div>
              </div>
              <SkeletonBlock className="h-11 w-36 rounded-xl" />
            </div>
          </section>
        ))}
      </div>
    </>
  );

  if (!framed) {
    return (
      <div role="status" aria-label="Ladowanie ustawien">
        {content}
      </div>
    );
  }

  return (
    <div role="status" aria-label="Ladowanie ustawien" className="overflow-hidden rounded-[18px] border border-[#e8e8e4] bg-white shadow-[0_8px_24px_-6px_rgba(15,17,21,.08)] dark:border-white/8 dark:bg-[#1C1C1E] dark:shadow-none">
      {content}
    </div>
  );
}

export function GoogleCalendarSettingsSkeleton() {
  return (
    <div role="status" aria-label="Ladowanie integracji Google Calendar" className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="max-w-md space-y-2">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-5 w-44" />
        <SkeletonBlock className="h-4 w-full" />
        <SkeletonBlock className="h-4 w-5/6" />
      </div>
      <div className="flex flex-col items-stretch gap-2 sm:items-end">
        <SkeletonBlock className="h-16 w-[300px] max-w-full rounded-xl" />
        <div className="flex gap-2">
          <SkeletonBlock className="h-10 w-32 rounded-xl" />
          <SkeletonBlock className="h-10 w-24 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export { SkeletonBlock };
