/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f7ff',
          100: '#e0effe',
          200: '#baddfd',
          300: '#7ec3fb',
          400: '#3aa0f6',
          500: '#1082e8',
          600: '#0464c7',
          700: '#054fa1',
          800: '#094385',
          900: '#0d3a6e',
          950: '#091f42',
        },
        accent: {
          50: '#f0fdf9',
          100: '#ccfbef',
          200: '#9af6df',
          300: '#5eeacc',
          400: '#2cd5b5',
          500: '#13b89c',
          600: '#0d9481',
          700: '#0f7669',
          800: '#115e56',
          900: '#124e47',
          950: '#042e2a',
        },
        danger: '#ef4444',
        warning: '#f59e0b',
        success: '#10b981',
        info: '#3b82f6',
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        jakarta: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px 0 rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px 0 rgba(0,0,0,0.10)',
        glass: '0 8px 32px 0 rgba(31, 38, 135, 0.08)',
      },
    },
  },
  plugins: [],
}
