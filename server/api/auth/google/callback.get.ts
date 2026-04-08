import { google } from 'googleapis'
import { useDB } from '~/server/database/db'
import { customers, sessions } from '~/server/database/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const code = query.code as string
  const error = query.error as string

  if (error || !code) {
    return sendRedirect(event, `/connexion?error=${encodeURIComponent(error || 'no_code')}`)
  }

  // CSRF protection: verify state parameter
  const stateFromQuery = query.state as string
  const stateFromCookie = getCookie(event, 'oauth_state')
  deleteCookie(event, 'oauth_state', { path: '/' })

  if (!stateFromQuery || !stateFromCookie || stateFromQuery !== stateFromCookie) {
    return sendRedirect(event, '/connexion?error=invalid_state')
  }

  const clientId = process.env.NUXT_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.NUXT_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const host = getRequestHeader(event, 'host') || 'localhost:3000'
  const protocol = host.includes('localhost') ? 'http' : 'https'
  const redirectUri = `${protocol}://${host}/api/auth/google/callback`

  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri)

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)
    oauth2Client.setCredentials(tokens)

    // Get user info
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    const email = userInfo.email?.toLowerCase()
    if (!email) {
      return sendRedirect(event, '/connexion?error=no_email')
    }

    const db = useDB()

    // Find or create user
    let [customer] = await db.select().from(customers).where(eq(customers.email, email)).limit(1)

    if (!customer) {
      const passwordHash = await bcrypt.hash(crypto.randomUUID(), 12)
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

    // Set cookie
    setCookie(event, 'auth_token', token, {
      httpOnly: true,
      secure: protocol === 'https',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    })

    return sendRedirect(event, '/compte')
  } catch (e: any) {
    const msg = e.response?.data?.error_description || e.response?.data?.error || e.message || 'unknown'
    console.error('Google OAuth error:', msg)
    return sendRedirect(event, `/connexion?error=${encodeURIComponent(msg)}`)
  }
})
