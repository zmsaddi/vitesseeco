// @ts-nocheck — Sanity Studio types incompatible with Nuxt typecheck
/**
 * Document Action: "Duplicate as New Color"
 * Creates a copy of a product with color-specific fields cleared.
 * Keeps: modelFamily, brand, price, specifications, description, warranty, highlights, productType
 * Clears: name, slug, color, colorHex, images, stock, isNew, isFeatured, seo
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
        // CLEAR these fields (editor fills them)
        name: { fr: '', en: '', es: '', nl: '', de: '', ar: '' },
        color: { fr: '', en: '', es: '', nl: '', de: '', ar: '' },
        colorHex: '',
        stock: 0,
        isNew: false,
        isFeatured: false,
        images: [],
      }

      try {
        const created = await client.create(newDoc)
        // Navigate to the new document in Sanity Studio
        if (typeof window !== 'undefined') {
          window.location.href = `/desk/product;${created._id}`
        }
      } catch (e) {
        console.error('Failed to duplicate as color:', e)
      }
    },
  }
}
