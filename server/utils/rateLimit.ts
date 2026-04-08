const store = new Map<string, { count: number; resetAt: number }>()

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now()
  for (const [key, val] of store) {
    if (val.resetAt < now) store.delete(key)
  }
}, 5 * 60 * 1000)

export function rateLimit(
  event: any,
  opts: { maxRequests?: number; windowMs?: number } = {}
) {
  const { maxRequests = 30, windowMs = 60_000 } = opts

  // Get client IP
  const forwarded = getRequestHeader(event, 'x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || getRequestHeader(event, 'x-real-ip') || 'unknown'

  const key = `${ip}:${event.path}`
  const now = Date.now()

  const entry = store.get(key)

  if (!entry || entry.resetAt < now) {
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
