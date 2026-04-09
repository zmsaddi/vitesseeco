import { defineType } from 'sanity'

export default defineType({
  name: 'brand',
  title: 'علامة تجارية',
  type: 'document',
  icon: () => '🏷️',
  fields: [
    {
      name: 'name', title: 'اسم العلامة التجارية', type: 'string',
      validation: (Rule) => Rule.required().error('اسم العلامة التجارية مطلوب'),
    },
    {
      name: 'slug', title: 'رابط URL', type: 'slug', options: { source: 'name', maxLength: 96 },
      validation: (Rule) => Rule.required().error('رابط العلامة مطلوب'),
    },
    { name: 'logo', title: 'الشعار', type: 'image' },
    { name: 'description', title: 'الوصف', type: 'localizedText' },
  ],
  preview: {
    select: { title: 'name', media: 'logo' },
  },
})
