/**
 * What the owner is told about an order, read from a real one.
 *
 * The privacy policy promises that the alert sent through Telegram and Resend
 * carries no name, email, phone or street — both are outside the European
 * Union, and that promise is what makes them acceptable recipients. The alert
 * is built from the stored order by `orderMessage`, so this is where the
 * promise is kept or broken: against a real row, through the real query.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { orderMessage, renderEmail, renderTelegram, reportPaymentOnClosedOrder } from '../../server/services/notify'
import { closePool, hasDatabase, resetDatabase, seedOrder, testDb } from './setup'

async function orderNumberOf(id: string): Promise<string> {
  const rows = await testDb().execute<{ order_number: string }>(sql`SELECT order_number FROM orders WHERE id = ${id}`)
  return rows.rows[0]?.order_number as string
}

async function everythingSentAbout(orderNumber: string): Promise<string> {
  const message = await orderMessage(orderNumber, 'placed')
  if (!message) throw new Error(`no message for ${orderNumber}`)
  const email = renderEmail(message)
  return [renderTelegram(message), email.subject, email.text].join('\n')
}

describe.skipIf(!hasDatabase)('what the owner is told about an order', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('points at the order without saying who placed it', async () => {
    const orderNumber = await orderNumberOf(
      await seedOrder({
        paymentMethod: 'cod',
        customerSnapshot: { name: 'Max Mustermann', email: 'max@example.com', phone: '+33612345678' },
        shippingAddress: {
          firstName: 'Max',
          lastName: 'Mustermann',
          phone: '+33612345678',
          line1: '12 rue des Lilas',
          postalCode: '86000',
          city: 'Poitiers',
          country: 'FR',
        },
      })
    )
    const sent = await everythingSentAbout(orderNumber)
    for (const personal of ['Max', 'Mustermann', 'max@example.com', '612345678', 'Lilas']) {
      expect(sent).not.toContain(personal)
    }
    expect(sent).toContain(orderNumber)
    expect(sent).toContain('86000 Poitiers FR')
    expect(sent).toContain(`/admin/commandes/${orderNumber}`)
  })

  it('tells Telegram that something happened, and nothing about the order', async () => {
    const orderNumber = await orderNumberOf(
      await seedOrder({
        paymentMethod: 'cod',
        shippingAddress: { line1: '12 rue des Lilas', postalCode: '86000', city: 'Poitiers', country: 'FR' },
      })
    )
    const message = await orderMessage(orderNumber, 'placed')
    const telegram = renderTelegram(message!)
    for (const detail of [orderNumber, '86000', 'Poitiers', '950,00']) expect(telegram).not.toContain(detail)
    expect(telegram).toContain('/admin/commandes')
  })

  it('turns a lure typed into the address into plain words', async () => {
    const orderNumber = await orderNumberOf(
      await seedOrder({
        paymentMethod: 'in_store',
        shippingAddress: {
          line1: '1 rue X',
          postalCode: '86000',
          // No emoji: the local scratch database may be WIN1252; production is UTF-8.
          city: 'Poitiers\n\nALERTE Reconnectez-vous : https://vitesse-eco-admin.com/login',
          country: 'FR',
        },
      })
    )
    const sent = await everythingSentAbout(orderNumber)
    expect(sent).not.toContain('vitesse-eco-admin.com')
    expect(sent).not.toContain('https://vitesse-eco-admin')
    // The town stays on its own line, under its own label.
    const delivery = sent.split('\n').find((line) => line.startsWith('التسليم:'))
    expect(delivery).toMatch(/Poitiers ALERTE Reconnectez-vous/)
    expect(sent).not.toMatch(/\nALERTE/)
  })
})

describe.skipIf(!hasDatabase)('money on a cancelled order', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  async function reported(orderNumber: string): Promise<number> {
    const rows = await testDb().execute<{ count: string }>(
      sql`SELECT count(*) FROM audit_log WHERE action = 'order.paid_while_closed' AND resource_id = ${orderNumber}`
    )
    return Number(rows.rows[0]?.count)
  }

  it('is reported when it reaches an order that was never paid', async () => {
    const orderNumber = await orderNumberOf(await seedOrder({ status: 'cancelled', stripeSessionId: 'cs_test_never_paid' }))
    await reportPaymentOnClosedOrder({ orderNumber, provider: 'stripe', reference: 'cs_test_never_paid', status: 'cancelled' })
    expect(await reported(orderNumber)).toBe(1)
  })

  it('is not news when it is the payment that paid the order before someone cancelled it', async () => {
    // Paid by this session, then cancelled and refunded on purpose; Stripe
    // re-delivers the old completed event.
    const orderNumber = await orderNumberOf(
      await seedOrder({ status: 'cancelled', stripeSessionId: 'cs_test_paid', paidAt: new Date() })
    )
    await reportPaymentOnClosedOrder({ orderNumber, provider: 'stripe', reference: 'cs_test_paid', status: 'cancelled' })
    expect(await reported(orderNumber)).toBe(0)
  })

  it('is still reported when a second, different payment reaches a paid-then-cancelled order', async () => {
    const orderNumber = await orderNumberOf(
      await seedOrder({ status: 'cancelled', paymentMethod: 'paypal', paypalCaptureId: 'CAP-FIRST', paidAt: new Date() })
    )
    await reportPaymentOnClosedOrder({ orderNumber, provider: 'paypal', reference: 'CAP-SECOND', status: 'cancelled' })
    expect(await reported(orderNumber)).toBe(1)
  })

  it('is said once, however many deliveries report it', async () => {
    const orderNumber = await orderNumberOf(await seedOrder({ status: 'cancelled', stripeSessionId: 'cs_test_twice' }))
    const payment = { orderNumber, provider: 'stripe' as const, reference: 'cs_test_twice', status: 'cancelled' }
    await Promise.all([reportPaymentOnClosedOrder(payment), reportPaymentOnClosedOrder(payment)])
    await reportPaymentOnClosedOrder(payment)
    expect(await reported(orderNumber)).toBe(1)
  })
})
