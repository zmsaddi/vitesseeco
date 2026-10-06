/**
 * A provider event is processed once — and again when the first attempt failed.
 *
 * The claim used to be ON CONFLICT DO NOTHING whatever had happened before, so
 * an event that failed during a database outage answered every retry with
 * "duplicate" and was never processed. These pin both directions: a processed
 * or in-flight event is never re-run, a failed or abandoned one is.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { sql } from 'drizzle-orm'
import { claimWebhookEvent, firstTime } from '../../server/services/webhookClaims'
import { closePool, hasDatabase, resetDatabase, testDb } from './setup'

const event = (eventId: string) => ({
  provider: 'stripe' as const,
  eventId,
  type: 'checkout.session.completed',
  payload: '{}',
})

async function setStatus(eventId: string, status: string, ageMinutes = 0): Promise<void> {
  await testDb().execute(sql`
    UPDATE webhook_events
       SET status = ${status}, received_at = NOW() - (${ageMinutes} || ' minutes')::interval
     WHERE event_id = ${eventId}
  `)
}

describe.skipIf(!hasDatabase)('claiming a webhook event', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('claims a new event once; a concurrent second attempt is told it is in flight, not acknowledged', async () => {
    expect((await claimWebhookEvent(event('evt_1'))).state).toBe('claimed')
    expect(await claimWebhookEvent(event('evt_1'))).toEqual({ state: 'in_flight' })
  })

  it('never re-runs a processed event', async () => {
    await claimWebhookEvent(event('evt_2'))
    await setStatus('evt_2', 'processed', 60)
    expect(await claimWebhookEvent(event('evt_2'))).toEqual({ state: 'processed' })
  })

  it('re-claims a failed event, under the same row, for one retry only', async () => {
    const first = await claimWebhookEvent(event('evt_3'))
    await setStatus('evt_3', 'failed')
    const again = await claimWebhookEvent(event('evt_3'))
    expect(again).toEqual(first)
    const result = await testDb().execute(sql`SELECT status, error FROM webhook_events WHERE event_id = 'evt_3'`)
    expect(result.rows).toEqual([{ status: 'received', error: null }])
    expect(await claimWebhookEvent(event('evt_3'))).toEqual({ state: 'in_flight' })
  })

  it('leaves a fresh in-flight claim to its handler, but takes over an abandoned one', async () => {
    await claimWebhookEvent(event('evt_4'))
    expect(await claimWebhookEvent(event('evt_4'))).toEqual({ state: 'in_flight' })
    // The function that claimed it died mid-handle; the row stayed 'received'.
    await setStatus('evt_4', 'received', 10)
    expect((await claimWebhookEvent(event('evt_4'))).state).toBe('claimed')
  })

  it('keeps providers apart', async () => {
    expect((await claimWebhookEvent(event('evt_5'))).state).toBe('claimed')
    expect((await claimWebhookEvent({ ...event('evt_5'), provider: 'paypal' })).state).toBe('claimed')
  })
})

describe.skipIf(!hasDatabase)('saying something once', () => {
  afterAll(async () => {
    await closePool()
  })

  beforeEach(async () => {
    await resetDatabase()
  })

  it('answers true the first time only, even to callers racing each other', async () => {
    const answers = await Promise.all(Array.from({ length: 5 }, () => firstTime('link-sale:cs_test_1')))
    expect(answers.filter(Boolean)).toHaveLength(1)
    expect(await firstTime('link-sale:cs_test_1')).toBe(false)
    expect(await firstTime('link-sale:cs_test_2')).toBe(true)
  })

  it('never collides with a provider event of the same id', async () => {
    expect(await firstTime('evt_6')).toBe(true)
    expect((await claimWebhookEvent(event('evt_6'))).state).toBe('claimed')
  })
})
