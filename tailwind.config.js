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
        soft: '0 16px 44px rgba(21, 37, 29, 0.07)',
        lift: '0 22px 48px rgba(21, 37, 29, 0.12)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
