import { defineType } from 'sanity'

export default defineType({
  name: 'testimonial',
  title: 'Témoignage client',
  type: 'document',
  icon: () => '⭐',
  fields: [
    { name: 'customerName', title: 'Nom du client', type: 'string' },
    { name: 'rating', title: 'Note (1-5)', type: 'number', validation: (Rule) => Rule.min(1).max(5) },
    { name: 'text', title: 'Témoignage', type: 'localizedText' },
    { name: 'photo', title: 'Photo du client', type: 'image' },
    { name: 'product', title: 'Produit acheté', type: 'reference', to: [{ type: 'product' }] },
  ],
  preview: {
    select: { title: 'customerName', subtitle: 'rating' },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? '⭐'.repeat(subtitle) : '' }
    },
  },
})
