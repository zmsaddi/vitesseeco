import { defineType } from 'sanity'

export default defineType({
  name: 'paymentMethod',
  title: 'طريقة الدفع',
  type: 'document',
  icon: () => '💳',
  fields: [
    { name: 'name', title: '📝 الاسم', type: 'localizedString', description: 'اسم طريقة الدفع بكل اللغات' },
    {
      name: 'code',
      title: '🔖 رمز فريد',
      type: 'string',
      description: 'رمز البرمجة — لا تغيّره بعد الإنشاء',
      options: {
        list: [
          { title: '🏪 الدفع في المتجر', value: 'in_store' },
          { title: '💳 Stripe (بطاقة بنكية)', value: 'stripe' },
          { title: '🅿️ PayPal', value: 'paypal' },
          { title: '📱 Apple Pay', value: 'apple_pay' },
          { title: '📱 Google Pay', value: 'google_pay' },
          { title: '🏦 تحويل بنكي', value: 'bank_transfer' },
        ],
      },
    },
    { name: 'description', title: '📄 الوصف', type: 'localizedString', description: 'وصف قصير يظهر للعميل' },
    {
      name: 'icon',
      title: '🖼️ أيقونة',
      type: 'string',
      description: 'اسم الأيقونة — مثال: ph:credit-card, ph:storefront, ph:paypal-logo',
      options: {
        list: [
          { title: '🏪 متجر', value: 'ph:storefront' },
          { title: '💳 بطاقة', value: 'ph:credit-card' },
          { title: '🅿️ PayPal', value: 'ph:paypal-logo' },
          { title: '📱 هاتف', value: 'ph:device-mobile' },
          { title: '🏦 بنك', value: 'ph:bank' },
        ],
      },
    },
    { name: 'isActive', title: '✅ نشط', type: 'boolean', initialValue: false, description: 'فعّل لإظهار طريقة الدفع للعملاء' },
    { name: 'sortOrder', title: '🔢 الترتيب', type: 'number', initialValue: 0 },
    { name: 'instructions', title: '📋 تعليمات الدفع', type: 'localizedText', description: 'تعليمات تظهر للعميل بعد اختيار هذه الطريقة' },
  ],
  preview: {
    select: { title: 'name.fr', code: 'code', active: 'isActive' },
    prepare({ title, code, active }) {
      return {
        title: `${active ? '✅' : '❌'} ${title || code || 'طريقة دفع'}`,
        subtitle: code,
      }
    },
  },
})
