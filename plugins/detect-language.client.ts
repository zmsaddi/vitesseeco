export default defineNuxtPlugin(() => {
  const { locale, setLocale } = useI18n()
  const cookie = useCookie('i18n_redirected')
  const route = useRoute()

  // Only detect on first visit (no cookie set yet) and on root path
  if (cookie.value || route.path !== '/') return

  const supportedLocales = ['fr', 'en', 'es', 'nl', 'de', 'ar']

  // 1. Device language (navigator.language / navigator.languages)
  const browserLangs = navigator.languages
    ? [...navigator.languages]
    : [navigator.language]

  let detectedLocale: string | null = null

  for (const lang of browserLangs) {
    // Try exact match first (e.g. "fr-FR" → "fr")
    const code = lang.split('-')[0].toLowerCase()
    if (supportedLocales.includes(code)) {
      detectedLocale = code
      break
    }
  }

  // 2. If no match from browser languages, try geolocation via timezone
  if (!detectedLocale) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    // Map timezone regions to likely languages
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
    // Europe/Paris and others → fall through to French default
  }

  // 3. Default to French
  if (!detectedLocale) {
    detectedLocale = 'fr'
  }

  // Apply if different from current locale
  if (detectedLocale !== locale.value) {
    setLocale(detectedLocale)
  }

  // Set cookie so we don't detect again
  cookie.value = detectedLocale
})
