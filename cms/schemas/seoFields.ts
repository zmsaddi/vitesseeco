import { defineType } from 'sanity'

export default defineType({
  name: 'seoFields',
  title: 'SEO',
  type: 'object',
  fields: [
    { name: 'title', title: 'Titre SEO', type: 'string', description: 'Max 60 caractères' },
    { name: 'description', title: 'Description SEO', type: 'text', rows: 3, description: 'Max 160 caractères' },
    { name: 'ogImage', title: 'Image partage (OG)', type: 'image' },
  ],
})
