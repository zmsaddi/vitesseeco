import type { Config } from 'tailwindcss'

export default {
  content: [
    './components/**/*.{js,vue,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#0A1628',
        'dark-secondary': '#1E293B',
        'dark-tertiary': '#334155',
        accent: '#4ADE80',
        gold: '#D4A843',
        'text-secondary': '#94A3B8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
