/**
 * Visitor country from Vercel's edge geolocation (x-vercel-ip-country).
 * Used ONLY for friendly defaults (shipping-zone preselection, country
 * field default) — the authoritative country is always the address the
 * customer types at checkout.
 *
 * Locally (no Vercel header) falls back to FR.
 */
const SUPPORTED_ZONES = ['FR', 'BE', 'LU', 'DE', 'NL', 'ES']

export default defineEventHandler((event) => {
  // Per-visitor data — must never be cached by the CDN.
  setHeader(event, 'Cache-Control', 'private, no-store')

  const raw = (getHeader(event, 'x-vercel-ip-country') || '').toUpperCase()
  return {
    country: SUPPORTED_ZONES.includes(raw) ? raw : 'FR',
    detected: raw || null,
  }
})
