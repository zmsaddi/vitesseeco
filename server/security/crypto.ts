/**
 * Cryptographic primitives.
 *
 * Everything here uses Node's crypto directly — no wrapper library, because a
 * wrapper is one more thing that can be misconfigured and one more supply-chain
 * dependency in the path of authentication.
 */
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto'
import bcrypt from 'bcryptjs'

/**
 * Work factor for password hashing. 12 is roughly 250ms on current serverless
 * hardware: slow enough to make offline cracking expensive, fast enough that a
 * login does not time out.
 */
const BCRYPT_ROUNDS = 12

/** 256 bits. Long enough that guessing is not a threat model. */
const TOKEN_BYTES = 32

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, BCRYPT_ROUNDS)
}

/**
 * Verify a password.
 *
 * When there is no stored hash — an account created through Google that has
 * never set one — a dummy comparison still runs. Returning early would make the
 * response measurably faster and turn the login form into an oracle for which
 * emails exist and how they registered.
 */
const DUMMY_HASH = '$2b$12$C6UzMDM.H6dfI/f/IKcEe.4pQ5UUlwvVmXjT.qGxCLGXBrrWKGhrO'

export async function verifyPassword(plaintext: string, storedHash: string | null): Promise<boolean> {
  if (!storedHash) {
    await bcrypt.compare(plaintext, DUMMY_HASH)
    return false
  }
  return bcrypt.compare(plaintext, storedHash)
}

/**
 * A session token and the value we store for it.
 *
 * The plaintext goes to the browser in an httpOnly cookie and is never written
 * down; only the hash is persisted. A stolen database backup therefore contains
 * no usable sessions.
 *
 * SHA-256 without a salt is correct here, unlike for passwords: the input is
 * 256 bits of entropy we generated, so there is nothing to brute-force and a
 * slow KDF would only add latency to every authenticated request.
 */
export function createSessionToken(): { token: string; tokenHash: string } {
  const token = randomBytes(TOKEN_BYTES).toString('base64url')
  return { token, tokenHash: hashToken(token) }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Compare two strings without leaking their common prefix through timing. */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8')
  const bufferB = Buffer.from(b, 'utf8')
  // timingSafeEqual throws on a length mismatch, which would itself be a leak,
  // so both are hashed to a fixed width first.
  const digestA = createHash('sha256').update(bufferA).digest()
  const digestB = createHash('sha256').update(bufferB).digest()
  return timingSafeEqual(digestA, digestB)
}

/**
 * Pseudonymise an IP address for storage.
 *
 * Rate limiting and abuse investigation need to tell visitors apart; neither
 * needs to know who they are. A keyed hash means the stored value cannot be
 * reversed by hashing the four billion IPv4 addresses.
 */
export function hashIp(ip: string): string {
  const salt = process.env.IP_HASH_SALT ?? process.env.AUTH_SECRET ?? ''
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

/**
 * Alphabet for order numbers: digits and upper-case letters minus I, L, O and
 * U. Those are the ones customers mishear on the phone and mistype from a
 * printed invoice, and U is dropped so no random run spells something unwanted.
 */
const READABLE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'

/**
 * Order numbers: a time prefix so they sort chronologically, then 40 bits of
 * randomness.
 *
 * The randomness is not decoration. `order_number` is unique, so two checkouts
 * landing in the same millisecond with a short suffix means the second one
 * fails — after its payment session already exists at the provider. Forty bits
 * makes that outcome vanishingly unlikely: five random bytes encode to exactly
 * eight symbols with no modulo bias.
 */
export function generateOrderNumber(): string {
  const stamp = Date.now().toString(36).toUpperCase()

  const bytes = randomBytes(5)
  let bits = 0n
  for (const byte of bytes) bits = (bits << 8n) | BigInt(byte)

  let suffix = ''
  for (let i = 0; i < 8; i++) {
    const index = Number((bits >> BigInt(5 * (7 - i))) & 0b11111n)
    suffix += READABLE_ALPHABET[index]
  }

  return `ORD-${stamp}${suffix}`
}

export function newId(): string {
  return randomUUID()
}

/** URL-safe random string, for CSRF tokens and one-time links. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}
