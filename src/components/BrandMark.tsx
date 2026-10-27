import React from 'react';

interface BrandMarkProps {
  size?: 'sm' | 'md';
  className?: string;
}

/**
 * Geometric editorial brand emblem with a subtle slow-rotating inner facet.
 * Motion pauses automatically when prefers-reduced-motion is enabled.
 */
export function BrandMark({ size = 'md', className = '' }: BrandMarkProps) {
  const dimensions = size === 'sm'
    ? 'h-8 w-8 rounded-xl'
    : 'h-9 w-9 rounded-xl sm:h-10 sm:w-10 sm:rounded-2xl';
  const iconSize = size === 'sm' ? 'h-4 w-4' : 'h-[1.125rem] w-[1.125rem] sm:h-5 sm:w-5';

  return (
    <span
      className={`relative grid shrink-0 place-items-center bg-brand-dark text-sage shadow-sm ring-1 ring-inset ring-white/10 transition-transform duration-standard ease-emphasized group-hover:-rotate-3 group-hover:scale-[1.03] ${dimensions} ${className}`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className={iconSize}>
        {/* Outer precision frame */}
        <rect
          x="3.75"
          y="3.75"
          width="16.5"
          height="16.5"
          rx="4.25"
          stroke="currentColor"
          strokeOpacity="0.42"
          strokeWidth="1.25"
        />
        {/* Rotating inner geometric compass star */}
        <g className="hub-geo-spin">
          <path
            d="M12 5.4L13.65 10.35L18.6 12L13.65 13.65L12 18.6L10.35 13.65L5.4 12L10.35 10.35L12 5.4Z"
            fill="currentColor"
          />
        </g>
        <circle cx="12" cy="12" r="1.4" fill="rgb(var(--hub-brand-dark-rgb))" />
      </svg>
    </span>
  );
}
