// @ts-nocheck — Sanity Studio types incompatible with Nuxt typecheck
/**
 * Document Action: "Duplicate as New Color"
 * Creates a DRAFT copy of a product with color-specific fields cleared.
 * Keeps: modelFamily, brand, price, specifications, description, warranty, highlights, productType
 * Clears: name, slug, color, colorHex, images, stock, isNew, isFeatured, seo
 * Never copied: sku and gtin — an EAN identifies exactly one product, so two
 * documents sharing a code is a GS1 violation, not a shortcut.
 */
import { useClient } from 'sanity'
import type { DocumentActionComponent } from 'sanity'

export const duplicateAsColorAction: DocumentActionComponent = (props) => {
  const client = useClient({ apiVersion: '2024-01-01' })

  if (props.type !== 'product') return null

  return {
    label: '🎨 لون جديد (Duplicate as Color)',
    onHandle: async () => {
      const doc = props.draft || props.published
      if (!doc) return

      // Build the new document with shared fields kept, color fields cleared
      const newDoc: Record<string, unknown> = {
        _type: 'product',
        // KEEP these fields
        productType: doc.productType,
        brand: doc.brand,
        price: doc.price,
        compareAtPrice: doc.compareAtPrice,
        modelFamily: doc.modelFamily,
        shortDescription: doc.shortDescription,
        description: doc.description,
        warranty: doc.warranty,
        highlights: doc.highlights,
        specifications: doc.specifications,
        category: doc.category,
        videoUrl: doc.videoUrl,
        sortOrder: doc.sortOrder,
        isAvailable: true,
        isOnSale: doc.isOnSale,
        // CLEAR these fields (editor fills them). colorHex is left unset rather
        // than blanked — '' fails the #RRGGBB rule and would block publishing.
        name: { fr: '', en: '', es: '', nl: '', de: '', ar: '' },
        color: { fr: '', en: '', es: '', nl: '', de: '', ar: '' },
        stock: 0,
        isNew: false,
        isFeatured: false,
        images: [],
      }

      // The copy is deliberately incomplete (no name, no images, no color), so
      // it is born as a draft: the storefront reads published documents only,
      // and the editor has to pass Studio validation to publish it.
      const id = crypto.randomUUID()

      try {
        await client.create({ ...newDoc, _id: `drafts.${id}` })
        props.onComplete()
        // structureTool mounts at /structure in Sanity v3+ (the old /desk
        // route 404s) and addresses documents by their published id.
        if (typeof window !== 'undefined') {
          window.location.href = `/structure/product;${id}`
        }
      } catch (e) {
        console.error('Failed to duplicate as color:', e)
      }
    },
  }
}
