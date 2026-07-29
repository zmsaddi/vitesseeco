/**
 * The scheduled sweep.
 *
 * Deliberately NOT declared through `defineRoute`: that wrapper is built for
 * browsers — it checks the request origin and applies a per-IP budget, and a
 * platform scheduler has neither an origin nor a stable address. So this one
 * authenticates the only way a machine caller can, with a shared secret, and
 * does nothing else.
 *
 * A timing-safe comparison because a token check that returns early leaks the
 * token one byte at a time to anyone patient enough to measure.
 *
 * The filename carries no method suffix on purpose: Vercel Cron issues a GET,
 * and a handler registered for POST alone would answer 405 forever while the
 * dashboard reported the job as scheduled. Nothing would tell anyone that stock
 * had stopped being released.
 */
import { createError, defineEventHandler, getRequestHeader, setResponseHeader } from 'h3'
import { timingSafeEqual } from 'node:crypto'
import { runMaintenance } from '../../services/maintenance'

function authorised(provided: string | undefined, expected: string): boolean {
  if (!provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  // timingSafeEqual throws on a length mismatch, which is itself an oracle, so
  // the lengths are compared first and the result folded in.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')

  const expected = process.env.CRON_SECRET
  if (!expected) {
    // Failing closed. An unset secret must not mean an open endpoint that any
    // visitor can use to cancel orders.
    throw createError({ statusCode: 503, statusMessage: 'CRON_NOT_CONFIGURED' })
  }

  // Vercel Cron sends the secret as a bearer token; a manual call may use the
  // header directly.
  const header = getRequestHeader(event, 'authorization')
  const bearer = header?.startsWith('Bearer ') ? header.slice(7) : undefined
  const provided = bearer ?? getRequestHeader(event, 'x-cron-secret')

  if (!authorised(provided, expected)) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHORISED' })
  }

  const report = await runMaintenance()

  // Logged as well as returned: the scheduler keeps the response, but the log
  // is where anyone looks when stock has gone missing.
  console.info('[cron] maintenance', JSON.stringify(report))
  return { ok: true, ...report }
})
