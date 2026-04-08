import { defineType } from 'sanity'

export default defineType({
  name: 'localizedText',
  title: 'نص طويل مترجم',
  type: 'object',
  fields: [
    { name: 'fr', title: '🇫🇷 الفرنسية', type: 'text', rows: 4 },
    { name: 'en', title: '🇬🇧 الإنجليزية', type: 'text', rows: 4 },
    { name: 'es', title: '🇪🇸 الإسبانية', type: 'text', rows: 4 },
    { name: 'nl', title: '🇳🇱 الهولندية', type: 'text', rows: 4 },
    { name: 'de', title: '🇩🇪 الألمانية', type: 'text', rows: 4 },
    { name: 'ar', title: '🇸🇦 العربية', type: 'text', rows: 4 },
  ],
})
