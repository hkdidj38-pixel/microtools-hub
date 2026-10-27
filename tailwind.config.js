/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './scripts/prerender.mjs'],
  theme: {
    extend: {
      colors: {
        paper: 'rgb(var(--hub-paper-rgb) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--hub-surface-rgb) / <alpha-value>)',
          hover: 'rgb(var(--hub-surface-hover-rgb) / <alpha-value>)',
        },
        line: 'rgb(var(--hub-line-rgb) / <alpha-value>)',
        ink: 'rgb(var(--hub-ink-rgb) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--hub-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--hub-muted-subtle-rgb) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--hub-brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--hub-brand-dark-rgb) / <alpha-value>)',
          soft: 'rgb(var(--hub-brand-soft-rgb) / <alpha-value>)',
        },
        pink: {
          accent: 'rgb(var(--hub-pink-rgb) / <alpha-value>)',
        },
        success: 'rgb(var(--hub-success-rgb) / <alpha-value>)',
        lime: 'rgb(var(--hub-lime-rgb) / <alpha-value>)',
      },
      boxShadow: {
        soft: 'var(--hub-shadow-soft)',
        lift: 'var(--hub-shadow-lift)',
        panel: 'var(--hub-shadow-panel)',
      },
      borderRadius: {
        'hub-input': 'var(--hub-radius-input)',
        'hub-control': 'var(--hub-radius-control)',
        'hub-card': 'var(--hub-radius-card)',
        'hub-panel': 'var(--hub-radius-panel)',
      },
      fontSize: {
        'hub-display': ['var(--hub-type-display)', { lineHeight: '1.06', letterSpacing: '-0.03em' }],
        'hub-section': ['var(--hub-type-section)', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        'hub-page': ['var(--hub-type-page)', { lineHeight: '1.12', letterSpacing: '-0.025em' }],
      },
      fontFamily: {
        heading: ['"Geist"', '"Geist Sans"', '"Inter Tight"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"Geist"', '"Geist Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      spacing: {
        'hub-gutter': 'var(--hub-gutter)',
      },
      transitionDuration: {
        fast: 'var(--hub-motion-fast)',
        standard: 'var(--hub-motion-standard)',
        reveal: 'var(--hub-motion-reveal)',
      },
      transitionTimingFunction: {
        standard: 'var(--hub-ease-standard)',
        emphasized: 'var(--hub-ease-emphasized)',
      },
      keyframes: {
        'hub-enter': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hub-card-enter': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hub-menu-in': {
          from: { opacity: '0', transform: 'scale(0.98) translateY(-4px)' },
          to: { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
      },
      animation: {
        'hub-enter': 'hub-enter var(--hub-motion-reveal) var(--hub-ease-emphasized) both',
        'hub-card-enter': 'hub-card-enter var(--hub-motion-reveal) var(--hub-ease-emphasized) backwards',
        'hub-menu-in': 'hub-menu-in var(--hub-motion-fast) var(--hub-ease-standard) both',
      },
    },
  },
  plugins: [],
};
