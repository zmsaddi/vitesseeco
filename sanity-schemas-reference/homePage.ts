import { defineType } from 'sanity'

export default defineType({
  name: 'homePage',
  title: 'Page d\'accueil',
  type: 'document',
  icon: () => '🏠',
  fields: [
    {
      name: 'heroBanner',
      title: 'Bannière principale',
      type: 'object',
      fields: [
        { name: 'title', title: 'Titre', type: 'localizedString' },
        { name: 'subtitle', title: 'Sous-titre', type: 'localizedString' },
        { name: 'description', title: 'Description', type: 'localizedText' },
        { name: 'backgroundImage', title: 'Image de fond', type: 'image' },
        { name: 'ctaText', title: 'Texte du bouton', type: 'localizedString' },
        { name: 'ctaLink', title: 'Lien du bouton', type: 'string' },
      ],
    },
    { name: 'featuredProductsTitle', title: 'Titre section produits', type: 'localizedString' },
    { name: 'featuredProductsSubtitle', title: 'Sous-titre section produits', type: 'localizedString' },
    {
      name: 'values',
      title: 'Nos valeurs',
      type: 'array',
      of: [{
        type: 'object',
        fields: [
          { name: 'icon', title: 'Icône (lucide)', type: 'string', description: 'Ex: zap, leaf, shield-check, headphones' },
          { name: 'title', title: 'Titre', type: 'localizedString' },
          { name: 'description', title: 'Description', type: 'localizedString' },
        ],
      }],
    },
    {
      name: 'testimonials',
      title: 'Témoignages à afficher',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'testimonial' }] }],
    },
    { name: 'seo', title: 'SEO', type: 'seoFields' },
  ],
  preview: {
    prepare: () => ({ title: 'Page d\'accueil' }),
  },
})
