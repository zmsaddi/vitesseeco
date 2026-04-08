import { defineType } from 'sanity'

export default defineType({
  name: 'legalPages',
  title: 'الصفحات القانونية',
  type: 'document',
  icon: () => '⚖️',
  fields: [
    { name: 'mentionsLegales', title: 'الإشعارات القانونية', type: 'localizedText' },
    { name: 'politiqueConfidentialite', title: 'سياسة الخصوصية', type: 'localizedText' },
    { name: 'cgv', title: 'الشروط العامة للبيع', type: 'localizedText' },
  ],
  preview: { prepare: () => ({ title: 'الصفحات القانونية' }) },
})
