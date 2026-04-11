export default defineEventHandler((event) => {
  setResponseHeaders(event, {
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://challenges.cloudflare.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",  // unsafe-inline required for Tailwind/Vue inline styles
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' https://cdn.sanity.io data: blob:",
      "connect-src 'self' https://*.sanity.io https://*.apicdn.sanity.io wss://*.sanity.io https://www.google.com https://api.iconify.design https://challenges.cloudflare.com",
      "frame-src https://www.google.com https://maps.google.com https://challenges.cloudflare.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  })
})
