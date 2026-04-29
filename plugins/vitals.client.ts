/**
 * Web Vitals capture plugin (P5-01).
 *
 * Uses navigator.sendBeacon so reports survive even if the user closes the
 * tab right after the measurement. Lightweight (no external library) — we
 * read PerformanceObserver entries directly.
 *
 * Targets per ADR-05 / definition-of-done:
 *   LCP < 2.5s
 *   CLS < 0.1
 *   INP < 200ms (75th percentile)
 *
 * The ratings below mirror Google's "good / needs-improvement / poor" thresholds
 * so SQL queries can group by rating directly.
 */

function ratingFor(name: string, value: number): 'good' | 'needs-improvement' | 'poor' {
  switch (name) {
    case 'LCP':  return value <= 2500 ? 'good' : value <= 4000 ? 'needs-improvement' : 'poor'
    case 'CLS':  return value <= 0.1  ? 'good' : value <= 0.25 ? 'needs-improvement' : 'poor'
    case 'INP':  return value <= 200  ? 'good' : value <= 500  ? 'needs-improvement' : 'poor'
    case 'FCP':  return value <= 1800 ? 'good' : value <= 3000 ? 'needs-improvement' : 'poor'
    case 'TTFB': return value <= 800  ? 'good' : value <= 1800 ? 'needs-improvement' : 'poor'
    default:     return 'good'
  }
}

function getOrCreateSessionId(): string {
  const KEY = 've_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

function send(name: string, value: number) {
  const payload = JSON.stringify({
    name,
    value,
    rating: ratingFor(name, value),
    path: location.pathname,
    navigationType: (performance.getEntriesByType('navigation')[0] as any)?.type,
    sessionId: getOrCreateSessionId(),
  })

  // sendBeacon survives navigations; falls back to fetch keepalive
  if (navigator.sendBeacon) {
    navigator.sendBeacon('/api/events/vitals', new Blob([payload], { type: 'application/json' }))
  } else {
    fetch('/api/events/vitals', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => {})
  }
}

export default defineNuxtPlugin(() => {
  if (typeof PerformanceObserver === 'undefined') return

  // LCP — last entry wins, report on visibility change
  let lcp = 0
  try {
    const lcpObs = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      const last = entries[entries.length - 1] as any
      if (last?.startTime) lcp = last.startTime
    })
    lcpObs.observe({ type: 'largest-contentful-paint', buffered: true })
  } catch { /* unsupported */ }

  // CLS — accumulate
  let cls = 0
  try {
    const clsObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        if (!entry.hadRecentInput) cls += entry.value
      }
    })
    clsObs.observe({ type: 'layout-shift', buffered: true })
  } catch { /* unsupported */ }

  // INP — interaction latency, take the max
  let inp = 0
  try {
    const inpObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as any[]) {
        const dur = entry.duration ?? 0
        if (dur > inp) inp = dur
      }
    })
    inpObs.observe({ type: 'event', durationThreshold: 40, buffered: true } as any)
  } catch { /* unsupported */ }

  // FCP — single value
  try {
    const fcpObs = new PerformanceObserver((list) => {
      const entry = list.getEntries()[0] as any
      if (entry?.startTime) {
        send('FCP', entry.startTime)
        fcpObs.disconnect()
      }
    })
    fcpObs.observe({ type: 'paint', buffered: true })
  } catch { /* unsupported */ }

  // TTFB
  try {
    const nav = performance.getEntriesByType('navigation')[0] as any
    if (nav && nav.responseStart) send('TTFB', nav.responseStart)
  } catch { /* unsupported */ }

  // Flush LCP / CLS / INP on visibility change (page hidden = end of session for that page)
  const flush = () => {
    if (lcp) { send('LCP', lcp); lcp = 0 }
    if (cls) { send('CLS', cls); cls = 0 }
    if (inp) { send('INP', inp); inp = 0 }
  }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
})
