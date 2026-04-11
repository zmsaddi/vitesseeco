/**
 * Smart language detection plugin.
 * - Detects user's preferred language from browser/timezone
 * - Stores detection in localStorage (NOT cookie — no redirect)
 * - The LanguageBanner component reads this to show/hide the suggestion
 * - Users in France (fr language or Paris timezone) → never prompted
 */
export default defineNuxtPlugin(() => {
  // Already detected in this browser? Skip
  if (localStorage.getItem('ve_lang_choice')) return
  if (localStorage.getItem('ve_lang_detected')) return

  const supportedLocales = ['fr', 'en', 'es', 'nl', 'de', 'ar']

  // 1. Browser languages
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

  // 2. Timezone fallback
  if (!detectedLocale) {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    const tzMap: Record<string, string> = {
      'Europe/Madrid': 'es',
      'Europe/Amsterdam': 'nl', 'Europe/Brussels': 'nl',
      'Europe/Berlin': 'de', 'Europe/Vienna': 'de', 'Europe/Zurich': 'de',
      'Europe/London': 'en',
      'Asia/Riyadh': 'ar', 'Asia/Dubai': 'ar', 'Africa/Cairo': 'ar', 'Africa/Casablanca': 'ar',
    }
    for (const [tzPrefix, locale] of Object.entries(tzMap)) {
      if (tz.startsWith(tzPrefix)) { detectedLocale = locale; break }
    }
  }

  // 3. Default to French
  if (!detectedLocale) detectedLocale = 'fr'

  // If French → user is in target audience, no banner needed
  if (detectedLocale === 'fr') {
    localStorage.setItem('ve_lang_choice', 'fr')
    return
  }

  // Check if user is likely in France despite non-FR browser language
  // (e.g., expat with English browser in France)
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
  const isFranceTimezone = tz === 'Europe/Paris'
  const hasFrInBrowserLangs = browserLangs.some(l => l.split('-')[0].toLowerCase() === 'fr')

  if (isFranceTimezone && hasFrInBrowserLangs) {
    // French speaker in France — no banner
    localStorage.setItem('ve_lang_choice', 'fr')
    return
  }

  // Store detected locale — LanguageBanner will show suggestion
  localStorage.setItem('ve_lang_detected', detectedLocale)
})
