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
import { orderMessage, renderEmail, renderTelegram } from '../../server/services/notify'
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
