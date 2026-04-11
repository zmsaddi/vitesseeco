/**
 * Smart language detection plugin.
 *
 * RULES:
 * 1. Site always loads in French by default
 * 2. If user previously chose a language via LanguageBanner or LanguageSwitcher → respect it
 * 3. If first visit + non-FR browser → detect language, store for LanguageBanner to show
 * 4. French speakers / France timezone → never prompted
 * 5. Clear any legacy i18n_redirected cookie from old system
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:mounted', () => {
    // ─── Step 1: Clear legacy cookie that auto-redirected users ───
    const legacyCookie = useCookie('i18n_redirected')
    if (legacyCookie.value && legacyCookie.value !== 'fr') {
      // User was auto-redirected by old system — clear and redirect to French
      const hadOldChoice = legacyCookie.value
      legacyCookie.value = null
      document.cookie = 'i18n_redirected=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;'

      // If currently on a non-FR locale path (e.g. /ar/, /en/), go to French root
      const path = window.location.pathname
      const localePrefix = path.match(/^\/(ar|en|es|nl|de)(\/|$)/)
      if (localePrefix) {
        const frenchPath = path.replace(/^\/(ar|en|es|nl|de)(\/|$)/, '/')
        // Store detected language so banner shows after redirect
        if (!localStorage.getItem('ve_lang_choice')) {
          localStorage.setItem('ve_lang_detected', hadOldChoice)
        }
        window.location.href = frenchPath
        return
      }
    }

    // ─── Step 2: If user already made a choice, respect it ───
    if (localStorage.getItem('ve_lang_choice')) return

    // ─── Step 3: If already detected, let LanguageBanner handle it ───
    if (localStorage.getItem('ve_lang_detected')) return

    // ─── Step 4: Detect user language ───
    const supportedLocales = ['fr', 'en', 'es', 'nl', 'de', 'ar']
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

    // Timezone fallback
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

    if (!detectedLocale) detectedLocale = 'fr'

    // ─── Step 5: French user? No banner needed ───
    if (detectedLocale === 'fr') {
      localStorage.setItem('ve_lang_choice', 'fr')
      return
    }

    // France-based user with French in browser langs? No banner
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''
    if (tz === 'Europe/Paris' && browserLangs.some(l => l.startsWith('fr'))) {
      localStorage.setItem('ve_lang_choice', 'fr')
      return
    }

    // ─── Step 6: Non-FR user → store for LanguageBanner ───
    localStorage.setItem('ve_lang_detected', detectedLocale)
  })
})
