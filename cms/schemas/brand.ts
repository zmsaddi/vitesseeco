import { defineType } from 'sanity'

export default defineType({
  name: 'brand',
  title: 'Marque',
  type: 'document',
  icon: () => '🏷️',
  fields: [
    { name: 'name', title: 'Nom de la marque', type: 'string' },
    { name: 'slug', title: 'URL Slug', type: 'slug', options: { source: 'name', maxLength: 96 } },
    { name: 'logo', title: 'Logo', type: 'image' },
    { name: 'description', title: 'Description', type: 'localizedText' },
  ],
  preview: {
    select: { title: 'name', media: 'logo' },
  },
})
