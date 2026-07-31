import type { Config } from 'tailwindcss'

/**
 * Every colour resolves to a custom property declared in app/assets/css/main.css.
 * Components therefore never contain a literal colour, and the light and dark
 * themes are the same markup with different token values.
 *
 * `<alpha-value>` keeps Tailwind's opacity modifiers working (`bg-accent/10`).
 */
const withAlpha = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`

export default {
  content: ['./app/**/*.{vue,js,ts}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: withAlpha('--surface-base'),
          raised: withAlpha('--surface-raised'),
          sunken: withAlpha('--surface-sunken'),
          border: withAlpha('--surface-border'),
        },
        content: {
          DEFAULT: withAlpha('--content-default'),
          strong: withAlpha('--content-strong'),
          muted: withAlpha('--content-muted'),
          inverse: withAlpha('--content-inverse'),
        },
        accent: {
          DEFAULT: withAlpha('--accent'),
          hover: withAlpha('--accent-hover'),
          contrast: withAlpha('--accent-contrast'),
          subtle: withAlpha('--accent-subtle'),
        },
        danger: {
          DEFAULT: withAlpha('--danger'),
          subtle: withAlpha('--danger-subtle'),
        },
        warning: {
          DEFAULT: withAlpha('--warning'),
          subtle: withAlpha('--warning-subtle'),
        },
        success: {
          DEFAULT: withAlpha('--success'),
          subtle: withAlpha('--success-subtle'),
        },
        gold: {
          DEFAULT: withAlpha('--gold'),
          deep: withAlpha('--gold-deep'),
        },
        'forest-black': withAlpha('--forest-black'),
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Manrope', 'Inter', 'ui-sans-serif', 'sans-serif'],
      },
      spacing: {
        // The minimum comfortable touch target.
        11: '2.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config
