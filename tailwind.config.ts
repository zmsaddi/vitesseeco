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
      // ─── Colors (Vitesse Eco identity — DO NOT change values, P2-01) ───
      colors: {
        primary: '#0A1628',
        'dark-secondary': '#1E293B',
        'dark-tertiary': '#334155',
        accent: '#4ADE80',
        gold: '#D4A843',
        'text-secondary': '#94A3B8',
        // Semantic aliases — use these in new code instead of color names
        // when the meaning is the intent (e.g. `bg-surface`, `text-on-surface`).
        surface: '#1E293B',         // = dark-secondary
        'surface-2': '#334155',     // = dark-tertiary
        bg: '#0A1628',              // = primary (page background)
        'on-surface': '#FFFFFF',
        'on-surface-muted': '#94A3B8',
        success: '#16A34A',
        danger: '#DC2626',
        warning: '#D97706',
      },

      // ─── Typography ───
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Montserrat', 'sans-serif'],
      },

      // ─── Spacing extras (we keep Tailwind defaults; only add named extras) ───
      spacing: {
        'touch': '44px', // P1-06: minimum touch target
      },

      // ─── Z-index layer system (P2-05) ───
      // Single source of truth for stacking. Use these instead of arbitrary
      // numbers like z-10 / z-50 / z-[60] scattered across components.
      zIndex: {
        'base': '0',
        'dropdown': '20',
        'banner': '30',     // language banner, cookie consent
        'header': '40',     // sticky header
        'overlay': '45',    // page overlays under modals
        'modal': '50',      // modal backdrops + dialogs (cart drawer, delete-account)
        'toast': '60',      // toasts always above modals
        'tooltip': '70',    // tooltips above everything
      },

      // ─── Motion tokens (P2-06) ───
      // Use duration-fast/normal/slow + ease-soft for all transitions in new
      // code. Existing `transition-colors duration-200` is allowed to stay.
      transitionDuration: {
        'fast': '120ms',
        'normal': '200ms',
        'slow': '320ms',
      },
      transitionTimingFunction: {
        'soft': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'spring': 'cubic-bezier(0.25, 1.5, 0.5, 1)',
      },

      // ─── Focus ring (P2-04) ───
      // Used by .focus-visible-ring class in main.css.
      ringWidth: {
        'focus': '2px',
      },
      ringOffsetWidth: {
        'focus': '2px',
      },
    },
  },
  plugins: [],
} satisfies Config
