/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        gw: {
          bg: '#F5F6F8',
          card: '#FFFFFF',
          primary: '#10B981',
          primaryDark: '#059669',
          accent: '#0EA5E9',
          indigo: '#6366F1',
          danger: '#EF4444',
          warning: '#F59E0B',
          stroke: '#E5E7EB',
          text: '#111827',
          textMuted: '#374151',
        },
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
