/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: 'rgb(var(--hub-ink-rgb) / <alpha-value>)',
        muted: 'rgb(var(--hub-muted-rgb) / <alpha-value>)',
        paper: 'rgb(var(--hub-paper-rgb) / <alpha-value>)',
        line: 'rgb(var(--hub-line-rgb) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--hub-brand-rgb) / <alpha-value>)',
          dark: 'rgb(var(--hub-brand-dark-rgb) / <alpha-value>)',
          soft: 'rgb(var(--hub-brand-soft-rgb) / <alpha-value>)',
        },
        lime: 'rgb(var(--hub-lime-rgb) / <alpha-value>)',
      },
      boxShadow: {
        soft: 'var(--hub-shadow-soft)',
        lift: 'var(--hub-shadow-lift)',
      },
      borderRadius: {
        'hub-control': 'var(--hub-radius-control)',
        'hub-card': 'var(--hub-radius-card)',
        'hub-panel': 'var(--hub-radius-panel)',
        '4xl': '2rem',
      },
      fontSize: {
        'hub-display': ['var(--hub-type-display)', { lineHeight: '1.02', letterSpacing: '-0.055em' }],
        'hub-section': ['var(--hub-type-section)', { lineHeight: '1.12', letterSpacing: '-0.035em' }],
        'hub-page': ['var(--hub-type-page)', { lineHeight: '1.08', letterSpacing: '-0.045em' }],
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
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
          from: { opacity: '0', transform: 'translateY(0.5rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'hub-menu-in': {
          from: { opacity: '0', transform: 'translateY(-0.3rem)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'hub-enter': 'hub-enter var(--hub-motion-reveal) var(--hub-ease-emphasized) both',
        'hub-card-enter': 'hub-card-enter var(--hub-motion-reveal) var(--hub-ease-emphasized) both',
        'hub-menu-in': 'hub-menu-in var(--hub-motion-fast) var(--hub-ease-standard) both',
      },
    },
  },
  plugins: [],
};
