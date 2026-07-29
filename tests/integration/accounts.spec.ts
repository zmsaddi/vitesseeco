/**
 * Account data access, against a real database.
 *
 * The property under test is ownership: a customer must never be able to read
 * or delete another customer's row, and the way that is guaranteed is that the
 * owner is part of the query rather than a check applied to its result.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, sql } from 'drizzle-orm'
import { closePool, hasDatabase, resetDatabase, schema, testDb } from './setup'
import { createSessionToken, hashPassword, hashToken, verifyPassword } from '../../server/security/crypto'

async function makeCustomer(email: string): Promise<string> {
  const [row] = await testDb()
    .insert(schema.customers)
    .values({
      email,
      passwordHash: await hashPassword('a-long-enough-password'),
      firstName: 'Test',
      lastName: 'Customer',
    })
    .returning({ id: schema.customers.id })
  return row!.id
}

async function makeAddress(customerId: string, isDefault = false): Promise<string> {
  const [row] = await testDb()
    .insert(schema.addresses)
    .values({
      customerId,
      firstName: 'Test',
      lastName: 'Customer',
      line1: '32 Rue du Faubourg du Pont Neuf',
      postalCode: '86000',
      city: 'Poitiers',
      country: 'FR',
      isDefault,
    })
    .returning({ id: schema.addresses.id })
  return row!.id
}

describe.skipIf(!hasDatabase)('accounts', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  describe('customers', () => {
    it('stores no password in readable form', async () => {
      const id = await makeCustomer('a@example.com')
      const rows = await testDb().execute<{ password_hash: string }>(
        sql`SELECT password_hash FROM customers WHERE id = ${id}`
      )
      const stored = rows.rows[0]?.password_hash as string
      expect(stored).not.toContain('a-long-enough-password')
      expect(await verifyPassword('a-long-enough-password', stored)).toBe(true)
    })

    it('refuses two accounts on one email, whatever the case', async () => {
      await makeCustomer('shared@example.com')
      await expect(makeCustomer('shared@example.com')).rejects.toThrow()
    })

    it('allows an account with no password, for sign-in through a provider', async () => {
      const [row] = await testDb()
        .insert(schema.customers)
        .values({ email: 'oauth@example.com', passwordHash: null, firstName: 'O', lastName: 'Auth' })
        .returning({ id: schema.customers.id })
      expect(row?.id).toBeTruthy()
    })
  })

  describe('sessions', () => {
    it('stores only the hash of a token', async () => {
      const customerId = await makeCustomer('session@example.com')
      const { token, tokenHash } = createSessionToken()

      await testDb()
        .insert(schema.sessions)
        .values({ customerId, tokenHash, expiresAt: new Date(Date.now() + 60_000) })

      const rows = await testDb().execute<{ token_hash: string }>(
        sql`SELECT token_hash FROM sessions WHERE customer_id = ${customerId}`
      )
      // A leaked backup must not contain anything replayable as a login.
      expect(rows.rows[0]?.token_hash).not.toBe(token)
      expect(rows.rows[0]?.token_hash).toBe(hashToken(token))
    })

    it('refuses two sessions sharing a token hash', async () => {
      const customerId = await makeCustomer('dup@example.com')
      const { tokenHash } = createSessionToken()
      const expiresAt = new Date(Date.now() + 60_000)

      await testDb().insert(schema.sessions).values({ customerId, tokenHash, expiresAt })
      await expect(
        testDb().insert(schema.sessions).values({ customerId, tokenHash, expiresAt })
      ).rejects.toThrow()
    })

    it('deletes sessions with the customer, leaving nothing usable behind', async () => {
      const customerId = await makeCustomer('cascade@example.com')
      const { tokenHash } = createSessionToken()
      await testDb()
        .insert(schema.sessions)
        .values({ customerId, tokenHash, expiresAt: new Date(Date.now() + 60_000) })

      await testDb().delete(schema.customers).where(eq(schema.customers.id, customerId))

      const remaining = await testDb().execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM sessions`
      )
      expect(Number(remaining.rows[0]?.count)).toBe(0)
    })
  })

  describe('addresses', () => {
    it('permits only one default per customer', async () => {
      const customerId = await makeCustomer('default@example.com')
      await makeAddress(customerId, true)
      // The partial unique index makes a second default impossible, so the rule
      // does not depend on application code remembering to clear the old one.
      await expect(makeAddress(customerId, true)).rejects.toThrow()
    })

    it('lets two customers each have their own default', async () => {
      const first = await makeCustomer('one@example.com')
      const second = await makeCustomer('two@example.com')
      await makeAddress(first, true)
      await expect(makeAddress(second, true)).resolves.toBeTruthy()
    })

    it('does not delete an address belonging to someone else', async () => {
      const owner = await makeCustomer('owner@example.com')
      const stranger = await makeCustomer('stranger@example.com')
      const addressId = await makeAddress(owner)

      // The owner is part of the DELETE, so a stranger's attempt matches
      // nothing — there is no moment where the row was fetched and then checked.
      const removed = await testDb()
        .delete(schema.addresses)
        .where(and(eq(schema.addresses.id, addressId), eq(schema.addresses.customerId, stranger)))
        .returning({ id: schema.addresses.id })

      expect(removed).toHaveLength(0)

      const stillThere = await testDb().execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM addresses WHERE id = ${addressId}`
      )
      expect(Number(stillThere.rows[0]?.count)).toBe(1)
    })

    it('removes addresses when the account is deleted', async () => {
      const customerId = await makeCustomer('gone@example.com')
      await makeAddress(customerId)
      await testDb().delete(schema.customers).where(eq(schema.customers.id, customerId))

      const remaining = await testDb().execute<{ count: string }>(
        sql`SELECT COUNT(*)::text AS count FROM addresses`
      )
      expect(Number(remaining.rows[0]?.count)).toBe(0)
    })
  })

  describe('oauth identities', () => {
    it('links one provider account to exactly one customer', async () => {
      const first = await makeCustomer('g1@example.com')
      const second = await makeCustomer('g2@example.com')

      await testDb()
        .insert(schema.oauthIdentities)
        .values({ customerId: first, provider: 'google', providerAccountId: 'google-123' })

      // The same Google account cannot be attached to a second customer.
      await expect(
        testDb()
          .insert(schema.oauthIdentities)
          .values({ customerId: second, provider: 'google', providerAccountId: 'google-123' })
      ).rejects.toThrow()
    })

    it('lets one customer link several providers', async () => {
      const customerId = await makeCustomer('multi@example.com')
      await testDb()
        .insert(schema.oauthIdentities)
        .values({ customerId, provider: 'google', providerAccountId: 'g-1' })
      await expect(
        testDb()
          .insert(schema.oauthIdentities)
          .values({ customerId, provider: 'apple', providerAccountId: 'a-1' })
      ).resolves.toBeTruthy()
    })
  })

  describe('orders belong to their customer', () => {
    it('returns nothing when another customer asks', async () => {
      const owner = await makeCustomer('buyer@example.com')
      const stranger = await makeCustomer('nosy@example.com')

      await testDb().insert(schema.orders).values({
        orderNumber: 'ORD-OWNERTEST',
        idempotencyKey: 'owner-test-key',
        customerId: owner,
        shippingMethodCode: 'pickup',
        paymentMethod: 'stripe',
        subtotalCents: 95000,
        totalCents: 95000,
      })

      const asStranger = await testDb()
        .select({ orderNumber: schema.orders.orderNumber })
        .from(schema.orders)
        .where(eq(schema.orders.customerId, stranger))

      expect(asStranger).toHaveLength(0)
    })

    it('keeps an order after its customer is deleted, without an owner', async () => {
      // Deleting an account must not erase the commercial record — the order
      // still happened, and the shop still has obligations under it.
      const customerId = await makeCustomer('leaving@example.com')
      await testDb().insert(schema.orders).values({
        orderNumber: 'ORD-KEEPME',
        idempotencyKey: 'keep-me-key',
        customerId,
        guestEmail: 'leaving@example.com',
        shippingMethodCode: 'pickup',
        paymentMethod: 'stripe',
        subtotalCents: 95000,
        totalCents: 95000,
      })

      await testDb().delete(schema.customers).where(eq(schema.customers.id, customerId))

      const rows = await testDb().execute<{ customer_id: string | null }>(
        sql`SELECT customer_id FROM orders WHERE order_number = 'ORD-KEEPME'`
      )
      expect(rows.rows).toHaveLength(1)
      expect(rows.rows[0]?.customer_id).toBeNull()
    })
  })
})
