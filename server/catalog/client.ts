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

  if (!token) {
    // Failing loudly beats serving an empty catalogue that looks like a shop
    // with nothing in it.
    throw new Error(
      'SANITY_TOKEN is not set. The catalogue dataset is private and is read server-side with a token.'
    )
  }

  cachedClient = createClient({
    projectId,
    dataset,
    token,
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
