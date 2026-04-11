import { defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'منتج',
  type: 'document',
  icon: () => '🚲',
  groups: [
    { name: 'main', title: '📋 المنتج', default: true },
    { name: 'variants', title: '🎨 الألوان والصور' },
    { name: 'details', title: '⚙️ التفاصيل' },
  ],
  fields: [
    // ══════ TAB 1: المنتج (الأهم — كل شيء في صفحة واحدة) ══════
    {
      name: 'productType', title: 'النوع', type: 'string', group: 'main',
      options: {
        list: [
          { title: '🚲 دراجة', value: 'bike' },
          { title: '🔧 قطعة غيار', value: 'spare_part' },
          { title: '🎒 إكسسوار', value: 'accessory' },
          { title: '🧸 أطفال', value: 'kids_car' },
          { title: '📦 أخرى', value: 'other' },
        ],
        layout: 'radio',
        direction: 'horizontal',
      },
      initialValue: 'bike',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'name', title: 'الاسم', type: 'localizedString', group: 'main',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'slug', title: 'الرابط', type: 'slug',
      options: { source: 'name.fr', maxLength: 96 },
      group: 'main',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'price', title: 'السعر €', type: 'number', group: 'main',
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: 'compareAtPrice', title: 'السعر القديم €', type: 'number', group: 'main',
      description: 'اتركه فارغاً إذا لا يوجد تخفيض',
    },
    {
      name: 'brand', title: 'العلامة', type: 'reference', to: [{ type: 'brand' }], group: 'main',
    },
    {
      name: 'category', title: 'الفئة', type: 'reference', to: [{ type: 'category' }], group: 'main',
    },
    {
      name: 'shortDescription', title: 'وصف مختصر', type: 'localizedString', group: 'main',
    },
    // Status toggles — inline row
    {
      name: 'isAvailable', title: '✅ متاح', type: 'boolean', initialValue: true, group: 'main',
    },
    {
      name: 'isOnSale', title: '🏷️ تخفيض', type: 'boolean', initialValue: false, group: 'main',
    },
    {
      name: 'isNew', title: '✨ جديد', type: 'boolean', initialValue: false, group: 'main',
    },
    {
      name: 'isFeatured', title: '⭐ مميز', type: 'boolean', initialValue: false, group: 'main',
    },

    // ══════ TAB 2: الألوان والصور (الأهم بصرياً) ══════
    {
      name: 'variants', title: 'الألوان', type: 'array',
      of: [{ type: 'colorVariant' }],
      group: 'variants',
      validation: (Rule) => Rule.required().min(1),
    },

    // ══════ TAB 3: التفاصيل (وصف + مواصفات + SEO) ══════
    {
      name: 'description', title: 'الوصف الكامل', type: 'localizedText', group: 'details',
    },
    {
      name: 'warranty', title: 'الضمان', type: 'localizedString', group: 'details',
    },
    {
      name: 'highlights', title: 'نقاط القوة', type: 'array', group: 'details',
      of: [{ type: 'localizedString' }],
      validation: (Rule) => Rule.max(6),
    },
    {
      name: 'specifications', title: 'المواصفات', type: 'object', group: 'details',
      options: { collapsible: true, collapsed: false },
      fields: [
        { name: 'motor', title: 'المحرك', type: 'string' },
        { name: 'battery', title: 'البطارية', type: 'string' },
        { name: 'tireSize', title: 'الإطارات', type: 'string' },
        { name: 'range', title: 'المدى', type: 'localizedString' },
        { name: 'brakeType', title: 'الفرامل', type: 'localizedString' },
        { name: 'maxSpeed', title: 'السرعة القصوى', type: 'number' },
        { name: 'weight', title: 'الوزن (كغ)', type: 'number' },
        { name: 'chargeTime', title: 'وقت الشحن', type: 'localizedString' },
        { name: 'maxLoad', title: 'الحمولة (كغ)', type: 'number' },
        { name: 'dimensions', title: 'الأبعاد', type: 'string' },
        { name: 'suspension', title: 'التعليق', type: 'localizedString' },
        { name: 'frame', title: 'الهيكل', type: 'localizedString' },
        { name: 'gears', title: 'السرعات', type: 'localizedString' },
        { name: 'grossWeight', title: 'وزن التغليف', type: 'number' },
        { name: 'packingSize', title: 'حجم الصندوق', type: 'string' },
      ],
    },
    {
      name: 'videoUrl', title: 'رابط فيديو', type: 'url', group: 'details',
    },
    {
      name: 'relatedProducts', title: 'منتجات مشابهة', type: 'array', group: 'details',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
      validation: (Rule) => Rule.max(4),
    },
    {
      name: 'sortOrder', title: 'الترتيب', type: 'number', initialValue: 0, group: 'details',
    },
    { name: 'seo', title: 'SEO', type: 'seoFields', group: 'details' },
  ],
  preview: {
    select: {
      title: 'name.fr', price: 'price', available: 'isAvailable', onSale: 'isOnSale',
      isNew: 'isNew', type: 'productType', img: 'variants.0.images.0',
      v0: 'variants.0.stock', v1: 'variants.1.stock', v2: 'variants.2.stock',
      v3: 'variants.3.stock', v4: 'variants.4.stock',
    },
    prepare({ title, price, available, onSale, isNew, type, img, v0, v1, v2, v3, v4 }) {
      const stocks = [v0, v1, v2, v3, v4].filter(s => s !== undefined)
      const totalStock = stocks.reduce((a: number, b: number) => a + (b || 0), 0)
      const stockIcon = totalStock <= 0 ? '🔴' : totalStock <= 5 ? '🟡' : '🟢'
      const typeIcon: Record<string, string> = { bike: '🚲', spare_part: '🔧', accessory: '🎒', kids_car: '🧸' }
      const badges = [available === false ? '🚫' : '', onSale ? '🏷️' : '', isNew ? '✨' : ''].filter(Boolean).join('')

      return {
        title: `${stockIcon} ${title || '—'} ${badges}`,
        subtitle: `${typeIcon[type || ''] || '📦'} ${price || 0}€ | 📦 ${totalStock}`,
        media: img,
      }
    },
  },
})
