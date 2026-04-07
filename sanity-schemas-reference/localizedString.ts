import { defineType } from 'sanity'

export default defineType({
  name: 'localizedString',
  title: 'Texte traduit',
  type: 'object',
  fields: [
    { name: 'fr', title: '🇫🇷 Français', type: 'string' },
    { name: 'es', title: '🇪🇸 Español', type: 'string' },
    { name: 'nl', title: '🇳🇱 Nederlands', type: 'string' },
    { name: 'de', title: '🇩🇪 Deutsch', type: 'string' },
  ],
})
