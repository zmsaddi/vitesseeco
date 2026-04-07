import { defineType } from 'sanity'

export default defineType({
  name: 'promoCode',
  title: 'Code promo',
  type: 'document',
  icon: () => '🎟️',
  fields: [
    { name: 'code', title: 'Code', type: 'string', description: 'Ex: SUMMER20' },
    {
      name: 'discountType',
      title: 'Type de remise',
      type: 'string',
      options: { list: [{ title: 'Pourcentage (%)', value: 'percentage' }, { title: 'Montant fixe (€)', value: 'fixed' }] },
    },
    { name: 'discountValue', title: 'Valeur de la remise', type: 'number', description: 'Ex: 20 pour 20% ou 50 pour 50€' },
    { name: 'minOrderAmount', title: 'Montant minimum de commande (€)', type: 'number' },
    { name: 'maxUses', title: 'Nombre max d\'utilisations', type: 'number' },
    { name: 'currentUses', title: 'Utilisations actuelles', type: 'number', initialValue: 0, readOnly: true },
    { name: 'validFrom', title: 'Valide à partir de', type: 'datetime' },
    { name: 'validUntil', title: 'Valide jusqu\'à', type: 'datetime' },
    { name: 'isActive', title: 'Actif', type: 'boolean', initialValue: true },
    {
      name: 'applicableProducts',
      title: 'Produits concernés (vide = tous)',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
    },
  ],
  preview: {
    select: { title: 'code', type: 'discountType', value: 'discountValue', active: 'isActive' },
    prepare({ title, type, value, active }) {
      const discount = type === 'percentage' ? `${value}%` : `${value}€`
      return { title: title || 'Code', subtitle: `${discount} ${active ? '✅ Actif' : '❌ Inactif'}` }
    },
  },
})
