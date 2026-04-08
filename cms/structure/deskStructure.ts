import type { StructureBuilder } from 'sanity/structure'

export const deskStructure = (S: StructureBuilder) =>
  S.list()
    .title('Vitesse Eco')
    .items([
      // Catalogue
      S.listItem()
        .title('🚲 Produits')
        .child(S.documentTypeList('product').title('Produits')),
      S.listItem()
        .title('📂 Catégories')
        .child(S.documentTypeList('category').title('Catégories')),
      S.listItem()
        .title('🏷️ Marques')
        .child(S.documentTypeList('brand').title('Marques')),

      S.divider(),

      // Marketing
      S.listItem()
        .title('🎟️ Codes promo')
        .child(S.documentTypeList('promoCode').title('Codes promo')),
      S.listItem()
        .title('⭐ Témoignages')
        .child(S.documentTypeList('testimonial').title('Témoignages')),
      S.listItem()
        .title('🚚 Livraison')
        .child(S.documentTypeList('shippingMethod').title('Méthodes de livraison')),

      S.divider(),

      // Pages (singletons)
      S.listItem()
        .title('🏠 Page d\'accueil')
        .child(S.document().schemaType('homePage').documentId('homePage')),
      S.listItem()
        .title('ℹ️ Page À Propos')
        .child(S.document().schemaType('aboutPage').documentId('aboutPage')),
      S.listItem()
        .title('📞 Page Contact')
        .child(S.document().schemaType('contactPage').documentId('contactPage')),
      S.listItem()
        .title('⚖️ Pages Légales')
        .child(S.document().schemaType('legalPages').documentId('legalPages')),

      S.divider(),

      // Settings
      S.listItem()
        .title('⚙️ Paramètres du site')
        .child(S.document().schemaType('siteSettings').documentId('siteSettings')),
    ])
