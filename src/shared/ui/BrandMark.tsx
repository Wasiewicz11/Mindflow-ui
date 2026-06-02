interface BrandMarkProps {
  alt?: string;
  className?: string;
  markClassName?: string;
}

export function BrandMark({ alt = '', className = '', markClassName = 'h-5 w-5' }: BrandMarkProps) {
  return (
    <span className={`inline-flex items-center justify-center ${className}`} aria-hidden={alt ? undefined : true}>
      <img src="/mindle_mark_black.svg" alt={alt} className={`block dark:hidden ${markClassName}`} />
      <img src="/mindle_mark_white.svg" alt="" aria-hidden="true" className={`hidden dark:block ${markClassName}`} />
    </span>
  );
}
