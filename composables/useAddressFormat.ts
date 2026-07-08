/**
 * EU address helpers. A resolved suggestion sometimes comes back as a
 * street WITHOUT the house number the customer already typed (route-only
 * Google hits, street-type OSM hits). Never lose their number: re-attach
 * it in the local convention — FR/LU lead ("15 Rue X", incl. bis/ter),
 * BE/NL/DE/ES trail ("Hoofdstraat 15a").
 */
const NO_RE = /(?:^|[\s,])(\d+(?:\s?(?:bis|ter|quater)\b|[a-z])?)(?=$|[\s,])/i

export function preserveHouseNumber(resolved: string, typed: string, country: string): string {
  if (!resolved || /\d/.test(resolved)) return resolved
  const streetSeg = (typed || '').split(',')[0]
  const m = streetSeg.match(NO_RE)
  if (!m) return resolved
  const no = m[1].trim()
  const cc = (country || 'FR').toUpperCase()
  return cc === 'FR' || cc === 'LU' ? `${no} ${resolved}` : `${resolved} ${no}`
}
