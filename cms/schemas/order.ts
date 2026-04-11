import { defineType } from 'sanity'

export default defineType({
  name: 'order',
  title: 'طلب',
  type: 'document',
  icon: () => '🛒',
  fields: [
    {
      name: 'orderNumber',
      title: '📋 رقم الطلب',
      type: 'string',
      readOnly: true,
    },
    {
      name: 'status',
      title: '📊 حالة الطلب',
      type: 'string',
      options: {
        list: [
          { title: '⏳ في انتظار الدفع', value: 'pending' },
          { title: '💳 مدفوع', value: 'paid' },
          { title: '📦 قيد التحضير', value: 'processing' },
          { title: '🚚 تم الشحن', value: 'shipped' },
          { title: '✅ تم التوصيل', value: 'delivered' },
          { title: '🔄 مرتجع', value: 'returned' },
          { title: '💸 مسترد', value: 'refunded' },
          { title: '❌ ملغى', value: 'cancelled' },
        ],
        layout: 'radio',
      },
      initialValue: 'pending',
    },
    {
      name: 'paymentMethod',
      title: '💰 طريقة الدفع',
      type: 'string',
      options: {
        list: [
          { title: '🏪 الدفع في المتجر', value: 'in_store' },
          { title: '💳 بطاقة بنكية (Stripe)', value: 'stripe' },
        ],
      },
    },
    {
      name: 'customer',
      title: '👤 العميل',
      type: 'object',
      fields: [
        { name: 'name', title: 'الاسم', type: 'string', readOnly: true },
        { name: 'email', title: 'البريد', type: 'string', readOnly: true },
        { name: 'phone', title: 'الهاتف', type: 'string', readOnly: true },
        { name: 'customerId', title: 'معرف العميل', type: 'string', readOnly: true, hidden: true },
      ],
    },
    {
      name: 'shippingAddress',
      title: '📍 عنوان الشحن',
      type: 'object',
      fields: [
        { name: 'firstName', title: 'الاسم الأول', type: 'string', readOnly: true },
        { name: 'lastName', title: 'اسم العائلة', type: 'string', readOnly: true },
        { name: 'address', title: 'العنوان', type: 'string', readOnly: true },
        { name: 'city', title: 'المدينة', type: 'string', readOnly: true },
        { name: 'postalCode', title: 'الرمز البريدي', type: 'string', readOnly: true },
        { name: 'country', title: 'البلد', type: 'string', readOnly: true },
        { name: 'phone', title: 'هاتف التوصيل', type: 'string', readOnly: true },
      ],
    },
    {
      name: 'billingAddress',
      title: '🧾 عنوان الفوترة',
      type: 'object',
      fields: [
        { name: 'firstName', title: 'الاسم الأول', type: 'string', readOnly: true },
        { name: 'lastName', title: 'اسم العائلة', type: 'string', readOnly: true },
        { name: 'address', title: 'العنوان', type: 'string', readOnly: true },
        { name: 'city', title: 'المدينة', type: 'string', readOnly: true },
        { name: 'postalCode', title: 'الرمز البريدي', type: 'string', readOnly: true },
        { name: 'country', title: 'البلد', type: 'string', readOnly: true },
      ],
    },
    {
      name: 'shippingMethod',
      title: '🚚 طريقة الشحن',
      type: 'string',
      readOnly: true,
    },
    {
      name: 'items',
      title: '🛍️ المنتجات',
      type: 'array',
      readOnly: true,
      of: [{
        type: 'object',
        fields: [
          { name: 'productName', title: 'المنتج', type: 'string' },
          { name: 'color', title: 'اللون', type: 'string' },
          { name: 'sku', title: 'SKU', type: 'string' },
          { name: 'quantity', title: 'الكمية', type: 'number' },
          { name: 'price', title: 'السعر', type: 'number' },
        ],
        preview: {
          select: { title: 'productName', quantity: 'quantity', price: 'price', color: 'color' },
          prepare({ title, quantity, price, color }) {
            return { title: `${title} (${color})`, subtitle: `${quantity} × ${price}€ = ${quantity * price}€` }
          },
        },
      }],
    },
    {
      name: 'subtotal',
      title: '💶 المجموع الفرعي',
      type: 'number',
      readOnly: true,
    },
    {
      name: 'shippingCost',
      title: '🚚 تكلفة الشحن',
      type: 'number',
      readOnly: true,
    },
    {
      name: 'discount',
      title: '🏷️ الخصم',
      type: 'number',
      readOnly: true,
    },
    {
      name: 'total',
      title: '💰 المجموع الكلي',
      type: 'number',
      readOnly: true,
    },
    {
      name: 'promoCode',
      title: '🎟️ كود الخصم',
      type: 'string',
      readOnly: true,
    },
    {
      name: 'statusHistory',
      title: '📜 سجل الحالات',
      type: 'array',
      readOnly: true,
      of: [{
        type: 'object',
        fields: [
          { name: 'status', title: 'الحالة', type: 'string' },
          { name: 'changedAt', title: 'التاريخ', type: 'datetime' },
          { name: 'note', title: 'ملاحظة', type: 'string' },
        ],
        preview: {
          select: { status: 'status', date: 'changedAt', note: 'note' },
          prepare({ status, date, note }) {
            const statusMap: Record<string, string> = { pending: '⏳', paid: '💳', processing: '📦', shipped: '🚚', delivered: '✅', cancelled: '❌' }
            const d = date ? new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''
            return { title: `${statusMap[status] || '❓'} ${status}`, subtitle: `${d} ${note || ''}` }
          },
        },
      }],
    },
    {
      name: 'trackingNumber',
      title: '📦 رقم التتبع',
      type: 'string',
      description: 'أدخل رقم التتبع عند شحن الطلب',
    },
    {
      name: 'notes',
      title: '📝 ملاحظات',
      type: 'text',
      rows: 3,
      description: 'ملاحظات داخلية (لا يراها العميل)',
    },
    {
      name: 'stripePaymentId',
      title: 'Stripe Payment ID',
      type: 'string',
      readOnly: true,
      hidden: true,
    },
    {
      name: 'createdAt',
      title: '📅 تاريخ الطلب',
      type: 'datetime',
      readOnly: true,
    },
  ],
  orderings: [
    { title: 'الأحدث أولاً', name: 'createdAtDesc', by: [{ field: 'createdAt', direction: 'desc' }] },
    { title: 'الأقدم أولاً', name: 'createdAtAsc', by: [{ field: 'createdAt', direction: 'asc' }] },
  ],
  preview: {
    select: { title: 'orderNumber', status: 'status', total: 'total', customer: 'customer.name', date: 'createdAt', payment: 'paymentMethod', shipping: 'shippingMethod' },
    prepare({ title, status, total, customer, date, payment, shipping }) {
      const statusMap: Record<string, string> = {
        pending: '🔴 جديد', paid: '💳 مدفوع', processing: '📦 تحضير', shipped: '🚚 شُحن', delivered: '✅ وصل', cancelled: '❌ ملغى',
      }
      const payMap: Record<string, string> = { in_store: '🏪', stripe: '💳', paypal: '🅿️', bank_transfer: '🏦' }
      const d = date ? new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
      return {
        title: `${statusMap[status] || '❓'} — ${total || 0}€`,
        subtitle: `${title || ''} | ${customer || 'زائر'} | ${payMap[payment] || ''} ${shipping || ''} | ${d}`,
      }
    },
  },
})
