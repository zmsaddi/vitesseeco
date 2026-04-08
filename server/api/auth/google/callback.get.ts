import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string

  if (!code) {
    return sendRedirect(event, '/connexion?error=google_failed')
  }

  const config = useRuntimeConfig()
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NUXT_GOOGLE_CLIENT_ID || config.googleClientId
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NUXT_GOOGLE_CLIENT_SECRET || config.googleClientSecret

  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`

  try {
    // Exchange code for tokens
    const tokenRes = await $fetch<any>('https://oauth2.googleapis.com/token', {
      method: 'POST',
      body: {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      },
    })

    // Get user info
    const userInfo = await $fetch<any>('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenRes.access_token}` },
    })

    const email = userInfo.email?.toLowerCase()
    if (!email) {
      return sendRedirect(event, '/connexion?error=no_email')
    }

    const db = useDB()

    // Check if user exists
    let [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1)

    if (!customer) {
      // Create new account from Google profile
      const randomPass = crypto.randomUUID()
      const passwordHash = await bcrypt.hash(randomPass, 12)

      const [newCustomer] = await db.insert(customers).values({
        email,
        passwordHash,
        firstName: userInfo.given_name || userInfo.name?.split(' ')[0] || 'User',
        lastName: userInfo.family_name || userInfo.name?.split(' ').slice(1).join(' ') || '',
      }).returning()

      customer = newCustomer
    }

    // Create session
    const token = crypto.randomUUID()
    await db.insert(sessions).values({
      customerId: customer.id,
      token,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    })

    setCookie(event, 'auth_token', token, {
      httpOnly: true,
      secure: !host.includes('localhost'),
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return sendRedirect(event, '/compte')
  } catch (e: any) {
    console.error('Google OAuth error:', e.message)
    return sendRedirect(event, '/connexion?error=google_failed')
  }
})
