/**
 * The critical path, walked for real — TEMPLATE.
 *
 * Identify the ONE journey where a defect costs money or trust rather than a
 * ranking, and walk it end to end. Then assert every step IN THE DATASTORE, not
 * in the UI. A UI can show "Order confirmed" while nothing was written; a stock
 * count cannot lie.
 *
 *   node critical-path.mjs http://127.0.0.1:3000 postgres://user:pass@host/db
 *
 * What makes this different from an e2e test:
 *   · assertions read the database, not the page
 *   · it asserts DERIVED values (totals, tax, stock), not just existence
 *   · it asserts SIDE EFFECTS (reservations, audit rows, outbox messages)
 *   · it walks the REVERSE path (cancel/refund) and asserts the world is restored
 *   · it repeats a read AS A STRANGER and asserts refusal
 *
 * If a gate blocks automation (CAPTCHA, MFA), use the vendor's sandbox keys.
 * Cloudflare Turnstile: secret 1x0000000000000000000000000000000AA accepts any
 * token; site key 1x00000000000000000000AA always passes. Without something like
 * this, the critical path stays untested forever — which is how a checkout page
 * with no address fields reached "done".
 *
 * Requires: npm i -D pg     (swap for your own client if not PostgreSQL)
 */
import pg from 'pg'
import process from 'node:process'

const BASE = (process.argv[2] || 'http://127.0.0.1:3000').replace(/\/$/, '')
const DB_URL = process.argv[3] || process.env.DATABASE_URL

const db = new pg.Client({ connectionString: DB_URL })
await db.connect()

// ─── assertions ────────────────────────────────────────────────────────────
let failures = 0
const assert = (cond, label, detail) => {
  if (cond) console.log(`  ✓ ${label}`)
  else {
    failures++
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

// ─── a cookie jar per identity, so several actors can be walked in one run ──
const jars = new Map()
async function call(who, path, options = {}) {
  const cookies = jars.get(who) ?? jars.set(who, new Map()).get(who)
  const res = await fetch(BASE + path, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(cookies.size
        ? { cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join('; ') }
        : {}),
      ...(options.headers ?? {}),
    },
  })
  for (const line of res.headers.getSetCookie?.() ?? []) {
    const [pair] = line.split(';')
    const eq = pair.indexOf('=')
    if (eq > 0) cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim())
  }
  return { status: res.status, body: await res.json().catch(() => null) }
}

/** Sign up, falling back to sign in — reruns must not depend on a clean slate. */
async function identify(who, email, password) {
  const reg = await call(who, '/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, captchaToken: 'sim.TOKEN' }),
  })
  if (reg.status === 200) return assert(true, `${who} registered`)
  const login = await call(who, '/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password, captchaToken: 'sim.TOKEN' }),
  })
  assert(login.status === 200, `${who} signed in`, JSON.stringify(login.body).slice(0, 160))
}

// Repeated walks burn the per-IP rate-limit budget — the limit doing its job.
// This harness owns its dev database, so it clears the window instead of waiting.
// NEVER do this anywhere real.
await db.query('DELETE FROM rate_limits').catch(() => {})

// ─── 1. real starting state, read from the datastore ───────────────────────
console.log('\n1. Starting state')
const { rows: [item] } = await db.query(
  `SELECT product_id, on_hand FROM inventory WHERE on_hand >= 2 ORDER BY on_hand DESC LIMIT 1`
)
assert(!!item, `picked ${item?.product_id}, on_hand=${item?.on_hand}`)
const startStock = item.on_hand

// ─── 2. identities: the actor, the operator, and a stranger ────────────────
console.log('\n2. Identities')
await identify('customer', 'sim-customer@example.test', 'Simulation-2026!x')
await identify('admin', 'sim-admin@example.test', 'Simulation-2026!x')
await identify('stranger', 'sim-stranger@example.test', 'Simulation-2026!x')

// ─── 3. the quote the customer is shown ────────────────────────────────────
console.log('\n3. Quote')
const quote = await call('customer', '/api/cart/price', {
  method: 'POST',
  body: JSON.stringify({ cart: { lines: [{ productId: item.product_id, quantity: 2 }] } }),
})
assert(quote.status === 200, `quoted ${quote.body?.total}`, JSON.stringify(quote.body))

// ─── 4. the transaction ────────────────────────────────────────────────────
console.log('\n4. Transaction')
const order = await call('customer', '/api/checkout/start', {
  method: 'POST',
  body: JSON.stringify({
    cart: { lines: [{ productId: item.product_id, quantity: 2 }] },
    // Replace with the real payload. Keep the SAME values the quote used —
    // a mismatch between quote and order is itself a defect worth catching.
    idempotencyKey: crypto.randomUUID(),
    captchaToken: 'sim.TOKEN',
  }),
})
assert(order.status === 200, `order placed: ${order.body?.orderNumber}`, JSON.stringify(order.body))
const ref = order.body?.orderNumber

// ─── 5. the datastore agrees (existence, derived values, side effects) ─────
console.log('\n5. The datastore agrees')
const { rows: [row] } = await db.query(
  `SELECT status, total_cents, vat_cents, vat_rate_bp, (shipping_address->>'city') AS city
     FROM orders WHERE order_number = $1`, [ref]
)
assert(!!row, 'order row exists')
assert(row?.status === 'awaiting_payment', `status (${row?.status})`)
assert(row?.city, `address actually stored (${row?.city})`)
// Derived values frozen at order time must not be recomputed later from
// today's rules — assert them explicitly.
assert(row?.vat_cents > 0, `tax frozen on the order (${row?.vat_cents} cents at ${row?.vat_rate_bp} bp)`)

// Side effects: the hold exists, is unsettled, and has the RIGHT lifetime.
// A TTL correct for one payment method can be catastrophic for another.
const { rows: [hold] } = await db.query(
  `SELECT quantity, settled_at, expires_at > NOW() + interval '1 day' AS long_ttl
     FROM stock_reservations r JOIN orders o ON o.id = r.order_id
    WHERE o.order_number = $1`, [ref]
)
assert(hold?.quantity === 2 && hold?.settled_at === null, 'stock held, unsettled')
assert(hold?.long_ttl === true, 'hold lifetime matches the payment method')

const { rows: [before] } = await db.query(`SELECT on_hand FROM inventory WHERE product_id = $1`, [item.product_id])
assert(before.on_hand === startStock, `shelf untouched while unpaid (${before.on_hand})`)

// ─── 6. settlement moves the real number ───────────────────────────────────
console.log('\n6. Settlement')
const paid = await call('admin', `/api/admin/orders/${ref}`, {
  method: 'PATCH',
  body: JSON.stringify({ markPaid: true }),
})
assert(paid.status === 200, 'operator settled the order', JSON.stringify(paid.body).slice(0, 160))

const { rows: [after] } = await db.query(
  `SELECT o.status, i.on_hand FROM orders o, inventory i
    WHERE o.order_number = $1 AND i.product_id = $2`, [ref, item.product_id]
)
assert(after?.status === 'paid', `order paid (${after?.status})`)
assert(after?.on_hand === startStock - 2, `SHELF DROPPED ${startStock} → ${after?.on_hand}`)

// ─── 7. the reverse path — where money is actually lost ────────────────────
console.log('\n7. Reversal')
const cancelled = await call('admin', `/api/admin/orders/${ref}`, {
  method: 'PATCH',
  body: JSON.stringify({ status: 'cancelled' }),
})
assert(cancelled.status === 200, 'operator cancelled a settled order')
const { rows: [back] } = await db.query(
  `SELECT o.status, i.on_hand FROM orders o, inventory i
    WHERE o.order_number = $1 AND i.product_id = $2`, [ref, item.product_id]
)
assert(back?.status === 'cancelled', `order cancelled (${back?.status})`)
assert(back?.on_hand === startStock, `RESTOCKED to ${back?.on_hand}`)

// ─── 8. replay: the same external event twice must change nothing ──────────
console.log('\n8. Replay safety')
const replay = await call('admin', `/api/admin/orders/${ref}`, {
  method: 'PATCH',
  body: JSON.stringify({ markPaid: true }),
})
const { rows: [afterReplay] } = await db.query(
  `SELECT o.status, i.on_hand FROM orders o, inventory i
    WHERE o.order_number = $1 AND i.product_id = $2`, [ref, item.product_id]
)
assert(afterReplay?.status === 'cancelled', `replayed payment did NOT resurrect the order (${afterReplay?.status})`)
assert(afterReplay?.on_hand === startStock, 'replayed payment did not double-decrement stock')

// ─── 9. a stranger must be refused ─────────────────────────────────────────
console.log('\n9. A stranger')
const stolen = await call('stranger', `/api/account/orders/${ref}`)
// 404 rather than 403: a 403 confirms the resource exists.
assert(stolen.status === 404, `foreign record answers 404, not ${stolen.status}`)

await db.end()
if (failures) {
  console.error(`\n❌ ${failures} assertion(s) failed\n`)
  process.exit(1)
}
console.log('\n✅ The whole critical path holds, in the datastore.\n')
