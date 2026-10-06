/**
 * The two routes that open and settle a payment, driven over HTTP against a
 * real database.
 *
 * The services have suites of their own; this one holds the decisions the
 * routes make with them — each found wrong by an adversarial review:
 *
 *  - a replayed checkout never opens a payment that no stock hold stands
 *    behind, and never attaches one to an order that closed while Stripe was
 *    being asked; a PayPal replay asks PayPal before showing its buttons again;
 *  - a PayPal capture for a closed order says "start over", before PayPal is
 *    asked anything, and none takes money unless the order holds its units;
 *  - a capture PayPal is still reviewing, or declined, is not money to ship
 *    against, and one that lands on an order cancelled meanwhile is written on
 *    that order, where the owner looks.
 *
 * Only what lives at someone else's address is stubbed: the catalogue
 * (Sanity), the captcha (Cloudflare), Stripe and PayPal. The route wrapper, the
 * order and stock services and PostgreSQL are the real ones.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createApp, createRouter, toNodeListener } from 'h3'
import { sql } from 'drizzle-orm'
import { closePool, hasDatabase, inTransaction, resetDatabase, schema, seedOrder, seedProduct, testDb } from './setup'

const BIKE = 'product-v20-noir'

vi.mock('../../server/catalog', () => ({
  getProductsByIds: async () =>
    new Map([
      [
        BIKE,
        {
          id: BIKE,
          slug: 'v20-pro-noir',
          name: 'V20 Pro — Noir',
          color: 'Noir',
          image: null,
          price: 95000,
          compareAtPrice: null,
          sku: BIKE,
        },
      ],
    ]),
  getPromo: async () => null,
  shippingMethodsFor: async () => [{ code: 'pickup', name: 'Retrait', price: 0, freeAbove: null, estimatedDays: null }],
}))

vi.mock('../../server/security/captcha', () => ({ verifyCaptcha: async () => undefined }))

/** Stripe, as these routes use it: sessions created, read back, expired. */
const stripeDouble = vi.hoisted(() => ({
  sessions: new Map<string, { id: string; status: string; client_secret: string | null; expiresAt: Date }>(),
  created: [] as string[],
  expired: [] as string[],
  /** Runs while Stripe is being asked — the seconds in which a cancellation can land. */
  duringCreate: null as null | ((orderNumber: string) => Promise<void>),
  failNextCreate: false,
}))

vi.mock('../../server/payments/stripe', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../server/payments/stripe')>()),
  stripe: () => ({
    checkout: {
      sessions: {
        retrieve: async (id: string) => {
          const session = stripeDouble.sessions.get(id)
          if (!session) throw Object.assign(new Error(`No such checkout.session: ${id}`), { code: 'resource_missing' })
          return session
        },
        expire: async (id: string) => {
          stripeDouble.expired.push(id)
          const session = stripeDouble.sessions.get(id)
          if (session) session.status = 'expired'
          return session
        },
      },
    },
  }),
  createCheckoutSession: async (input: { orderNumber: string }) => {
    if (stripeDouble.failNextCreate) {
      stripeDouble.failNextCreate = false
      throw new Error('Stripe could not be reached')
    }
    // Stripe answers in tens of milliseconds at best, after the order and its
    // hold were written — which is why its window always ended later.
    await new Promise((resolve) => setTimeout(resolve, 25))
    const id = `cs_test_double${stripeDouble.created.length + 1}`
    // Thirty minutes is the shortest window Stripe allows.
    const expiresAt = new Date(Date.now() + 30 * 60_000)
    stripeDouble.created.push(id)
    stripeDouble.sessions.set(id, { id, status: 'open', client_secret: `${id}_secret`, expiresAt })
    await stripeDouble.duringCreate?.(input.orderNumber)
    return { clientSecret: `${id}_secret`, sessionId: id, expiresAt }
  },
}))

/** PayPal, as the two routes use it. The order id carries our order number. */
const paypalDouble = vi.hoisted(() => ({
  captures: 0,
  capture: null as null | ((orderNumber: string) => Promise<Record<string, unknown>>),
  /** What PayPal says an order is when asked — before a capture, or on a replay. */
  order: {
    status: 'APPROVED',
    captureId: null as string | null,
    captureStatus: null as string | null,
    createTime: null as string | null,
  },
  /** PayPal orders created, by our order number. */
  created: [] as string[],
  failNextCreate: false,
  unreachable: false,
}))

vi.mock('../../server/payments/paypal', async (importOriginal) => {
  const { AppError, ERROR_CODES } = await import('../../shared/errors')
  const read = (paypalOrderId: string) => ({
    status: paypalDouble.order.status,
    invoiceId: paypalOrderId.replace(/^PP-/, ''),
    amountValue: '950.00',
    currency: 'EUR',
    captureId: paypalDouble.order.captureId,
    captureStatus: paypalDouble.order.captureStatus,
    createTime: paypalDouble.order.createTime,
    updateTime: null,
  })
  return {
    ...(await importOriginal<typeof import('../../server/payments/paypal')>()),
    paypalConfigured: () => true,
    createPayPalOrder: async (input: { orderNumber: string }) => {
      if (paypalDouble.failNextCreate) {
        paypalDouble.failNextCreate = false
        throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, { internal: `PayPal createOrder for ${input.orderNumber} answered 503` })
      }
      paypalDouble.created.push(input.orderNumber)
      return { paypalOrderId: `PP-${input.orderNumber}` }
    },
    getPayPalOrder: async (paypalOrderId: string) => read(paypalOrderId),
    findPayPalOrder: async (paypalOrderId: string) => {
      if (paypalDouble.unreachable) {
        throw new AppError(ERROR_CODES.PAYMENT_PROVIDER_ERROR, { internal: `PayPal getOrder ${paypalOrderId} answered 503` })
      }
      return read(paypalOrderId)
    },
    capturePayPalOrder: async (paypalOrderId: string) => {
      paypalDouble.captures++
      if (!paypalDouble.capture) throw new Error('no capture scripted for this test')
      return paypalDouble.capture(paypalOrderId.replace(/^PP-/, ''))
    },
  }
})

// Imported after the stubs above are registered, and after ./setup has pointed
// the production accessor at the scratch database.
const { default: start } = await import('../../server/api/checkout/start.post')
const { default: capture } = await import('../../server/api/checkout/paypal-capture.post')
const { transitionOrder } = await import('../../server/services/orders')
const { readAvailability, reserveStock } = await import('../../server/services/stock')

let server: Server
let base = ''

async function post(path: string, body: unknown): Promise<{ status: number; body: Record<string, any> }> {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { status: response.status, body: (await response.json().catch(() => ({}))) as Record<string, any> }
}

/**
 * A guest collecting one bike in Poitiers and paying by card, unless `changes`
 * says otherwise. Synthetic identity only.
 */
function checkout(idempotencyKey: string, changes: Record<string, unknown> = {}) {
  return post('/api/checkout/start', {
    cart: { lines: [{ productId: BIKE, quantity: 1 }] },
    shipping: { methodCode: 'pickup', destination: { country: 'FR', postalCode: '86000' } },
    paymentMethod: 'stripe',
    locale: 'fr',
    email: 'max.mustermann@example.com',
    firstName: 'Max',
    lastName: 'Mustermann',
    phone: '+436601234567',
    idempotencyKey,
    captchaToken: 'test-token',
    ...changes,
  })
}

async function orderWithKey(idempotencyKey: string) {
  const [row] = await testDb()
    .select({
      id: schema.orders.id,
      orderNumber: schema.orders.orderNumber,
      status: schema.orders.status,
      stripeSessionId: schema.orders.stripeSessionId,
      captureId: schema.orders.paypalCaptureId,
      notes: schema.orders.adminNotes,
    })
    .from(schema.orders)
    .where(sql`${schema.orders.idempotencyKey} = ${idempotencyKey}`)
  if (!row) throw new Error(`no order for ${idempotencyKey}`)
  return row
}

/** What another buyer could take of the bike right now. */
async function bikesFree(): Promise<number> {
  return (await readAvailability(testDb(), [BIKE])).get(BIKE)?.available ?? 0
}

async function holdExpiry(orderId: string): Promise<number> {
  const rows = await testDb().execute<{ ms: number }>(
    sql`SELECT (extract(epoch FROM expires_at) * 1000)::float8 AS ms FROM stock_reservations WHERE order_id = ${orderId}`
  )
  return Number(rows.rows[0]?.ms)
}

/** The session and its hold run out together; the clock is moved, not waited for. */
async function letTheHoldLapse(orderId: string): Promise<void> {
  await testDb().execute(
    sql`UPDATE stock_reservations SET expires_at = NOW() - interval '1 minute' WHERE order_id = ${orderId}`
  )
}

describe.skipIf(!hasDatabase)('the checkout routes', () => {
  beforeAll(async () => {
    const router = createRouter()
      .post('/api/checkout/start', start)
      .post('/api/checkout/paypal-capture', capture)
    const app = createApp()
    app.use(router)
    server = createServer(toNodeListener(app))
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  })

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve))
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
    await seedProduct(BIKE, 1)
    stripeDouble.sessions.clear()
    stripeDouble.created.length = 0
    stripeDouble.expired.length = 0
    stripeDouble.duringCreate = null
    stripeDouble.failNextCreate = false
    paypalDouble.captures = 0
    paypalDouble.capture = null
    paypalDouble.order = { status: 'APPROVED', captureId: null, captureStatus: null, createTime: null }
    paypalDouble.created.length = 0
    paypalDouble.failNextCreate = false
    paypalDouble.unreachable = false
  })

  describe('starting a card payment', () => {
    it('holds the stock for as long as the session can be paid', async () => {
      const key = crypto.randomUUID()

      const response = await checkout(key)

      expect(response.status).toBe(200)
      expect(response.body.clientSecret).toBe('cs_test_double1_secret')
      const order = await orderWithKey(key)
      expect(order.stripeSessionId).toBe('cs_test_double1')
      // The hold was taken at placement, a moment before the session's thirty
      // minutes began. Left alone it lapsed first, and the session stayed
      // payable over units already back on sale.
      expect(await holdExpiry(order.id)).toBe(stripeDouble.sessions.get('cs_test_double1')!.expiresAt.getTime())
    })

    it('reuses a session that can still be paid', async () => {
      const key = crypto.randomUUID()
      await checkout(key)

      const replay = await checkout(key)

      expect(replay.status).toBe(200)
      expect(replay.body.clientSecret).toBe('cs_test_double1_secret')
      expect(stripeDouble.created).toEqual(['cs_test_double1'])
    })

    it('closes an attempt whose session expired, instead of opening a second one over a lapsed hold', async () => {
      const key = crypto.randomUUID()
      await checkout(key)
      const order = await orderWithKey(key)
      stripeDouble.sessions.get('cs_test_double1')!.status = 'expired'
      await letTheHoldLapse(order.id)

      const replay = await checkout(key)

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_closed')
      expect(stripeDouble.created).toEqual(['cs_test_double1'])
      const after = await orderWithKey(key)
      expect(after.status).toBe('cancelled')
      expect(after.stripeSessionId).toBe('cs_test_double1')
    })

    it('cancels nothing on a session it cannot read as open or expired', async () => {
      const key = crypto.randomUUID()
      await checkout(key)
      // Open, yet with no client secret to mount it by.
      stripeDouble.sessions.get('cs_test_double1')!.client_secret = null

      const replay = await checkout(key)

      expect(replay.status).toBe(502)
      expect((await orderWithKey(key)).status).toBe('awaiting_payment')
      expect(stripeDouble.created).toEqual(['cs_test_double1'])
    })

    it('closes a replay that never got a session once its hold has lapsed — Stripe is not asked', async () => {
      const key = crypto.randomUUID()
      stripeDouble.failNextCreate = true
      const first = await checkout(key)
      expect(first.status).toBeGreaterThanOrEqual(500)
      const order = await orderWithKey(key)
      expect(order.stripeSessionId).toBeNull()
      await letTheHoldLapse(order.id)

      const replay = await checkout(key)

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_closed')
      expect(stripeDouble.created).toEqual([])
      expect((await orderWithKey(key)).status).toBe('cancelled')
    })

    it('never attaches a session to an order cancelled while Stripe was being asked', async () => {
      const key = crypto.randomUUID()
      stripeDouble.duringCreate = async (orderNumber) => {
        // The sweep, or the shop, closing the order in those seconds.
        await transitionOrder(orderNumber, 'cancelled', { expectFrom: 'awaiting_payment' })
      }

      const response = await checkout(key)

      expect(response.status).toBe(409)
      expect(response.body.data?.messageKey).toBe('errors.order_closed')
      const order = await orderWithKey(key)
      expect(order.status).toBe('cancelled')
      expect(order.stripeSessionId).toBeNull()
      // The session made meanwhile can take no money either.
      expect(stripeDouble.expired).toEqual(['cs_test_double1'])
    })
  })

  describe('replaying a PayPal checkout', () => {
    it('shows the same buttons again while the hold is live', async () => {
      const key = crypto.randomUUID()
      const first = await checkout(key, { paymentMethod: 'paypal' })

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(200)
      expect(replay.body).toMatchObject({ mode: 'paypal', paypalOrderId: first.body.paypalOrderId })
    })

    it('closes an attempt whose hold lapsed while another customer bought the bike — no buttons over it', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      // Another customer takes the freed bike, and the buttons were never used.
      expect((await checkout(crypto.randomUUID())).status).toBe(200)
      paypalDouble.order.status = 'CREATED'

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_closed')
      expect(paypalDouble.created).toEqual([order.orderNumber])
      expect((await orderWithKey(key)).status).toBe('cancelled')
    })

    it('settles an attempt PayPal already captured instead of closing it', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      // The capture's answer was lost on the way back to the page.
      paypalDouble.order = { status: 'COMPLETED', captureId: 'CAP-EARLIER', captureStatus: 'COMPLETED', createTime: null }

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_already_paid')
      expect(await orderWithKey(key)).toMatchObject({ status: 'paid', captureId: 'CAP-EARLIER' })
      expect(await bikesFree()).toBe(0)
    })

    it('keeps the bike for an attempt whose capture PayPal is still reviewing', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      paypalDouble.order = { status: 'COMPLETED', captureId: 'CAP-REVIEW', captureStatus: 'PENDING', createTime: null }

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_already_paid')
      const after = await orderWithKey(key)
      expect(after).toMatchObject({ status: 'awaiting_payment', captureId: null })
      expect(after.notes).toContain('CAP-REVIEW')
      expect(await holdExpiry(order.id)).toBeGreaterThan(Date.now() + 71 * 3_600_000)
      expect(await bikesFree()).toBe(0)
    })

    it('warns on the order when the bike of a capture under review was sold meanwhile', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      expect((await checkout(crypto.randomUUID())).status).toBe(200)
      paypalDouble.order = { status: 'COMPLETED', captureId: 'CAP-REVIEW', captureStatus: 'PENDING', createTime: null }

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.body.data?.messageKey).toBe('errors.order_already_paid')
      const after = await orderWithKey(key)
      // Not cancelled: PayPal may still take the money.
      expect(after.status).toBe('awaiting_payment')
      expect(after.notes).toContain('ATTENTION')
      expect(after.notes).toContain('CAP-REVIEW')
    })

    it('closes nothing while PayPal cannot yet say whether an approval was paid', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      // Approved a moment ago: a capture may be on its way.
      paypalDouble.order = { status: 'APPROVED', captureId: null, captureStatus: null, createTime: new Date().toISOString() }

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(502)
      expect((await orderWithKey(key)).status).toBe('awaiting_payment')
      expect(paypalDouble.created).toEqual([order.orderNumber])
    })

    it('closes nothing when PayPal cannot be asked', async () => {
      const key = crypto.randomUUID()
      await checkout(key, { paymentMethod: 'paypal' })
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)
      paypalDouble.unreachable = true

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(502)
      expect((await orderWithKey(key)).status).toBe('awaiting_payment')
    })

    it('closes a replay that never got a PayPal order once its hold has lapsed — PayPal is not asked to make one', async () => {
      const key = crypto.randomUUID()
      paypalDouble.failNextCreate = true
      expect((await checkout(key, { paymentMethod: 'paypal' })).status).toBe(502)
      const order = await orderWithKey(key)
      await letTheHoldLapse(order.id)

      const replay = await checkout(key, { paymentMethod: 'paypal' })

      expect(replay.status).toBe(409)
      expect(replay.body.data?.messageKey).toBe('errors.order_closed')
      expect(paypalDouble.created).toEqual([])
      expect((await orderWithKey(key)).status).toBe('cancelled')
    })
  })

  describe('capturing a PayPal payment', () => {
    /** An order whose PayPal id carries its own number, holding the bike unless it is closed. */
    async function paypalOrder(status: 'awaiting_payment' | 'cancelled') {
      const orderId = await seedOrder({ status, paymentMethod: 'paypal' })
      const [row] = await testDb()
        .select({ orderNumber: schema.orders.orderNumber })
        .from(schema.orders)
        .where(sql`${schema.orders.id} = ${orderId}`)
      const orderNumber = row!.orderNumber
      await testDb().execute(sql`UPDATE orders SET paypal_order_id = ${`PP-${orderNumber}`} WHERE id = ${orderId}`)
      await testDb().insert(schema.orderItems).values({
        orderId,
        productId: BIKE,
        sku: BIKE,
        nameSnapshot: 'V20 Pro — Noir',
        unitPriceCents: 95000,
        quantity: 1,
        lineTotalCents: 95000,
      })
      if (status === 'awaiting_payment') {
        await inTransaction((tx) => reserveStock(tx, orderId, [{ productId: BIKE, quantity: 1 }]))
      }
      return { orderId, orderNumber }
    }

    async function stateOf(orderId: string) {
      const [row] = await testDb()
        .select({
          status: schema.orders.status,
          captureId: schema.orders.paypalCaptureId,
          notes: schema.orders.adminNotes,
        })
        .from(schema.orders)
        .where(sql`${schema.orders.id} = ${orderId}`)
      return row!
    }

    async function onHand(): Promise<number> {
      const [row] = await testDb()
        .select({ onHand: schema.inventory.onHand })
        .from(schema.inventory)
        .where(sql`${schema.inventory.productId} = ${BIKE}`)
      return row!.onHand
    }

    async function audited(action: string, orderNumber: string): Promise<number> {
      const rows = await testDb().execute<{ n: number }>(
        sql`SELECT count(*)::int AS n FROM audit_log WHERE action = ${action} AND resource_id = ${orderNumber}`
      )
      return Number(rows.rows[0]?.n)
    }

    it('tells the page to start over when the order has closed — before PayPal is asked anything', async () => {
      const { orderNumber } = await paypalOrder('cancelled')

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(409)
      expect(response.body.data?.messageKey).toBe('errors.order_closed')
      expect(paypalDouble.captures).toBe(0)
    })

    it('marks the order paid when the capture itself completed', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      paypalDouble.capture = async () => ({ status: 'COMPLETED', captureId: 'CAP-OK', captureStatus: 'COMPLETED' })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(200)
      expect(response.body.state).toBe('paid')
      expect(await stateOf(orderId)).toMatchObject({ status: 'paid', captureId: 'CAP-OK' })
      expect(await onHand()).toBe(0)
    })

    it('does not call a capture PayPal is still reviewing paid — the bike stays unsold until PayPal decides', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      paypalDouble.capture = async () => ({ status: 'COMPLETED', captureId: 'CAP-HELD', captureStatus: 'PENDING' })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(200)
      expect(response.body.state).toBe('pending')
      // Out of paypal_capture_id: a recorded capture reads as money taken, to
      // the sweep too. Not consumed either — it is not money yet.
      const after = await stateOf(orderId)
      expect(after).toMatchObject({ status: 'awaiting_payment', captureId: null })
      expect(await onHand()).toBe(1)
      // On the order instead, where the shop reads why it must neither cancel nor ship.
      expect(after.notes).toContain('CAP-HELD')
      expect(after.notes).toContain('Ne pas annuler ni expédier')
      // The review can take a day. Its bike stays this payer's for the whole
      // horizon, not for the thirty minutes an abandoned basket gets.
      expect(await holdExpiry(orderId)).toBeGreaterThan(Date.now() + 71 * 3_600_000)
      await testDb().execute(
        sql`UPDATE stock_reservations SET expires_at = expires_at - interval '31 minutes' WHERE order_id = ${orderId}`
      )
      expect(await bikesFree()).toBe(0)

      // PayPal's answer read again — a retried capture — notes it once.
      expect((await post('/api/checkout/paypal-capture', { orderNumber })).body.state).toBe('pending')
      expect((await stateOf(orderId)).notes?.split('CAP-HELD')).toHaveLength(2)
    })

    it('takes no money over a hold that lapsed while another customer took the bike — the attempt is closed first', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      await letTheHoldLapse(orderId)
      expect((await checkout(crypto.randomUUID())).status).toBe(200)
      paypalDouble.capture = async () => ({ status: 'COMPLETED', captureId: 'CAP-OVERSOLD', captureStatus: 'COMPLETED' })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(409)
      expect(response.body.data?.messageKey).toBe('errors.order_closed')
      expect(paypalDouble.captures).toBe(0)
      const after = await stateOf(orderId)
      expect(after.status).toBe('cancelled')
      expect(after.notes).toContain("Rien n'a été encaissé")
      // The other customer's bike stays theirs, and nothing was sold twice.
      expect(await onHand()).toBe(1)
    })

    it('takes a lapsed hold up again when the bike is still free — a buyer arriving during the capture is refused', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      await letTheHoldLapse(orderId)
      const rival = { status: 0 }
      paypalDouble.capture = async () => {
        rival.status = (await checkout(crypto.randomUUID())).status
        return { status: 'COMPLETED', captureId: 'CAP-OK', captureStatus: 'COMPLETED' }
      }

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(200)
      expect(rival.status).toBe(409)
      const after = await stateOf(orderId)
      expect(after.status).toBe('paid')
      // Taken while it was free, so nothing was sold twice.
      expect(after.notes).toBeNull()
      expect(await onHand()).toBe(0)
    })

    it('stretches a live hold over the capture', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      await testDb().execute(
        sql`UPDATE stock_reservations SET expires_at = NOW() + interval '2 seconds' WHERE order_id = ${orderId}`
      )
      let heldUntil = 0
      paypalDouble.capture = async () => {
        heldUntil = await holdExpiry(orderId)
        return { status: 'COMPLETED', captureId: 'CAP-OK', captureStatus: 'COMPLETED' }
      }

      expect((await post('/api/checkout/paypal-capture', { orderNumber })).status).toBe(200)

      expect(heldUntil).toBeGreaterThan(Date.now() + 5 * 60_000)
    })

    it('keeps nothing off sale for an order the payer has not approved — nothing can be captured from it', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      const before = await holdExpiry(orderId)
      paypalDouble.order.status = 'CREATED'
      paypalDouble.capture = async () => ({ status: 'CREATED', captureId: null, captureStatus: null })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(502)
      expect(await holdExpiry(orderId)).toBe(before)
    })

    it('settles a payment PayPal had already taken, whatever became of the hold', async () => {
      // Captured on an earlier attempt whose answer never came back. The money
      // has moved: it is honoured, and the shortfall is written for the shop.
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      await letTheHoldLapse(orderId)
      expect((await checkout(crypto.randomUUID())).status).toBe(200)
      paypalDouble.order = { status: 'COMPLETED', captureId: 'CAP-EARLIER', captureStatus: 'COMPLETED', createTime: null }
      paypalDouble.capture = async () => ({ status: 'COMPLETED', captureId: 'CAP-EARLIER', captureStatus: 'COMPLETED' })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(200)
      const after = await stateOf(orderId)
      expect(after).toMatchObject({ status: 'paid', captureId: 'CAP-EARLIER' })
      expect(after.notes).toContain('stock insuffisant')
    })

    it('refuses a declined capture as not charged', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      paypalDouble.capture = async () => ({ status: 'COMPLETED', captureId: 'CAP-NO', captureStatus: 'DECLINED' })

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(502)
      expect(await stateOf(orderId)).toMatchObject({ status: 'awaiting_payment', captureId: null })
      expect(await onHand()).toBe(1)
    })

    it('writes a capture that landed on an order cancelled meanwhile on the order, for the shop', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      paypalDouble.capture = async (number) => {
        // The sweep, or the shop, closing it while the payer approved.
        await transitionOrder(number, 'cancelled', { expectFrom: 'awaiting_payment' })
        return { status: 'COMPLETED', captureId: 'CAP-LATE', captureStatus: 'COMPLETED' }
      }

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      // The payer has paid; the answer is not an error that invites paying again.
      expect(response.status).toBe(200)
      const after = await stateOf(orderId)
      expect(after.status).toBe('cancelled')
      // Where the owner looks: on the order, in the panel — not only in a log.
      expect(after.notes).toContain('CAP-LATE')
      expect(await audited('order.paypal_captured_on_closed_order', orderNumber)).toBe(1)
    })

    it('raises no alarm when its own webhook marked the order paid first', async () => {
      const { orderId, orderNumber } = await paypalOrder('awaiting_payment')
      paypalDouble.capture = async (number) => {
        await transitionOrder(number, 'paid', { expectFrom: 'awaiting_payment' })
        return { status: 'COMPLETED', captureId: 'CAP-RACE', captureStatus: 'COMPLETED' }
      }

      const response = await post('/api/checkout/paypal-capture', { orderNumber })

      expect(response.status).toBe(200)
      expect(response.body.state).toBe('paid')
      const after = await stateOf(orderId)
      expect(after.status).toBe('paid')
      expect(after.notes).toBeNull()
      expect(await audited('order.paypal_captured_on_closed_order', orderNumber)).toBe(0)
    })
  })
})
