/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#15251d',
        muted: '#64746a',
        paper: '#f5f7f2',
        line: '#e1e8e0',
        brand: {
          DEFAULT: '#286247',
          dark: '#1d5039',
          soft: '#edf5ee',
        },
        lime: '#d9f27a',
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
