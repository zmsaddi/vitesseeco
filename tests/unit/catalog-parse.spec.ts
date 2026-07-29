import { describe, expect, it, vi } from 'vitest'
import {
  parseBrand,
  parseCategory,
  parseProductDetail,
  parseProductSummary,
  parsePromo,
  parseShippingMethod,
  translate,
} from '../../server/catalog/parse'

const availability = new Map<string, number>([['p1', 3]])
const context = { locale: 'fr' as const, availability }

const VALID_PRODUCT = {
  _id: 'p1',
  slug: 'v20-pro-noir',
  name: { fr: 'V20 Pro — Noir', en: 'V20 Pro — Black' },
  price: 950,
  productType: 'bike',
  color: { fr: 'Noir' },
  colorHex: '#000000',
  modelFamily: 'v20-pro',
  brand: { slug: 'qmwheel', name: { fr: 'QMWheel' } },
  category: { slug: 'velos', name: { fr: 'Vélos' } },
  image: { url: 'https://cdn.sanity.io/x.jpg', alt: 'V20', width: 1200, height: 900, lqip: 'data:x' },
}

describe('translate', () => {
  it('returns the requested language', () => {
    expect(translate({ fr: 'Noir', en: 'Black' }, 'en')).toBe('Black')
  })

  it('falls back to the default locale rather than showing nothing', () => {
    expect(translate({ fr: 'Noir' }, 'de')).toBe('Noir')
  })

  it('falls back to any language that has content', () => {
    // A German visitor is better served a Dutch product name than a blank heading.
    expect(translate({ nl: 'Zwart' }, 'de')).toBe('Zwart')
  })

  it('treats blank and whitespace as absent', () => {
    expect(translate({ de: '   ', fr: 'Noir' }, 'de')).toBe('Noir')
    expect(translate({ de: '' }, 'de')).toBeNull()
  })

  it('handles a missing field entirely', () => {
    expect(translate(null, 'fr')).toBeNull()
    expect(translate(undefined, 'fr')).toBeNull()
  })

  it('trims what it returns', () => {
    expect(translate({ fr: '  Noir  ' }, 'fr')).toBe('Noir')
  })
})

describe('parseProductSummary', () => {
  it('parses a well-formed product', () => {
    const product = parseProductSummary(VALID_PRODUCT, context)
    expect(product).toMatchObject({
      id: 'p1',
      slug: 'v20-pro-noir',
      name: 'V20 Pro — Noir',
      productType: 'bike',
      color: 'Noir',
      available: 3,
    })
  })

  it('converts the authored euro price into cents', () => {
    expect(parseProductSummary({ ...VALID_PRODUCT, price: 19.99 }, context)?.price).toBe(1999)
    expect(parseProductSummary({ ...VALID_PRODUCT, price: 950 }, context)?.price).toBe(95000)
  })

  it('takes availability from Postgres, and defaults to zero', () => {
    // The catalogue holds no stock at all — a document store cannot decrement
    // anything atomically, so it does not get to decide what is sellable.
    expect(parseProductSummary({ ...VALID_PRODUCT, _id: 'unknown' }, context)?.available).toBe(0)
  })

  it('ignores a stock field even if one is present in the document', () => {
    const product = parseProductSummary({ ...VALID_PRODUCT, stock: 999 }, context)
    expect(product?.available).toBe(3)
  })

  describe('malformed documents are dropped, not propagated', () => {
    it('drops a product with no slug — one of these took down the whole sitemap', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const { slug, ...withoutSlug } = VALID_PRODUCT
      expect(parseProductSummary(withoutSlug, context)).toBeNull()
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })

    it('drops a product with no name in any language', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(parseProductSummary({ ...VALID_PRODUCT, name: {} }, context)).toBeNull()
      expect(parseProductSummary({ ...VALID_PRODUCT, name: null }, context)).toBeNull()
      warn.mockRestore()
    })

    it('drops a product with a null or negative price', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(parseProductSummary({ ...VALID_PRODUCT, price: null }, context)).toBeNull()
      expect(parseProductSummary({ ...VALID_PRODUCT, price: -10 }, context)).toBeNull()
      warn.mockRestore()
    })

    it('drops entirely unrecognisable input rather than throwing', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      for (const junk of [null, undefined, 'a string', 42, {}, []]) {
        expect(parseProductSummary(junk, context)).toBeNull()
      }
      warn.mockRestore()
    })
  })

  describe('tolerated gaps', () => {
    it('accepts a product with no image', () => {
      const product = parseProductSummary({ ...VALID_PRODUCT, image: null }, context)
      expect(product?.image).toBeNull()
      expect(product?.name).toBe('V20 Pro — Noir')
    })

    it('accepts a product with no brand, category, colour or family', () => {
      const product = parseProductSummary(
        { ...VALID_PRODUCT, brand: null, category: null, color: null, modelFamily: null },
        context
      )
      expect(product).toMatchObject({ brand: null, category: null, color: null, modelFamily: null })
    })

    it('falls back to a safe product type rather than dropping the product', () => {
      expect(parseProductSummary({ ...VALID_PRODUCT, productType: 'nonsense' }, context)?.productType).toBe('other')
      expect(parseProductSummary({ ...VALID_PRODUCT, productType: null }, context)?.productType).toBe('other')
    })

    it('uses the product name as image alt text when none was written', () => {
      const product = parseProductSummary(
        { ...VALID_PRODUCT, image: { ...VALID_PRODUCT.image, alt: '' } },
        context
      )
      expect(product?.image?.alt).toBe('V20 Pro — Noir')
    })
  })

  describe('compareAtPrice', () => {
    it('is kept when it is genuinely higher', () => {
      const product = parseProductSummary({ ...VALID_PRODUCT, compareAtPrice: 1200 }, context)
      expect(product?.compareAtPrice).toBe(120000)
    })

    it('is discarded when it would advertise a discount that does not exist', () => {
      // A mis-keyed old price must never render as a strike-through saving.
      expect(parseProductSummary({ ...VALID_PRODUCT, compareAtPrice: 900 }, context)?.compareAtPrice).toBeNull()
      expect(parseProductSummary({ ...VALID_PRODUCT, compareAtPrice: 950 }, context)?.compareAtPrice).toBeNull()
      expect(parseProductSummary({ ...VALID_PRODUCT, compareAtPrice: null }, context)?.compareAtPrice).toBeNull()
    })
  })
})

describe('parseProductDetail', () => {
  const DETAIL = {
    ...VALID_PRODUCT,
    sku: 'V20-PRO-NOIR',
    description: { fr: 'Un vélo.' },
    highlights: [{ fr: 'Autonomie 100 km' }, { fr: 'Freins hydrauliques' }, { de: null }],
    images: [VALID_PRODUCT.image, null, { url: 'https://cdn.sanity.io/y.jpg' }],
    specifications: { motor: '250W', range: { fr: '100 km' }, maxSpeed: 25 },
  }

  it('parses details and keeps the summary fields', () => {
    const product = parseProductDetail(DETAIL, context, [])
    expect(product).toMatchObject({
      sku: 'V20-PRO-NOIR',
      description: 'Un vélo.',
      price: 95000,
    })
    expect(product?.specifications.motor).toBe('250W')
    expect(product?.specifications.range).toBe('100 km')
  })

  it('drops highlights and images that carry nothing usable', () => {
    const product = parseProductDetail(DETAIL, context, [])
    expect(product?.highlights).toEqual(['Autonomie 100 km', 'Freins hydrauliques'])
    expect(product?.images).toHaveLength(2)
  })

  it('returns a complete specifications object even when none was written', () => {
    // Consumers read spec fields directly; they must never be undefined.
    const product = parseProductDetail({ ...DETAIL, specifications: null }, context, [])
    expect(product?.specifications).toMatchObject({ motor: null, battery: null, maxSpeed: null })
  })

  it('carries siblings through', () => {
    const sibling = parseProductSummary({ ...VALID_PRODUCT, _id: 'p2', slug: 'v20-pro-blanc' }, context)
    const product = parseProductDetail(DETAIL, context, [sibling!])
    expect(product?.siblings).toHaveLength(1)
  })
})

describe('parseShippingMethod', () => {
  const METHOD = {
    code: 'own-fleet-fr',
    name: { fr: 'Livraison par nos soins' },
    price: 0,
    zones: ['fr'],
    postalCodePrefixes: ['86 '],
    sortOrder: 1,
  }

  it('normalises countries and postal prefixes for matching', () => {
    const method = parseShippingMethod(METHOD, 'fr')
    expect(method?.countries).toEqual(['FR'])
    expect(method?.postalPrefixes).toEqual(['86'])
  })

  it('converts prices to cents', () => {
    const method = parseShippingMethod({ ...METHOD, price: 9.9, freeAbove: 500 }, 'fr')
    expect(method?.price).toBe(990)
    expect(method?.freeAbove).toBe(50000)
  })

  it('drops a method with no name in any language', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseShippingMethod({ ...METHOD, name: {} }, 'fr')).toBeNull()
    warn.mockRestore()
  })
})

describe('parsePromo', () => {
  const PROMO = {
    code: ' welcome10 ',
    discountType: 'percentage',
    discountValue: 10,
    isActive: true,
  }

  it('normalises the code so lookup is case-insensitive', () => {
    expect(parsePromo(PROMO)?.code).toBe('WELCOME10')
  })

  it('keeps a percentage as a percentage and a fixed amount as cents', () => {
    expect(parsePromo(PROMO)?.value).toBe(10)
    expect(parsePromo({ ...PROMO, discountType: 'fixed', discountValue: 25 })?.value).toBe(2500)
  })

  it('refuses a percentage above 100', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parsePromo({ ...PROMO, discountValue: 150 })).toBeNull()
    warn.mockRestore()
  })

  it('refuses a zero or negative discount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parsePromo({ ...PROMO, discountValue: 0 })).toBeNull()
    expect(parsePromo({ ...PROMO, discountValue: -5 })).toBeNull()
    warn.mockRestore()
  })

  it('treats a missing isActive as inactive', () => {
    const { isActive, ...withoutFlag } = PROMO
    expect(parsePromo(withoutFlag)?.isActive).toBe(false)
  })
})

describe('parseCategory and parseBrand', () => {
  it('parses a category', () => {
    const category = parseCategory(
      { _id: 'c1', slug: 'velos', name: { fr: 'Vélos' }, description: { fr: 'Nos vélos' } },
      'fr'
    )
    expect(category).toMatchObject({ slug: 'velos', name: 'Vélos', description: 'Nos vélos' })
  })

  it('drops a category with no slug', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    expect(parseCategory({ _id: 'c1', name: { fr: 'Vélos' } }, 'fr')).toBeNull()
    warn.mockRestore()
  })

  it('parses a brand', () => {
    expect(parseBrand({ _id: 'b1', slug: 'qmwheel', name: 'QMWheel' })).toMatchObject({
      slug: 'qmwheel',
      name: 'QMWheel',
    })
  })
})
