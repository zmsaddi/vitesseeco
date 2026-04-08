import { defineType } from 'sanity'

export default defineType({
  name: 'product',
  title: 'منتج',
  type: 'document',
  icon: () => '🚲',
  groups: [
    { name: 'general', title: 'عام', default: true },
    { name: 'media', title: 'الصور' },
    { name: 'pricing', title: 'السعر والمخزون' },
    { name: 'specs', title: 'المواصفات التقنية' },
    { name: 'variants', title: 'الألوان' },
    { name: 'seo', title: 'SEO' },
  ],
  fields: [
    // === عام ===
    { name: 'name', title: 'اسم الموديل', type: 'localizedString', group: 'general' },
    {
      name: 'slug',
      title: 'رابط URL',
      type: 'slug',
      options: { source: 'name.fr', maxLength: 96 },
      group: 'general',
    },
    { name: 'brand', title: 'العلامة التجارية', type: 'reference', to: [{ type: 'brand' }], group: 'general' },
    { name: 'category', title: 'الفئة', type: 'reference', to: [{ type: 'category' }], group: 'general' },
    { name: 'shortDescription', title: 'وصف مختصر', type: 'localizedString', group: 'general' },
    { name: 'description', title: 'وصف كامل', type: 'localizedText', group: 'general' },

    // === الصور ===
    { name: 'mainImage', title: 'الصورة الرئيسية', type: 'image', options: { hotspot: true }, group: 'media' },
    {
      name: 'gallery',
      title: 'معرض الصور',
      type: 'array',
      of: [{ type: 'image', options: { hotspot: true } }],
      group: 'media',
    },

    // === السعر ===
    { name: 'price', title: 'السعر (€)', type: 'number', group: 'pricing' },
    { name: 'compareAtPrice', title: 'السعر القديم المشطوب (€)', type: 'number', group: 'pricing', description: 'اتركه فارغاً إذا لم يكن في تخفيض' },
    { name: 'isOnSale', title: 'في التخفيض', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'isAvailable', title: 'متاح للبيع', type: 'boolean', initialValue: true, group: 'pricing' },
    { name: 'isFeatured', title: 'مميز (الصفحة الرئيسية)', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'isNew', title: 'منتج جديد', type: 'boolean', initialValue: false, group: 'pricing' },
    { name: 'sortOrder', title: 'ترتيب العرض', type: 'number', initialValue: 0, group: 'pricing' },

    // === المواصفات ===
    {
      name: 'specifications',
      title: 'المواصفات التقنية',
      type: 'object',
      group: 'specs',
      fields: [
        { name: 'motor', title: 'المحرك', type: 'string', description: 'مثال: 250W' },
        { name: 'battery', title: 'البطارية', type: 'string', description: 'مثال: 48V 15.6AH' },
        { name: 'tireSize', title: 'مقاس الإطارات', type: 'string', description: 'مثال: 20" x 4.0"' },
        { name: 'maxLoad', title: 'الحمولة القصوى (كغ)', type: 'number' },
        { name: 'range', title: 'المدى', type: 'string', description: 'مثال: 40-50 كم' },
        { name: 'brakeType', title: 'نوع الفرامل', type: 'string' },
        { name: 'weight', title: 'الوزن الصافي (كغ)', type: 'number' },
        { name: 'grossWeight', title: 'الوزن الإجمالي (كغ)', type: 'number' },
        { name: 'dimensions', title: 'الأبعاد (مفتوح)', type: 'string' },
        { name: 'packingSize', title: 'الأبعاد (مغلف)', type: 'string' },
        { name: 'maxSpeed', title: 'السرعة القصوى (كم/س)', type: 'number' },
        { name: 'suspension', title: 'نظام التعليق', type: 'string' },
        { name: 'frame', title: 'الإطار', type: 'string' },
        { name: 'chargeTime', title: 'وقت الشحن (ساعة)', type: 'string' },
        { name: 'gears', title: 'السرعات', type: 'string' },
      ],
    },

    // === الألوان ===
    {
      name: 'variants',
      title: 'متغيرات اللون',
      type: 'array',
      of: [{ type: 'colorVariant' }],
      group: 'variants',
    },

    // === SEO ===
    { name: 'seo', title: 'SEO', type: 'seoFields', group: 'seo' },
    {
      name: 'relatedProducts',
      title: 'منتجات مرتبطة',
      type: 'array',
      of: [{ type: 'reference', to: [{ type: 'product' }] }],
      group: 'general',
    },
  ],
  preview: {
    select: { title: 'name.fr', media: 'mainImage', price: 'price', available: 'isAvailable' },
    prepare({ title, media, price, available }) {
      return {
        title: title || 'بدون اسم',
        subtitle: `${price ? price + ' €' : 'السعر غير محدد'} ${available === false ? '— غير متاح' : ''}`,
        media,
      }
    },
  },
})
