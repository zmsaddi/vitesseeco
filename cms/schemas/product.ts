import { defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'منتج',
  type: 'document',
  icon: () => '🚲',
  groups: [
    { name: 'general', title: '📋 المعلومات الأساسية', default: true },
    { name: 'pricing', title: '💰 السعر والحالة' },
    { name: 'variants', title: '🎨 الألوان والصور' },
    { name: 'specs', title: '⚙️ المواصفات التقنية' },
    { name: 'seo', title: '🔍 SEO' },
  ],
  fields: [
    // === المعلومات الأساسية ===
    {
      name: 'name', title: '📝 اسم الموديل', type: 'localizedString', group: 'general',
      description: 'اكتب اسم المنتج بكل اللغات',
    },
    {
      name: 'slug', title: '🔗 رابط المنتج', type: 'slug',
      options: { source: 'name.fr', maxLength: 96 },
      group: 'general',
      description: 'اضغط "Generate" لإنشاء الرابط تلقائياً من الاسم الفرنسي',
    },
    {
      name: 'brand', title: '🏷️ العلامة التجارية', type: 'reference', to: [{ type: 'brand' }], group: 'general',
    },
    {
      name: 'category', title: '📂 الفئة', type: 'reference', to: [{ type: 'category' }], group: 'general',
      description: 'اختر: حضري، طرق وعرة، قابل للطي، نسائي، أو مدى طويل',
    },
    {
      name: 'shortDescription', title: '📄 وصف مختصر', type: 'localizedString', group: 'general',
      description: 'سطر واحد يظهر في بطاقة المنتج',
    },
    {
      name: 'description', title: '📃 وصف تفصيلي', type: 'localizedText', group: 'general',
      description: 'الوصف الكامل الذي يظهر في صفحة المنتج',
    },
    {
      name: 'relatedProducts', title: '🔄 منتجات مشابهة', type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
      group: 'general',
      description: 'اختر 2-3 منتجات تظهر في "قد يعجبك أيضاً"',
    },

    // === السعر والحالة ===
    {
      name: 'price', title: '💶 السعر (€)', type: 'number', group: 'pricing',
      description: 'السعر الحالي بالأورو',
    },
    {
      name: 'compareAtPrice', title: '💶 السعر القديم (€)', type: 'number', group: 'pricing',
      description: 'يظهر مشطوباً بجانب السعر الجديد. اتركه فارغاً إذا لا يوجد تخفيض',
    },
    {
      name: 'isOnSale', title: '🏷️ في التخفيض؟', type: 'boolean', initialValue: false, group: 'pricing',
      description: 'فعّله لعرض علامة "تخفيض" على المنتج',
    },
    {
      name: 'isNew', title: '✨ منتج جديد؟', type: 'boolean', initialValue: false, group: 'pricing',
      description: 'فعّله لعرض علامة "جديد" على المنتج',
    },
    {
      name: 'isFeatured', title: '⭐ عرض في الصفحة الرئيسية؟', type: 'boolean', initialValue: false, group: 'pricing',
      description: 'فعّله ليظهر المنتج في قسم "موديلاتنا المميزة"',
    },
    {
      name: 'isAvailable', title: '✅ متاح للبيع؟', type: 'boolean', initialValue: true, group: 'pricing',
      description: 'أوقفه لإخفاء المنتج من الموقع',
    },
    {
      name: 'sortOrder', title: '🔢 ترتيب العرض', type: 'number', initialValue: 0, group: 'pricing',
      description: 'رقم أصغر = يظهر أولاً (مثال: 1, 2, 3...)',
    },

    // === الألوان والصور ===
    {
      name: 'variants', title: '🎨 الألوان المتاحة', type: 'array',
      of: [{ type: 'colorVariant' }],
      group: 'variants',
      description: 'أضف كل لون متاح مع صوره ومخزونه. أول لون = يظهر كلون افتراضي',
    },

    // === المواصفات التقنية ===
    {
      name: 'specifications', title: '⚙️ المواصفات', type: 'object', group: 'specs',
      description: 'املأ المواصفات التقنية — تظهر في جدول المواصفات بصفحة المنتج',
      fields: [
        { name: 'motor', title: 'المحرك', type: 'string', description: 'مثال: 250W' },
        { name: 'battery', title: 'البطارية', type: 'string', description: 'مثال: 48V 15.6AH' },
        { name: 'tireSize', title: 'مقاس الإطارات', type: 'string', description: 'مثال: 20"' },
        { name: 'range', title: 'المدى', type: 'string', description: 'مثال: 40-50 كم' },
        { name: 'brakeType', title: 'الفرامل', type: 'string', description: 'مثال: فرامل هيدروليكية' },
        { name: 'maxSpeed', title: 'السرعة القصوى (كم/س)', type: 'number' },
        { name: 'weight', title: 'الوزن (كغ)', type: 'number' },
        { name: 'chargeTime', title: 'وقت الشحن', type: 'string', description: 'مثال: 4-6 ساعات' },
        { name: 'maxLoad', title: 'الحمولة القصوى (كغ)', type: 'number' },
        { name: 'dimensions', title: 'الأبعاد', type: 'string' },
        { name: 'suspension', title: 'نظام التعليق', type: 'string' },
        { name: 'frame', title: 'الهيكل', type: 'string' },
        { name: 'gears', title: 'السرعات', type: 'string' },
        { name: 'grossWeight', title: 'الوزن مع التغليف (كغ)', type: 'number' },
        { name: 'packingSize', title: 'حجم الصندوق', type: 'string' },
      ],
    },

    // === SEO ===
    { name: 'seo', title: '🔍 SEO', type: 'seoFields', group: 'seo' },
  ],
  preview: {
    select: { title: 'name.fr', price: 'price', available: 'isAvailable', onSale: 'isOnSale' },
    prepare({ title, price, available, onSale }) {
      const badges = []
      if (available === false) badges.push('❌ مخفي')
      if (onSale) badges.push('🏷️ تخفيض')
      return {
        title: title || 'بدون اسم',
        subtitle: `${price ? price + '€' : '—'} ${badges.join(' ')}`,
      }
    },
  },
})
