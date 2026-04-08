export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false

  const secret = process.env.TURNSTILE_SECRET_KEY || useRuntimeConfig().turnstileSecretKey
  if (!secret) return true // Skip if not configured (dev)

  try {
    const res = await $fetch<any>('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: { secret, response: token },
    })
    return res.success === true
  } catch {
    return false
  }
}
