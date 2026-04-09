import { defineType } from 'sanity'

export default defineType({
  name: 'faq',
  title: 'سؤال شائع',
  type: 'document',
  icon: () => '❓',
  fields: [
    {
      name: 'question', title: '❓ السؤال', type: 'localizedString',
      description: 'السؤال بكل اللغات — الفرنسية إلزامية',
      validation: (Rule) => Rule.required().error('السؤال مطلوب'),
    },
    {
      name: 'answer', title: '💬 الجواب', type: 'localizedText',
      description: 'الإجابة التفصيلية بكل اللغات',
      validation: (Rule) => Rule.required().error('الجواب مطلوب'),
    },
    {
      name: 'category', title: '📂 التصنيف', type: 'string',
      options: {
        list: [
          { title: '📋 عام', value: 'general' },
          { title: '⚙️ تقني', value: 'technical' },
          { title: '🚚 الشحن والتوصيل', value: 'shipping' },
          { title: '💳 الدفع', value: 'payment' },
          { title: '⚖️ قانوني', value: 'legal' },
          { title: '🔧 الصيانة', value: 'maintenance' },
        ],
      },
      initialValue: 'general',
    },
    {
      name: 'sortOrder', title: '🔢 الترتيب', type: 'number', initialValue: 0,
      validation: (Rule) => Rule.min(0),
    },
    { name: 'isPublished', title: '✅ منشور', type: 'boolean', initialValue: true },
  ],
  preview: {
    select: { title: 'question.fr', category: 'category', published: 'isPublished' },
    prepare({ title, category, published }) {
      const cats: Record<string, string> = { general: '📋', technical: '⚙️', shipping: '🚚', payment: '💳', legal: '⚖️', maintenance: '🔧' }
      return {
        title: `${published ? '✅' : '❌'} ${title || 'سؤال'}`,
        subtitle: `${cats[category || 'general'] || ''} ${category || 'عام'}`,
      }
    },
  },
  orderings: [{ title: 'ترتيب العرض', name: 'sortOrder', by: [{ field: 'sortOrder', direction: 'asc' }] }],
})
