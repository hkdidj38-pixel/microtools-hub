/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}', './scripts/prerender.mjs'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--hub-ink-rgb) / <alpha-value>)',
        muted: {
          DEFAULT: 'rgb(var(--hub-muted-rgb) / <alpha-value>)',
          subtle: 'rgb(var(--hub-muted-subtle-rgb) / <alpha-value>)',
        },
        paper: 'rgb(var(--hub-paper-rgb) / <alpha-value>)',
        line: 'rgb(var(--hub-line-rgb) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--hub-brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--hub-brand-dark-rgb) / <alpha-value>)',
          soft: 'rgb(var(--hub-brand-soft-rgb) / <alpha-value>)',
        },
        sage: {
          DEFAULT: 'rgb(var(--hub-sage-rgb) / <alpha-value>)',
          ink: 'rgb(var(--hub-sage-ink-rgb) / <alpha-value>)',
        },
        lavender: {
          DEFAULT: 'rgb(var(--hub-lavender-rgb) / <alpha-value>)',
          ink: 'rgb(var(--hub-lavender-ink-rgb) / <alpha-value>)',
        },
        peach: {
          DEFAULT: 'rgb(var(--hub-peach-rgb) / <alpha-value>)',
          ink: 'rgb(var(--hub-peach-ink-rgb) / <alpha-value>)',
        },
        'blue-gray': {
          DEFAULT: 'rgb(var(--hub-blue-gray-rgb) / <alpha-value>)',
          ink: 'rgb(var(--hub-blue-gray-ink-rgb) / <alpha-value>)',
        },
        lime: 'rgb(var(--hub-lime-rgb) / <alpha-value>)',
      },
      boxShadow: {
        soft: 'var(--hub-shadow-soft)',
        lift: 'var(--hub-shadow-lift)',
        panel: 'var(--hub-shadow-panel)',
      },
      borderRadius: {
        'hub-control': 'var(--hub-radius-control)',
        'hub-card': 'var(--hub-radius-card)',
        'hub-panel': 'var(--hub-radius-panel)',
        '4xl': '2rem',
      },
      fontSize: {
        'hub-display': ['var(--hub-type-display)', { lineHeight: '1.03', letterSpacing: '-0.04em' }],
        'hub-section': ['var(--hub-type-section)', { lineHeight: '1.12', letterSpacing: '-0.032em' }],
        'hub-page': ['var(--hub-type-page)', { lineHeight: '1.08', letterSpacing: '-0.04em' }],
      },
      fontFamily: {
        sans: ['"DM Sans"', 'Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        serif: ['"Playfair Display"', '"Iowan Old Style"', '"Palatino Linotype"', '"Book Antiqua"', 'Georgia', 'Cambria', '"Times New Roman"', 'Times', 'serif'],
        mono: ['"DM Mono"', '"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', 'monospace'],
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
          from: { opacity: '0', transform: 'translateY(0.65rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hub-card-enter': {
          from: { opacity: '0', transform: 'translateY(0.55rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hub-menu-in': {
          from: { opacity: '0', transform: 'translateY(-0.3rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
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
