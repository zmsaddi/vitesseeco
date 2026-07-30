/**
 * The money path, walked for real.
 *
 * Registers a customer, places a Belgian cash-on-delivery order for a real
 * product, and then follows the money the way the shop does: the admin marks
 * the cash received, the shelf count drops; the order is cancelled, the units
 * come back. Every step is asserted in the DATABASE, not in the UI, because the
 * number on the shelf is the thing the business runs on.
 *
 *   node tests/e2e/money-path.mjs http://127.0.0.1:3141 postgres://...
 *
 * Needs the server booted with the Cloudflare TEST captcha secret
 * (1x0000000000000000000000000000000AA), which accepts any token — that is what
 * makes an automated walk of a captcha-gated checkout possible at all.
 */
import pg from 'pg'
import process from 'node:process'

const BASE = (process.argv[2] || 'http://127.0.0.1:3141').replace(/\/$/, '')
const DB_URL = process.argv[3] || 'postgres://vitesse:vitesse@localhost:5544/vitesse_dev'

const db = new pg.Client({ connectionString: DB_URL })
await db.connect()

let failures = 0
const ok = (label) => console.log(`  ✓ ${label}`)
const fail = (label, detail) => {
  failures++
  console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
}
const assert = (condition, label, detail) => (condition ? ok(label) : fail(label, detail))

/** A cookie jar just big enough for this walk. */
const jars = new Map()
function jar(name) {
  if (!jars.has(name)) jars.set(name, new Map())
  return jars.get(name)
}
async function call(who, path, options = {}) {
  const cookies = jar(who)
  const headers = {
    'content-type': 'application/json',
    ...(cookies.size ? { cookie: [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
    ...(options.headers ?? {}),
  }
  const res = await fetch(BASE + path, { ...options, headers })
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
  let body = null
  try { body = await res.json() } catch { /* not JSON */ }
  return { status: res.status, body }
}

// Repeated walks burn the per-IP registration budget — the limit doing its
// job. This harness owns its dev database, so it clears the window rather than
// waiting fifteen minutes between runs. Never a thing to do anywhere real.
await db.query('DELETE FROM rate_limits')

const run = Date.now()
const CUSTOMER = 'sim-client@vitesse-eco.test'
const ADMIN = 'sim-admin@vitesse-eco.test'
const CAPTCHA = 'sim.DUMMY.TOKEN'

console.log('\n1. A product with real stock')
const { rows: [product] } = await db.query(
  `SELECT product_id, on_hand FROM inventory WHERE on_hand >= 2 ORDER BY on_hand DESC LIMIT 1`
)
assert(!!product, `picked ${product?.product_id} with on_hand=${product?.on_hand}`)
const startOnHand = product.on_hand

console.log('\n2. Register the customer and the admin')
for (const [who, email] of [['customer', CUSTOMER], ['admin', ADMIN]]) {
  const res = await call(who, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email,
      password: 'Simulation-2026!x',
      firstName: 'Sim',
      lastName: who === 'admin' ? 'Admin' : 'Client',
      captchaToken: CAPTCHA,
      locale: 'fr',
    }),
  })
  // Either identity may already exist from an earlier run — and repeated runs
  // trip the registration rate limit, which is the limit doing its job. A
  // login covers both cases.
  if (res.status !== 200) {
    const login = await call(who, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password: 'Simulation-2026!x', captchaToken: CAPTCHA }),
    })
    assert(login.status === 200, `${who} signed in`, JSON.stringify(login.body).slice(0, 160))
  } else {
    assert(res.status === 200, `${who} registered (${email})`, JSON.stringify(res.body).slice(0, 120))
  }
}

console.log('\n3. Price the basket as the customer sees it')
const priced = await call('customer', '/api/cart/price', {
  method: 'POST',
  body: JSON.stringify({
    cart: { lines: [{ productId: product.product_id, quantity: 2 }] },
    locale: 'fr',
    shipping: { methodCode: 'free-benelux', country: 'BE', postalCode: '1000' },
  }),
})
if (priced.status !== 200) {
  // The Sanity shipping method codes are data, not code — discover what exists.
  const methods = await call('customer', '/api/catalog/shipping?country=BE&locale=fr')
  console.log('    shipping methods for BE:', JSON.stringify(methods.body).slice(0, 300))
}
assert(priced.status === 200, `basket priced: total ${priced.body?.total}`, JSON.stringify(priced.body))

console.log('\n4. Place the cash-on-delivery order to Brussels')
const shippingCode = priced.status === 200 ? 'free-benelux' : 'pickup'
const order = await call('customer', '/api/checkout/start', {
  method: 'POST',
  body: JSON.stringify({
    cart: { lines: [{ productId: product.product_id, quantity: 2 }] },
    shipping: { methodCode: shippingCode, destination: { country: 'BE', postalCode: '1000' } },
    shippingAddress: {
      firstName: 'Sim',
      lastName: 'Client',
      phone: '+32470123456',
      line1: 'Grote Markt 1',
      postalCode: '1000',
      city: 'Bruxelles',
      country: 'BE',
    },
    paymentMethod: 'cod',
    locale: 'fr',
    idempotencyKey: crypto.randomUUID(),
    captchaToken: CAPTCHA,
  }),
})
assert(order.status === 200 && order.body?.mode === 'cash', `order placed: ${order.body?.orderNumber} (${order.body?.total} €)`, JSON.stringify(order.body))
const orderNumber = order.body?.orderNumber

console.log('\n5. The database agrees')
const { rows: [row] } = await db.query(
  `SELECT status, payment_method, market_country, vat_rate_bp, vat_cents, total_cents,
          (shipping_address->>'city') AS city
     FROM orders WHERE order_number = $1`,
  [orderNumber]
)
assert(!!row, 'order row exists')
assert(row?.status === 'awaiting_payment', `status is awaiting_payment (${row?.status})`)
assert(row?.city === 'Bruxelles', `address stored (${row?.city})`)
assert(row?.market_country === 'FR', `market frozen (${row?.market_country}, ${row?.vat_rate_bp} bp, ${row?.vat_cents} cents VAT)`)

const { rows: [hold] } = await db.query(
  `SELECT quantity, settled_at, expires_at > NOW() + interval '7 days' AS long_ttl
     FROM stock_reservations sr JOIN orders o ON o.id = sr.order_id
    WHERE o.order_number = $1`,
  [orderNumber]
)
assert(hold?.quantity === 2 && hold?.settled_at === null, 'stock held: 2 units, unsettled')
assert(hold?.long_ttl === true, 'cash hold has the long TTL, not the online 30 minutes')

const { rows: [avail] } = await db.query(
  `SELECT on_hand FROM inventory WHERE product_id = $1`, [product.product_id]
)
assert(avail.on_hand === startOnHand, `on_hand untouched while awaiting cash (${avail.on_hand})`)

console.log('\n6. The driver comes back with the cash')
const paid = await call('admin', `/api/admin/orders/${orderNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ markCashReceived: true }),
})
assert(paid.status === 200, 'admin marked cash received', JSON.stringify(paid.body).slice(0, 160))

const { rows: [afterPay] } = await db.query(
  `SELECT o.status, i.on_hand FROM orders o, inventory i
    WHERE o.order_number = $1 AND i.product_id = $2`,
  [orderNumber, product.product_id]
)
assert(afterPay?.status === 'paid', `order is paid (${afterPay?.status})`)
assert(afterPay?.on_hand === startOnHand - 2, `THE SHELF DROPPED: on_hand ${startOnHand} → ${afterPay?.on_hand}`)

console.log('\n7. The order is cancelled and the bikes come back')
const cancel = await call('admin', `/api/admin/orders/${orderNumber}`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'cancelled' }),
})
assert(cancel.status === 200, 'admin cancelled the paid order', JSON.stringify(cancel.body).slice(0, 160))

const { rows: [afterCancel] } = await db.query(
  `SELECT o.status, i.on_hand FROM orders o, inventory i
    WHERE o.order_number = $1 AND i.product_id = $2`,
  [orderNumber, product.product_id]
)
assert(afterCancel?.status === 'cancelled', `order is cancelled (${afterCancel?.status})`)
assert(afterCancel?.on_hand === startOnHand, `RESTOCKED: on_hand back to ${afterCancel?.on_hand}`)

console.log('\n8. Another customer cannot read this order')
let thief = await call('thief', '/api/auth/register', {
  method: 'POST',
  body: JSON.stringify({
    email: 'sim-thief@vitesse-eco.test',
    password: 'Simulation-2026!x',
    firstName: 'Not',
    lastName: 'Yours',
    captchaToken: CAPTCHA,
    locale: 'fr',
  }),
})
if (thief.status !== 200) {
  thief = await call('thief', '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: 'sim-thief@vitesse-eco.test', password: 'Simulation-2026!x', captchaToken: CAPTCHA }),
  })
}
assert(thief.status === 200, 'second customer signed in')
const stolen = await call('thief', `/api/account/orders/${orderNumber}`)
assert(stolen.status === 404, `foreign order answers 404, not ${stolen.status}`)

await db.end()
console.log(`\n${'─'.repeat, ''}`)
if (failures > 0) {
  console.error(`\n❌ ${failures} assertion(s) failed\n`)
  process.exit(1)
}
console.log('\n✅ The whole money path holds, in the database.\n')
