const store = new Map<string, { count: number; resetAt: number }>()

// Safety bound so a burst of distinct keys cannot exhaust the instance memory
const MAX_ENTRIES = 50_000

function prune(now: number) {
  for (const [key, val] of store) {
    if (val.resetAt < now) store.delete(key)
  }
}

// Clean up expired entries every 5 minutes
setInterval(() => prune(Date.now()), 5 * 60 * 1000)

export function rateLimit(
  event: Parameters<typeof getRequestHeader>[0] & { path: string },
  opts: { maxRequests?: number; windowMs?: number } = {}
) {
  const { maxRequests = 30, windowMs = 60_000 } = opts

  // Get client IP — only the hop appended by the platform is trustworthy,
  // any earlier x-forwarded-for entry is client-supplied
  const forwarded = getRequestHeader(event, 'x-forwarded-for')?.split(',') ?? []
  const ip =
    getRequestHeader(event, 'x-real-ip')?.trim() ||
    forwarded[forwarded.length - 1]?.trim() ||
    'unknown'

  // event.path carries the query string, which the caller controls — key on the route only
  const path = event.path.split('?')[0] ?? event.path
  const key = `${ip}:${path}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
    if (store.size >= MAX_ENTRIES) {
      prune(now)
      // Map iterates in insertion order, so the head holds the oldest buckets
      for (const oldest of store.keys()) {
        if (store.size < MAX_ENTRIES) break
        store.delete(oldest)
      }
    }
    store.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  entry.count++

  if (entry.count > maxRequests) {
    throw createError({
      statusCode: 429,
      message: 'Too many requests. Please try again later.',
    })
  }
}
