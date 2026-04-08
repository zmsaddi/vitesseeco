export default defineEventHandler((event) => {
  const config = useRuntimeConfig()
  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.NUXT_GOOGLE_CLIENT_ID || config.googleClientId
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || process.env.NUXT_GOOGLE_CLIENT_SECRET || config.googleClientSecret
  const host = getRequestHeader(event, 'host') || 'unknown'
  
  return {
    hasClientId: !!clientId,
    clientIdStart: clientId ? clientId.substring(0, 15) + '...' : 'MISSING',
    clientIdLength: clientId?.length,
    hasSecret: !!clientSecret,
    secretStart: clientSecret ? clientSecret.substring(0, 8) + '...' : 'MISSING',
    secretLength: clientSecret?.length,
    host,
    redirectUri: `https://${host}/api/auth/google/callback`,
  }
})
