import { defineType } from 'sanity'

export default defineType({
  name: 'shippingMethod',
  title: 'Méthode de livraison',
  type: 'document',
  icon: () => '🚚',
  fields: [
    { name: 'name', title: 'Nom', type: 'localizedString' },
    { name: 'code', title: 'Code unique', type: 'string', description: 'Ex: standard, express, relay' },
    { name: 'description', title: 'Description', type: 'localizedString' },
    { name: 'estimatedDays', title: 'Délai estimé (jours)', type: 'string', description: 'Ex: 5-7' },
    { name: 'price', title: 'Prix (€)', type: 'number', description: '0 = gratuit' },
    { name: 'freeAbove', title: 'Gratuit au-dessus de (€)', type: 'number', description: 'Livraison gratuite si commande > ce montant. Laisser vide si jamais gratuit.' },
    {
      name: 'zones',
      title: 'Zones de livraison',
      type: 'array',
      of: [{ type: 'string' }],
      options: {
        list: [
          { title: 'France métropolitaine', value: 'FR' },
          { title: 'Belgique', value: 'BE' },
          { title: 'Luxembourg', value: 'LU' },
          { title: 'Allemagne', value: 'DE' },
          { title: 'Pays-Bas', value: 'NL' },
          { title: 'Espagne', value: 'ES' },
          { title: 'Italie', value: 'IT' },
          { title: 'Europe (autre)', value: 'EU' },
        ],
      },
    },
    { name: 'isActive', title: 'Actif', type: 'boolean', initialValue: true },
    { name: 'sortOrder', title: 'Ordre', type: 'number', initialValue: 0 },
  ],
  preview: {
    select: { title: 'name.fr', price: 'price', active: 'isActive' },
    prepare({ title, price, active }) {
      return {
        title: title || 'Sans nom',
        subtitle: `${price === 0 ? 'Gratuit' : price + '€'} ${active ? '✅' : '❌'}`,
      }
    },
  },
})
