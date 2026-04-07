import { defineType } from 'sanity'

export default defineType({
  name: 'siteSettings',
  title: 'Paramètres du site',
  type: 'document',
  icon: () => '⚙️',
  fields: [
    { name: 'logo', title: 'Logo', type: 'image' },
    { name: 'siteName', title: 'Nom du site', type: 'string', initialValue: 'Vitesse Eco' },
    { name: 'tagline', title: 'Slogan', type: 'localizedString' },
    {
      name: 'contactInfo',
      title: 'Informations de contact',
      type: 'object',
      fields: [
        { name: 'email', title: 'Email', type: 'string' },
        { name: 'phone', title: 'Téléphone', type: 'string' },
        { name: 'address', title: 'Adresse', type: 'text', rows: 2 },
        { name: 'hours', title: 'Horaires', type: 'text', rows: 2 },
      ],
    },
    {
      name: 'socialLinks',
      title: 'Réseaux sociaux',
      type: 'object',
      fields: [
        { name: 'instagram', title: 'Instagram URL', type: 'url' },
        { name: 'facebook', title: 'Facebook URL', type: 'url' },
        { name: 'tiktok', title: 'TikTok URL', type: 'url' },
      ],
    },
    { name: 'footerText', title: 'Texte du pied de page', type: 'localizedString' },
  ],
  preview: {
    prepare: () => ({ title: 'Paramètres du site' }),
  },
})
