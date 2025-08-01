/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#2563eb',
        secondary: '#64748b',
        success: '#059669',
        warning: '#d97706',
        error: '#dc2626',
        background: '#f8fafc',
        surface: '#ffffff',
      },
    },
  },
  plugins: [],
};