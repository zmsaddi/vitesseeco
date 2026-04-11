import { defineType } from 'sanity'

export default defineType({
  name: 'localizedString',
  title: 'نص مترجم',
  type: 'object',
  options: { collapsible: true, collapsed: true },
  fields: [
    { name: 'fr', title: '🇫🇷 FR', type: 'string', validation: (Rule: any) => Rule.custom((value: string | undefined, context: any) => {
      // Require French when parent field is required
      const parent = context?.parent
      if (!parent) return true
      // Only enforce on fields that have content in any language
      const hasAnyLang = ['en', 'es', 'nl', 'de', 'ar'].some((lang) => parent[lang]?.trim())
      if (hasAnyLang && (!value || !value.trim())) return 'الفرنسية مطلوبة إذا تمت ترجمة لغة أخرى'
      return true
    }) },
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
