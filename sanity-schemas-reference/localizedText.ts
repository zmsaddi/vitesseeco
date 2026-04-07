import { defineType } from 'sanity'

export default defineType({
  name: 'localizedText',
  title: 'Texte long traduit',
  type: 'object',
  fields: [
    { name: 'fr', title: '🇫🇷 Français', type: 'text', rows: 4 },
    { name: 'es', title: '🇪🇸 Español', type: 'text', rows: 4 },
    { name: 'nl', title: '🇳🇱 Nederlands', type: 'text', rows: 4 },
    { name: 'de', title: '🇩🇪 Deutsch', type: 'text', rows: 4 },
  ],
})
