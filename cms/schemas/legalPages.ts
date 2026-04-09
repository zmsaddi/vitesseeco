import { defineType } from 'sanity'

const legalSection = {
  type: 'object',
  fields: [
    {
      name: 'title', title: 'عنوان القسم', type: 'localizedString',
      validation: (Rule: any) => Rule.required().error('عنوان القسم مطلوب'),
    },
    {
      name: 'content', title: 'المحتوى', type: 'localizedText',
      validation: (Rule: any) => Rule.required().error('محتوى القسم مطلوب'),
    },
  ],
  preview: {
    select: { title: 'title.fr' },
    prepare({ title }: { title: string }) {
      return { title: title || 'قسم' }
    },
  },
}

export default defineType({
  name: 'legalPages',
  title: 'الصفحات القانونية',
  type: 'document',
  icon: () => '⚖️',
  groups: [
    { name: 'mentions', title: '📋 الإشعارات القانونية', default: true },
    { name: 'privacy', title: '🔒 سياسة الخصوصية' },
    { name: 'cgv', title: '📄 شروط البيع' },
  ],
  fields: [
    // Keep legacy fields for backward compatibility
    { name: 'mentionsLegales', title: '📋 الإشعارات القانونية (نص قديم)', type: 'localizedText', group: 'mentions', hidden: ({ document }: any) => !!document?.mentionsSections?.length },
    {
      name: 'mentionsSections', title: '📋 الإشعارات القانونية (أقسام)', type: 'array',
      of: [legalSection],
      group: 'mentions',
      description: 'أضف أقسام الإشعارات القانونية بالترتيب. كل قسم يظهر مع عنوانه في الصفحة.',
    },
    { name: 'politiqueConfidentialite', title: '🔒 سياسة الخصوصية (نص قديم)', type: 'localizedText', group: 'privacy', hidden: ({ document }: any) => !!document?.privacySections?.length },
    {
      name: 'privacySections', title: '🔒 سياسة الخصوصية (أقسام)', type: 'array',
      of: [legalSection],
      group: 'privacy',
      description: 'أضف أقسام سياسة الخصوصية بالترتيب.',
    },
    { name: 'cgv', title: '📄 شروط البيع (نص قديم)', type: 'localizedText', group: 'cgv', hidden: ({ document }: any) => !!document?.cgvSections?.length },
    {
      name: 'cgvSections', title: '📄 شروط البيع (أقسام)', type: 'array',
      of: [legalSection],
      group: 'cgv',
      description: 'أضف أقسام الشروط العامة للبيع بالترتيب.',
    },
  ],
  preview: { prepare: () => ({ title: 'الصفحات القانونية' }) },
})
