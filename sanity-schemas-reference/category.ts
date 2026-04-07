import { defineType } from 'sanity'

export default defineType({
  name: 'category',
  title: 'Catégorie',
  type: 'document',
  icon: () => '📂',
  fields: [
    { name: 'name', title: 'Nom', type: 'localizedString' },
    { name: 'slug', title: 'URL Slug', type: 'slug', options: { source: 'name.fr', maxLength: 96 } },
    { name: 'description', title: 'Description', type: 'localizedText' },
    { name: 'image', title: 'Image', type: 'image', options: { hotspot: true } },
    { name: 'sortOrder', title: 'Ordre d\'affichage', type: 'number', initialValue: 0 },
  ],
  preview: {
    select: { title: 'name.fr', media: 'image' },
  },
})
