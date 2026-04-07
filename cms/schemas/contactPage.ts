import { defineType } from 'sanity'

export default defineType({
  name: 'contactPage',
  title: 'Page Contact',
  type: 'document',
  icon: () => '📞',
  fields: [
    { name: 'title', title: 'Titre', type: 'localizedString' },
    { name: 'subtitle', title: 'Sous-titre', type: 'localizedString' },
    { name: 'email', title: 'Email', type: 'string' },
    { name: 'phone', title: 'Téléphone', type: 'string' },
    { name: 'address', title: 'Adresse', type: 'text', rows: 3 },
    { name: 'hours', title: 'Horaires d\'ouverture', type: 'text', rows: 3 },
    { name: 'mapUrl', title: 'Lien Google Maps (embed)', type: 'url' },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: { prepare: () => ({ title: 'Page Contact' }) },
})
