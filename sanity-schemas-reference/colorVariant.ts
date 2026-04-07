import { defineType } from 'sanity'

export default defineType({
  name: 'colorVariant',
  title: 'Variante couleur',
  type: 'object',
  fields: [
    { name: 'colorName', title: 'Nom de la couleur', type: 'localizedString' },
    { name: 'colorHex', title: 'Code couleur HEX', type: 'string', description: 'Ex: #000000' },
    { name: 'sku', title: 'SKU', type: 'string', description: 'Code unique du produit (ex: V20PRO-BLK)' },
    {
      name: 'images',
      title: 'Photos de cette couleur',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
    },
    { name: 'stock', title: 'Stock disponible', type: 'number', initialValue: 0 },
    { name: 'priceOverride', title: 'Prix spécifique (si différent)', type: 'number', description: 'Laisser vide si même prix que le produit' },
  ],
  preview: {
    select: { title: 'colorName.fr', subtitle: 'sku', stock: 'stock' },
    prepare({ title, subtitle, stock }) {
      return { title: title || 'Couleur', subtitle: `${subtitle || ''} — Stock: ${stock ?? 0}` }
    },
  },
})
