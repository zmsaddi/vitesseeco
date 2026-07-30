/**
 * Catalogue access.
 *
 * This module is server-only, and that is the point. The browser never talks to
 * Sanity, which means the dataset can be PRIVATE and read with a token — and a
 * private dataset cannot leak, whatever anyone later writes into it. The
 * previous build read the catalogue from the browser, which forced the dataset
 * public, which is how eleven order documents ended up world-readable.
 *
 * Reads are cached. The catalogue changes when the owner edits a product, not
 * when a visitor loads a page, so serving the same GROQ result for a minute is
 * both correct and the difference between one upstream request and thousands.
 */
import { createClient, type SanityClient } from '@sanity/client'
import type { SQL } from 'drizzle-orm'

let cachedClient: SanityClient | null = null

export function sanity(): SanityClient {
  if (cachedClient) return cachedClient

  const projectId = process.env.SANITY_PROJECT_ID ?? '2jvnjf0c'
  const dataset = process.env.SANITY_DATASET ?? 'production'
  const token = process.env.SANITY_TOKEN

  /**
   * Reads are authenticated by default, and the absence of a token is fatal by
   * default: failing loudly beats serving an empty catalogue that looks like a
   * shop with nothing in it.
   *
   * The one sanctioned exception is explicit. The dataset is still publicly
   * readable today — making it private is on the owner's cutover list — so a
   * local simulation can opt into token-less reads by setting
   * SANITY_ALLOW_PUBLIC_READ=1. The warning is unconditional and loud because
   * this flag has no business existing in a production environment, and if it
   * ever does, the log should say so on the very first catalogue read.
   */
  if (!token && process.env.SANITY_ALLOW_PUBLIC_READ !== '1') {
    throw new Error(
      'SANITY_TOKEN is not set. The catalogue dataset is read server-side with a token. ' +
        '(For a local simulation against the still-public dataset, set SANITY_ALLOW_PUBLIC_READ=1.)'
    )
  }
  if (!token) {
    console.warn(
      '[catalog] SANITY_ALLOW_PUBLIC_READ=1 — reading the dataset WITHOUT a token. ' +
        'Local simulation only; never run production like this.'
    )
  }

  cachedClient = createClient({
    projectId,
    dataset,
    ...(token ? { token } : {}),
    apiVersion: '2024-01-01',
    // The CDN cannot serve authenticated reads, and our own cache below is what
    // keeps the request count down.
    useCdn: false,
    perspective: 'published',
  })
  return cachedClient
}

interface CacheEntry {
  value: unknown
  expiresAt: number
}

const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<unknown>>()

const DEFAULT_TTL_MS = 60_000
const MAX_ENTRIES = 500

/**
 * Fetch with a short TTL and request coalescing.
 *
 * Coalescing matters more than the TTL: without it, a cold cache under load
 * sends one upstream request per visitor for the same query. With it, the first
 * caller fetches and everyone else waits on that same promise.
 */
export async function cachedFetch<T>(
  key: string,
  query: string,
  params: Record<string, unknown> = {},
  ttlMs: number = DEFAULT_TTL_MS
): Promise<T> {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value as T

  const pending = inflight.get(key)
  if (pending) return pending as Promise<T>

  const request = sanity()
    .fetch<T>(query, params)
    .then((value) => {
      if (cache.size >= MAX_ENTRIES) evictOldest(now)
      cache.set(key, { value, expiresAt: Date.now() + ttlMs })
      return value
    })
    .finally(() => {
      inflight.delete(key)
    })

  inflight.set(key, request)
  return request
}

function evictOldest(now: number): void {
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key)
  }
  // Still full: Map iterates in insertion order, so the head is the oldest.
  while (cache.size >= MAX_ENTRIES) {
    const oldest = cache.keys().next()
    if (oldest.done) break
    cache.delete(oldest.value)
  }
}

/** Drop cached results. Called after an editorial change, and by tests. */
export function invalidateCatalogCache(): void {
  cache.clear()
}

export type { SQL }
