export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    const cookie = useCookie('i18n_redirected')

    // Only detect on first visit (no cookie set yet)
    if (cookie.value) return

    // Only on root path
    if (window.location.pathname !== '/') return

    const supportedLocales = ['fr', 'en', 'es', 'nl', 'de', 'ar']

    // 1. Device language (navigator.language / navigator.languages)
    const browserLangs = navigator.languages
      ? [...navigator.languages]
      : [navigator.language]

    let detectedLocale: string | null = null

    for (const lang of browserLangs) {
      const code = lang.split('-')[0].toLowerCase()
      if (supportedLocales.includes(code)) {
        detectedLocale = code
        break
      }
    }

    // 2. If no match from browser languages, try geolocation via timezone
    if (!detectedLocale) {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
      if (tz.startsWith('Europe/Madrid') || tz.startsWith('America/')) {
        detectedLocale = 'es'
      } else if (tz.startsWith('Europe/Amsterdam') || tz.startsWith('Europe/Brussels')) {
        detectedLocale = 'nl'
      } else if (tz.startsWith('Europe/Berlin') || tz.startsWith('Europe/Vienna') || tz.startsWith('Europe/Zurich')) {
        detectedLocale = 'de'
      } else if (tz.startsWith('Europe/London') || tz.startsWith('Australia') || tz.startsWith('Pacific/Auckland')) {
        detectedLocale = 'en'
      } else if (tz.startsWith('Asia/Riyadh') || tz.startsWith('Asia/Dubai') || tz.startsWith('Africa/Cairo') || tz.startsWith('Africa/Casablanca') || tz.startsWith('Asia/Baghdad') || tz.startsWith('Asia/Beirut')) {
        detectedLocale = 'ar'
      }
    }

    // 3. Default to French
    if (!detectedLocale) {
      detectedLocale = 'fr'
    }

    // Set cookie first
    cookie.value = detectedLocale

    // Navigate to detected locale (instead of setLocale which causes hydration issues)
    if (detectedLocale !== 'fr') {
      navigateTo(`/${detectedLocale}`, { replace: true })
    }
  })
})
