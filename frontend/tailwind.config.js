/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0b1324',
        surface: '#0f172a',
        panel: '#111827',
        accent: '#22d3ee',
        warn: '#f59e0b',
        danger: '#ef4444',
        muted: '#94a3b8',
      },
      boxShadow: {
        panel: '0 20px 60px rgba(0,0,0,0.35)',
        card: '0 8px 30px rgba(0,0,0,0.25)',
      },
    },
  },
  plugins: [],
};
