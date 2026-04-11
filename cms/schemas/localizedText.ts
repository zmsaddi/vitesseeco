import { defineType } from 'sanity'

export default defineType({
  name: 'localizedText',
  title: 'نص طويل مترجم',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    { name: 'fr', title: '🇫🇷 FR', type: 'text', rows: 3 },
    { name: 'en', title: '🇬🇧 EN', type: 'text', rows: 3 },
    { name: 'es', title: '🇪🇸 ES', type: 'text', rows: 3 },
    { name: 'nl', title: '🇳🇱 NL', type: 'text', rows: 3 },
    { name: 'de', title: '🇩🇪 DE', type: 'text', rows: 3 },
    { name: 'ar', title: '🇸🇦 AR', type: 'text', rows: 3 },
  ],
  preview: {
    select: { fr: 'fr', en: 'en' },
    prepare({ fr, en }) {
      return { title: (fr || en || '(فارغ)').slice(0, 60) }
    },
  },
})
