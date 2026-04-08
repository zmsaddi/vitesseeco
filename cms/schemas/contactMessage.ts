import { defineType } from 'sanity'

export default defineType({
  name: 'contactMessage',
  title: 'رسالة اتصال',
  type: 'document',
  icon: () => '✉️',
  fields: [
    { name: 'name', title: '👤 الاسم', type: 'string', readOnly: true },
    { name: 'email', title: '📧 البريد', type: 'string', readOnly: true },
    { name: 'subject', title: '📋 الموضوع', type: 'string', readOnly: true },
    { name: 'message', title: '💬 الرسالة', type: 'text', rows: 6, readOnly: true },
    { name: 'isRead', title: '✅ تمت القراءة', type: 'boolean', initialValue: false },
    { name: 'reply', title: '↩️ الرد', type: 'text', rows: 4, description: 'اكتب ردك هنا (للملاحظات الداخلية)' },
    { name: 'createdAt', title: '📅 التاريخ', type: 'datetime', readOnly: true },
  ],
  orderings: [
    { title: 'الأحدث', name: 'newest', by: [{ field: 'createdAt', direction: 'desc' }] },
  ],
  preview: {
    select: { title: 'subject', name: 'name', date: 'createdAt', read: 'isRead' },
    prepare({ title, name, date, read }) {
      const d = date ? new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
      return {
        title: `${read ? '✅' : '🔴'} ${title || 'بدون موضوع'}`,
        subtitle: `${name || '—'} | ${d}`,
      }
    },
  },
})
