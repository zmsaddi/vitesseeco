import { google } from 'googleapis'

export default defineEventHandler(async (event) => {
  const clientId = process.env.NUXT_GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.NUXT_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET
  const host = getRequestHeader(event, 'host') || 'unknown'

  try {
    const oauth2Client = new google.auth.OAuth2(
      clientId,
      clientSecret,
      `https://${host}/api/auth/google/callback`
    )

    // Just test that OAuth2 client can be created
    const authUrl = oauth2Client.generateAuthUrl({
      scope: ['email'],
    })

    return {
      status: 'ok',
      clientIdOk: !!clientId,
      secretOk: !!clientSecret,
      secretLength: clientSecret?.length,
      host,
      authUrlGenerated: !!authUrl,
    }
  } catch (e: any) {
    return {
      status: 'error',
      message: e.message,
    }
  }
})
