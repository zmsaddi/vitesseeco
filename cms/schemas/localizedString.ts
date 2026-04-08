import { defineType } from 'sanity'

export default defineType({
  name: 'localizedString',
  title: 'نص مترجم',
  type: 'object',
  fields: [
    { name: 'fr', title: '🇫🇷 الفرنسية', type: 'string' },
    { name: 'en', title: '🇬🇧 الإنجليزية', type: 'string' },
    { name: 'es', title: '🇪🇸 الإسبانية', type: 'string' },
    { name: 'nl', title: '🇳🇱 الهولندية', type: 'string' },
    { name: 'de', title: '🇩🇪 الألمانية', type: 'string' },
    { name: 'ar', title: '🇸🇦 العربية', type: 'string' },
  ],
})
