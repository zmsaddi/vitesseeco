import { defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'Produit',
  type: 'document',
  icon: () => '🚲',
  groups: [
    { name: 'general', title: 'Général', default: true },
    { name: 'media', title: 'Photos' },
    { name: 'pricing', title: 'Prix & Stock' },
    { name: 'specs', title: 'Fiche Technique' },
    { name: 'variants', title: 'Couleurs' },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    // === GENERAL ===
    { name: 'name', title: 'Nom du modèle', type: 'localizedString', group: 'general' },
    {
      name: 'slug',
      title: 'URL Slug',
      type: 'slug',
      options: { source: 'name.fr', maxLength: 96 },
      group: 'general',
    },
    { name: 'brand', title: 'Marque', type: 'reference', to: [{ type: 'brand' }], group: 'general' },
    { name: 'category', title: 'Catégorie', type: 'reference', to: [{ type: 'category' }], group: 'general' },
    { name: 'shortDescription', title: 'Description courte', type: 'localizedString', group: 'general' },
    { name: 'description', title: 'Description complète', type: 'localizedText', group: 'general' },

    // === MEDIA ===
    { name: 'mainImage', title: 'Image principale', type: 'image', options: { hotspot: true }, group: 'media' },
    {
      name: 'gallery',
      title: 'Galerie photos',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      group: 'media',
    },

    // === PRICING ===
    { name: 'price', title: 'Prix (€)', type: 'number', group: 'pricing' },
    { name: 'compareAtPrice', title: 'Ancien prix barré (€)', type: 'number', group: 'pricing', description: 'Laisser vide si pas en promotion' },
    { name: 'isOnSale', title: 'En promotion', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'isAvailable', title: 'Disponible à la vente', type: 'boolean', initialValue: true, group: 'pricing' },
    { name: 'isFeatured', title: 'Mis en avant (page d\'accueil)', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'isNew', title: 'Nouveau produit', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'sortOrder', title: 'Ordre d\'affichage', type: 'number', initialValue: 0, group: 'pricing' },

    // === SPECS ===
    {
      name: 'specifications',
      title: 'Fiche technique',
      type: 'object',
      group: 'specs',
      fields: [
        { name: 'motor', title: 'Moteur', type: 'string', description: 'Ex: 250W' },
        { name: 'battery', title: 'Batterie', type: 'string', description: 'Ex: 48V 15.6AH' },
        { name: 'tireSize', title: 'Taille des pneus', type: 'string', description: 'Ex: 20" x 4.0"' },
        { name: 'maxLoad', title: 'Charge max (kg)', type: 'number' },
        { name: 'range', title: 'Autonomie', type: 'string', description: 'Ex: 40-50 km' },
        { name: 'brakeType', title: 'Type de freins', type: 'string' },
        { name: 'weight', title: 'Poids net (kg)', type: 'number' },
        { name: 'grossWeight', title: 'Poids brut (kg)', type: 'number' },
        { name: 'dimensions', title: 'Dimensions (debout)', type: 'string' },
        { name: 'packingSize', title: 'Dimensions (emballé)', type: 'string' },
        { name: 'maxSpeed', title: 'Vitesse max (km/h)', type: 'number' },
        { name: 'suspension', title: 'Suspension', type: 'string' },
        { name: 'frame', title: 'Cadre', type: 'string' },
        { name: 'chargeTime', title: 'Temps de charge (h)', type: 'string' },
        { name: 'gears', title: 'Vitesses', type: 'string' },
      ],
    },

    // === VARIANTS ===
    {
      name: 'variants',
      title: 'Variantes couleur',
      type: 'array',
      of: [{ type: 'colorVariant' }],
      group: 'variants',
    },

    // === SEO ===
    { name: 'seo', title: 'SEO', type: 'seoFields', group: 'seo' },
    {
      name: 'relatedProducts',
      title: 'Produits associés',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
      group: 'general',
    },
  ],
  preview: {
    select: { title: 'name.fr', media: 'mainImage', price: 'price', available: 'isAvailable' },
    prepare({ title, media, price, available }) {
      return {
        title: title || 'Sans nom',
        subtitle: `${price ? price + ' €' : 'Prix non défini'} ${available === false ? '— INDISPONIBLE' : ''}`,
        media,
      }
    },
  },
})
