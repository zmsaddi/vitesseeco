import { defineType } from 'sanity'

export default defineType({
  name: 'legalPages',
  title: 'Pages Légales',
  type: 'document',
  icon: () => '⚖️',
  fields: [
    { name: 'mentionsLegales', title: 'Mentions Légales', type: 'localizedText' },
    { name: 'politiqueConfidentialite', title: 'Politique de Confidentialité', type: 'localizedText' },
    { name: 'cgv', title: 'Conditions Générales de Vente', type: 'localizedText' },
  ],
  preview: { prepare: () => ({ title: 'Pages Légales' }) },
})
