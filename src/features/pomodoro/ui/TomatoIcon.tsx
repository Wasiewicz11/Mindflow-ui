interface TomatoIconProps {
  className?: string;
}

export function TomatoIcon({ className = 'h-5 w-5' }: TomatoIconProps) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <path d="M31.7 16.7c-13.2 0-23 8.8-23 20.6 0 12 9.7 20.2 23.3 20.2s23.3-8.2 23.3-20.2c0-11.8-10-20.6-23.6-20.6Z" fill="oklch(0.62 0.18 25)" />
      <path d="M31.8 18.2c-3.2-5.3-1.9-9.6 2-12.7.4 4.1 2.7 6.3 6.8 7.5-2.4 1.6-5 3.3-8.8 5.2Z" fill="oklch(0.50 0.15 145)" />
      <path d="M31.5 17.9c-5.8-3.8-10.7-3.7-14.5-.2 4.7.1 7.4 2.2 9.1 6.4 1.4-2.4 3.2-4.4 5.4-6.2Z" fill="oklch(0.50 0.15 145)" />
      <path d="M32 18c5.7-3.8 10.6-3.7 14.4-.2-4.7.1-7.4 2.2-9.1 6.4-1.4-2.4-3.1-4.4-5.3-6.2Z" fill="oklch(0.50 0.15 145)" />
      <path d="M17.5 34.3c1-5 4.2-8.4 8.2-9.8" stroke="#f7f7f4" strokeWidth="3.2" strokeLinecap="round" opacity=".5" />
    </svg>
  );
}
