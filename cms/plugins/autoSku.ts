import { definePlugin } from 'sanity'
import { useEffect } from 'react'

/**
 * Auto-generates SKU for color variants when empty.
 * Format: PRODUCT-SLUG-COLOR-NAME (uppercase, max 30 chars)
 * Runs as a document-level component on product documents.
 */
function AutoSkuComponent(props: any) {
  const { document, onChange } = props

  useEffect(() => {
    if (document?._type !== 'product') return
    if (!document?.variants?.length) return

    const slug = document?.slug?.current || ''
    if (!slug) return

    let changed = false
    const updatedVariants = document.variants.map((v: any, i: number) => {
      if (v.sku) return v // Already has SKU

      // Generate SKU from slug + color name
      const color = (v.colorName?.fr || v.colorName?.en || v.colorHex || `V${i}`)
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '')
        .slice(0, 8)

      const base = slug
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '-')
        .replace(/-+/g, '-')
        .slice(0, 18)

      const sku = `${base}-${color}`.slice(0, 30)
      changed = true
      return { ...v, sku }
    })

    if (changed && onChange) {
      onChange([{ type: 'set', path: ['variants'], value: updatedVariants }])
    }
  }, [document?.slug?.current, document?.variants?.length])

  return null
}

export const autoSkuPlugin = definePlugin({
  name: 'auto-sku',
  // This hooks into the form to auto-fill SKUs
})
