import { defineType } from 'sanity'

export default defineType({
  name: 'colorVariant',
  title: 'لون',
  type: 'object',
  fields: [
    {
      name: 'colorHex', title: 'اللون', type: 'string',
      validation: (Rule) => Rule.required()
        .regex(/^#[0-9A-Fa-f]{6}$/, { name: 'hex color' })
        .error('#RRGGBB مثل #000000'),
    },
    {
      name: 'colorName', title: 'اسم اللون', type: 'localizedString',
    },
    {
      name: 'sku', title: 'SKU', type: 'string',
      validation: (Rule) => Rule.required().error('SKU مطلوب'),
    },
    {
      name: 'stock', title: 'المخزون', type: 'number', initialValue: 0,
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: 'images', title: 'الصور', type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      options: { layout: 'grid' },
      validation: (Rule) => Rule.required().min(1).error('صورة واحدة على الأقل'),
    },
    {
      name: 'priceOverride', title: 'سعر خاص (اختياري)', type: 'number',
      validation: (Rule) => Rule.min(0),
    },
  ],
  preview: {
    select: { title: 'colorName.fr', sku: 'sku', stock: 'stock', hex: 'colorHex', img: 'images.0' },
    prepare({ title, sku, stock, hex, img }) {
      const stockIcon = stock > 5 ? '🟢' : stock > 0 ? '🟡' : '🔴'
      return {
        title: `${title || hex || 'لون'} — ${stockIcon} ${stock ?? 0}`,
        subtitle: sku || '',
        media: img,
      }
    },
  },
})
