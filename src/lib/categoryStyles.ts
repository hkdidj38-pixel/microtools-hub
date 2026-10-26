import {
  FileImage,
  FileStack,
  Film,
  Globe2,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';

export interface CategoryAccent {
  /** Icon container background + text color classes */
  iconSurface: string;
  /** Subtle hover shift for icon container */
  iconHover: string;
  /** Category pill classes */
  badge: string;
  /** CSS color string used for top-border reveal on hover */
  borderAccent: string;
  /** Soft dot color class */
  dot: string;
}

const DEFAULT_ACCENT: CategoryAccent = {
  iconSurface: 'bg-sage text-sage-ink border border-brand/15',
  iconHover: 'group-hover:bg-brand-dark group-hover:text-white group-hover:border-brand-dark',
  badge: 'bg-sage/85 text-sage-ink border-brand/15',
  borderAccent: 'rgb(var(--hub-brand-rgb))',
  dot: 'bg-brand',
};

const CATEGORY_ACCENTS: Record<string, CategoryAccent> = {
  Images: {
    iconSurface: 'bg-sage text-sage-ink border border-brand/15',
    iconHover: 'group-hover:bg-brand-dark group-hover:text-white group-hover:border-brand-dark',
    badge: 'bg-sage/85 text-sage-ink border-brand/15',
    borderAccent: 'rgb(var(--hub-brand-rgb))',
    dot: 'bg-brand',
  },
  PDF: {
    iconSurface: 'bg-peach text-peach-ink border border-peach-ink/15',
    iconHover: 'group-hover:bg-peach-ink group-hover:text-white group-hover:border-peach-ink',
    badge: 'bg-peach/90 text-peach-ink border-peach-ink/15',
    borderAccent: 'rgb(var(--hub-peach-ink-rgb))',
    dot: 'bg-peach-ink',
  },
  Media: {
    iconSurface: 'bg-lavender text-lavender-ink border border-lavender-ink/15',
    iconHover: 'group-hover:bg-lavender-ink group-hover:text-white group-hover:border-lavender-ink',
    badge: 'bg-lavender/90 text-lavender-ink border-lavender-ink/15',
    borderAccent: 'rgb(var(--hub-lavender-ink-rgb))',
    dot: 'bg-lavender-ink',
  },
  Developer: {
    iconSurface: 'bg-blue-gray text-blue-gray-ink border border-blue-gray-ink/15',
    iconHover: 'group-hover:bg-blue-gray-ink group-hover:text-white group-hover:border-blue-gray-ink',
    badge: 'bg-blue-gray/90 text-blue-gray-ink border-blue-gray-ink/15',
    borderAccent: 'rgb(var(--hub-blue-gray-ink-rgb))',
    dot: 'bg-blue-gray-ink',
  },
};

export const TOOL_ICONS: Record<string, LucideIcon> = {
  'image-compressor': FileImage,
  'pdf-merger': FileStack,
  'url-screenshot': Globe2,
  'media-converter': Film,
};

export function getCategoryAccent(category: string): CategoryAccent {
  return CATEGORY_ACCENTS[category] ?? DEFAULT_ACCENT;
}

export function getToolIcon(slug: string): LucideIcon {
  return TOOL_ICONS[slug] ?? Sparkles;
}
