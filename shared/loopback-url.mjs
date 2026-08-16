/**
 * Loopback-only URL validation, shared by every candidate-rig guard.
 *
 * Two tools decide whether a URL is safe to point destructive test machinery
 * at: scripts/seed-candidate.mjs (which TRUNCATEs the whole database) and
 * server/catalog/fixture.ts (which swaps the shop's catalogue for test data).
 * The rule they share lives here once, because a safety rule implemented
 * twice will disagree eventually — and this is not a rule that may drift.
 *
 * The rule: only the loopback interface is trusted. A database NAME proves
 * nothing — anyone can call a production database "test" — and a hosting
 * provider's environment variable proves nothing either. `localhost`,
 * `127.0.0.1` and IPv6 `::1` are the entire allowlist; there is deliberately
 * no flag, no escape hatch and no way to widen it from the environment.
 *
 * Plain .mjs with a .d.mts twin so the same file serves the Node script, the
 * bundled server and the unit suite without a build step.
 */

/**
 * @param {string | undefined | null} value
 * @returns {boolean} true only when `value` parses as a URL whose host is the
 * loopback interface. Unparseable, empty and hostless values are all false —
 * refusal is the default, never the exception.
 */
export function isLoopbackUrl(value) {
  if (!value) return false
  let hostname
  try {
    hostname = new URL(value).hostname
  } catch {
    return false
  }
  // WHATWG URL keeps the brackets on IPv6 hostnames.
  const host = hostname.replace(/^\[|\]$/g, '').toLowerCase()
  return host === 'localhost' || host === '127.0.0.1' || host === '::1'
}
