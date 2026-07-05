/**
 * Postal code → city lookup (zip-first address UX, owner 2026-07-06).
 * Proxies zippopotam.us (free, no key) for the six shipping countries so
 * the client stays same-origin and responses are CDN-cacheable — a postal
 * code's city never changes.
 */
const RULES: Record<string, { min: number; pick: (raw: string) => string | null }> = {
  FR: { min: 5, pick: (r) => (/^\d{5}$/.test(r) ? r : null) },
  DE: { min: 5, pick: (r) => (/^\d{5}$/.test(r) ? r : null) },
  ES: { min: 5, pick: (r) => (/^\d{5}$/.test(r) ? r : null) },
  BE: { min: 4, pick: (r) => (/^\d{4}$/.test(r) ? r : null) },
  LU: { min: 4, pick: (r) => (/^\d{4}$/.test(r) ? r : null) },
  // NL codes are "1234 AB" — zippopotam indexes the 4-digit part.
  NL: { min: 4, pick: (r) => (/^\d{4}/.test(r) ? r.slice(0, 4) : null) },
}

export default defineEventHandler(async (event) => {
  const q = getQuery(event)
  const country = String(q.country || '').toUpperCase()
  const raw = String(q.code || '').replace(/\s/g, '').toUpperCase().slice(0, 10)

  const rule = RULES[country]
  const code = rule ? rule.pick(raw) : null

  // Same result for everyone → let the CDN keep it for a day.
  setHeader(event, 'Cache-Control', 'public, max-age=86400, s-maxage=86400')

  if (!code) return { city: null }

  try {
    const res: any = await $fetch(`https://api.zippopotam.us/${country.toLowerCase()}/${code}`, {
      timeout: 4000,
    })
    const place = res?.places?.[0]
    return {
      city: place?.['place name'] || null,
      region: place?.state || null,
    }
  } catch {
    // Unknown code or upstream hiccup — the field simply stays manual.
    return { city: null }
  }
})
