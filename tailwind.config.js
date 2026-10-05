/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: 'rgb(var(--joko-color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--joko-color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--joko-color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--joko-color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--joko-color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--joko-color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--joko-color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--joko-color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--joko-color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--joko-color-brand-900) / <alpha-value>)',
          950: 'rgb(var(--joko-color-brand-950) / <alpha-value>)',
        },
        background: {
          DEFAULT: 'rgb(var(--joko-surface-canvas) / <alpha-value>)',
          secondary: 'rgb(var(--joko-surface-soft) / <alpha-value>)',
        },
        accent: 'rgb(var(--joko-accent) / <alpha-value>)',
      },
      fontFamily: {
        header: ['var(--joko-font-display)'],
        body: ['var(--joko-font-body)'],
      },
    },
  },
  plugins: [],
};
