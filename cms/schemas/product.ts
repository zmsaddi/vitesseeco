import { defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'منتج',
  type: 'document',
  icon: () => '📦',
  groups: [
    { name: 'main', title: '📋 المنتج', default: true },
    { name: 'media', title: '📸 الصور' },
    { name: 'details', title: '⚙️ التفاصيل' },
  ],
  fields: [
    // ══════ TAB 1: المنتج ══════
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
      description: 'مثال: V20 Pro — Noir',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'slug', title: 'الرابط', type: 'slug', group: 'main',
      options: { source: 'name.fr', maxLength: 96 },
      description: 'اضغط Generate — يُنشئ الرابط تلقائياً',
      validation: (Rule) => Rule.required(),
    },
    {
      name: 'sku', title: '🏷️ SKU', type: 'string', group: 'main',
      description: 'رمز المنتج الفريد — حروف كبيرة وأرقام وشرطات (مثال: V20-PRO-NOIR)',
      validation: (Rule) => Rule.regex(/^[A-Z0-9-]+$/, { name: 'SKU format' }).error('حروف كبيرة وأرقام وشرطات فقط'),
    },
    {
      name: 'brand', title: 'العلامة', type: 'reference', to: [{ type: 'brand' }], group: 'main',
    },
    {
      name: 'price', title: 'السعر €', type: 'number', group: 'main',
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: 'compareAtPrice', title: 'السعر القديم €', type: 'number', group: 'main',
      description: 'يجب أن يكون أكبر من أو يساوي السعر الحالي',
      validation: (Rule) => Rule.custom((value, context) => {
        if (typeof value !== 'number') return true
        const doc = context.document as Record<string, unknown> | undefined
        const price = doc?.price as number | undefined
        if (typeof price === 'number' && value < price) {
          return 'السعر القديم يجب أن يكون أكبر من أو يساوي السعر الحالي'
        }
        return true
      }),
    },
    {
      name: 'color', title: '🎨 اللون', type: 'localizedString', group: 'main',
      description: 'مثال: Noir / Black / Negro / Zwart / Schwarz / أسود',
    },
    {
      name: 'colorHex', title: 'رمز اللون', type: 'string', group: 'main',
      description: '#000000 = أسود، #FFFFFF = أبيض، #8E8E8E = رمادي',
      validation: (Rule) => Rule.regex(/^#[0-9A-Fa-f]{6}$/, { name: 'hex' }).error('#RRGGBB'),
    },
    {
      name: 'stock', title: '📦 المخزون', type: 'number', initialValue: 0, group: 'main',
      validation: (Rule) => Rule.required().min(0),
    },
    {
      name: 'modelFamily', title: '🔗 عائلة الموديل', type: 'string', group: 'main',
      description: 'يربط نفس الموديل بألوان مختلفة — مثال: v20-pro (حروف صغيرة وأرقام وشرطات فقط)',
      validation: (Rule) => Rule.regex(/^[a-z0-9-]+$/, { name: 'model family format' }).error('استخدم حروف صغيرة وأرقام وشرطات فقط — مثال: v20-pro'),
    },
    {
      name: 'shortDescription', title: 'وصف مختصر', type: 'localizedString', group: 'main',
    },
    // Status
    { name: 'isAvailable', title: '✅ متاح', type: 'boolean', initialValue: true, group: 'main' },
    { name: 'isOnSale', title: '🏷️ تخفيض', type: 'boolean', initialValue: false, group: 'main' },
    { name: 'isNew', title: '✨ جديد', type: 'boolean', initialValue: false, group: 'main' },
    { name: 'isFeatured', title: '⭐ مميز', type: 'boolean', initialValue: false, group: 'main' },

    // ══════ TAB 2: الصور ══════
    {
      name: 'images', title: 'صور المنتج', type: 'array', group: 'media',
      of: [{ type: 'image', options: { hotspot: true } }],
      options: { layout: 'grid' },
      description: 'الصورة الأولى = الرئيسية. اسحب لإعادة الترتيب.',
      validation: (Rule) => Rule.min(1).error('صورة واحدة على الأقل'),
    },

    // ══════ TAB 3: التفاصيل ══════
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
      validation: (Rule) => Rule.custom((value, context) => {
        const doc = context.document as Record<string, unknown> | undefined
        if (doc?.productType === 'bike' && value) {
          const specs = value as Record<string, unknown>
          if (!specs.motor) return 'المحرك مطلوب للدراجات'
          if (!specs.battery) return 'البطارية مطلوبة للدراجات'
        }
        return true
      }),
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
      name: 'category', title: 'الفئة', type: 'reference', to: [{ type: 'category' }], group: 'details',
    },
    {
      name: 'videoUrl', title: 'رابط فيديو', type: 'url', group: 'details',
    },
    {
      name: 'sortOrder', title: 'الترتيب', type: 'number', initialValue: 0, group: 'details',
    },
    { name: 'seo', title: 'SEO', type: 'seoFields', group: 'details' },
  ],
  preview: {
    select: {
      title: 'name.fr', price: 'price', available: 'isAvailable', onSale: 'isOnSale',
      isNew: 'isNew', type: 'productType', stock: 'stock', hex: 'colorHex',
      img: 'images.0', brand: 'brand.name',
    },
    prepare({ title, price, available, onSale, isNew, type, stock, hex, img, brand }) {
      const stockIcon = !stock || stock <= 0 ? '🔴' : stock <= 5 ? '🟡' : '🟢'
      const typeIcon: Record<string, string> = { bike: '🚲', spare_part: '🔧', accessory: '🎒', kids_car: '🧸' }
      const badges = [available === false ? '🚫' : '', onSale ? '🏷️' : '', isNew ? '✨' : ''].filter(Boolean).join('')

      return {
        title: `${stockIcon} ${title || '—'} ${badges}`,
        subtitle: `${typeIcon[type || ''] || '📦'} ${brand || ''} | ${price || 0}€ | 📦 ${stock || 0}`,
        media: img,
      }
    },
  },
  orderings: [
    { title: 'الاسم', name: 'name', by: [{ field: 'name.fr', direction: 'asc' }] },
    { title: 'السعر ↑', name: 'priceAsc', by: [{ field: 'price', direction: 'asc' }] },
    { title: 'السعر ↓', name: 'priceDesc', by: [{ field: 'price', direction: 'desc' }] },
    { title: 'المخزون', name: 'stock', by: [{ field: 'stock', direction: 'asc' }] },
  ],
})
