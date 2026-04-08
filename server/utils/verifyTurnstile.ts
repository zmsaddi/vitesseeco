export async function verifyTurnstile(token: string): Promise<boolean> {
  if (!token) return false

  const secret = process.env.TURNSTILE_SECRET_KEY || useRuntimeConfig().turnstileSecretKey
  if (!secret) {
    console.warn('[verifyTurnstile] TURNSTILE_SECRET_KEY not configured — rejecting request')
    return false
  }

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
