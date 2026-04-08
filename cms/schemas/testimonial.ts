import { defineType } from 'sanity'

export default defineType({
  name: 'testimonial',
  title: 'شهادة عميل',
  type: 'document',
  icon: () => '⭐',
  fields: [
    { name: 'customerName', title: 'اسم العميل', type: 'string' },
    { name: 'rating', title: 'التقييم (1-5)', type: 'number', validation: (Rule) => Rule.min(1).max(5) },
    { name: 'text', title: 'الشهادة', type: 'localizedText' },
    { name: 'photo', title: 'صورة العميل', type: 'image' },
    { name: 'product', title: 'المنتج المشترى', type: 'reference', to: [{ type: 'product' }] },
  ],
  preview: {
    select: { title: 'customerName', subtitle: 'rating' },
    prepare({ title, subtitle }) {
      return { title, subtitle: subtitle ? '⭐'.repeat(subtitle) : '' }
    },
  },
})
