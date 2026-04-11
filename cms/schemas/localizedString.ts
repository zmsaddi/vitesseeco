import { defineType } from 'sanity'

export default defineType({
  name: 'localizedString',
  title: 'نص مترجم',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    { name: 'fr', title: '🇫🇷 FR', type: 'string' },
    { name: 'en', title: '🇬🇧 EN', type: 'string' },
    { name: 'es', title: '🇪🇸 ES', type: 'string' },
    { name: 'nl', title: '🇳🇱 NL', type: 'string' },
    { name: 'de', title: '🇩🇪 DE', type: 'string' },
    { name: 'ar', title: '🇸🇦 AR', type: 'string' },
  ],
  preview: {
    select: { fr: 'fr', en: 'en' },
    prepare({ fr, en }) {
      return { title: fr || en || '(فارغ)' }
    },
  },
})
