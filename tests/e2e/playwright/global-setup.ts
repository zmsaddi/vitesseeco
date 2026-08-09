/**
 * The gate on the gate: prove the candidate rig is really there before any
 * suite runs.
 *
 * The old CI booted the server with no catalogue and let the browser gates
 * demote everything catalogue-dependent to information — a PDP that was never
 * tested looked exactly like a PDP that passed. That path is closed here: if
 * the server is down, serves no products, or serves a catalogue that is not
 * the committed fixture, EVERY browser suite fails now, with a message that
 * says what to fix. Skipping is not an outcome this file can produce.
 */
import type { FullConfig } from '@playwright/test'
import { fixtureProducts } from './helpers/catalogue'

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use?.baseURL
  if (!baseURL) throw new Error('playwright.config.ts defines no baseURL')

  let payload: { items?: Array<{ id?: string }> }
  try {
    const response = await fetch(`${baseURL}/api/catalog/products?perPage=48`, {
      signal: AbortSignal.timeout(15_000),
    })
    if (response.status !== 200) {
      throw new Error(`GET /api/catalog/products answered ${response.status}`)
    }
    payload = (await response.json()) as { items?: Array<{ id?: string }> }
  } catch (error) {
    throw new Error(
      `The candidate rig at ${baseURL} did not serve a catalogue (${String(error)}).\n` +
        'Boot it first: seed PostgreSQL with scripts/seed-candidate.mjs, build this commit ' +
        'with NITRO_PRESET=node-server, and start it with CATALOG_SOURCE=fixture. ' +
        'See docs/testing/BROWSER_GATES.md.'
    )
  }

  const served = new Set((payload.items ?? []).map((item) => item.id))
  const missing = fixtureProducts.filter((product) => !served.has(product._id))
  if (missing.length > 0) {
    throw new Error(
      `The rig at ${baseURL} serves a catalogue, but not the committed fixture: ` +
        `${missing.map((p) => p._id).join(', ')} absent. These gates assert exact fixture ` +
        'prices and stock, so running them against any other catalogue proves nothing — ' +
        'and against a real shop could place real orders. Boot with CATALOG_SOURCE=fixture.'
    )
  }
}
