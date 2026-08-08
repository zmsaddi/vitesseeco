/**
 * The identifier that ties the colours of one model together.
 *
 * Two systems have to agree on it. Merchant Center reads it as `item_group_id`
 * and groups the feed entries; Google Search reads it as `productGroupID` /
 * `inProductGroupWithID` in the page's structured data and understands that six
 * near-identical pages are six colours rather than six duplicates. A different
 * value on each side would leave both of them guessing, so both import this.
 *
 * It also has to fit: Merchant caps `item_group_id` at 50 characters and
 * reported ours as too long — model families are slugs, and the longest in this
 * catalogue ran to 98.
 */

/** Merchant Center's limit for item_group_id. */
const LIMIT = 50

/**
 * A stable, length-safe group id.
 *
 * A value that fits passes through untouched, so existing groups never move.
 * One that does not keeps a readable prefix plus a short digest of the WHOLE
 * original — truncation alone would merge two families whose slugs share a long
 * prefix, and Google would show one model's colours under another's.
 */
export function groupId(modelFamily: string): string {
  if (modelFamily.length <= LIMIT) return modelFamily

  // FNV-1a: a few lines, stable across runs and platforms. This is a grouping
  // key, not something anyone has to defend cryptographically.
  let hash = 0x811c9dc5
  for (let i = 0; i < modelFamily.length; i++) {
    hash ^= modelFamily.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  const digest = hash.toString(36).padStart(7, '0')
  return `${modelFamily.slice(0, LIMIT - digest.length - 1)}-${digest}`
}
