import { defineType } from 'sanity'

export default defineType({
  name: 'aboutPage',
  title: 'Page À Propos',
  type: 'document',
  icon: () => 'ℹ️',
  fields: [
    { name: 'title', title: 'Titre', type: 'localizedString' },
    { name: 'subtitle', title: 'Sous-titre', type: 'localizedString' },
    { name: 'story', title: 'Notre histoire', type: 'localizedText' },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
    {
      name: 'values',
      title: 'Nos engagements',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'Icône (lucide)', type: 'string' },
          { name: 'title', title: 'Titre', type: 'localizedString' },
          { name: 'description', title: 'Description', type: 'localizedString' },
        ],
      }],
    },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: { prepare: () => ({ title: 'Page À Propos' }) },
})
