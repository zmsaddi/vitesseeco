import { DEFAULT_LOCALE, LOCALES, PRIMARY_DOMAIN } from './shared/locales'

/**
 * Nuxt configuration for the rebuild.
 *
 * Locale configuration is DERIVED from shared/locales.ts rather than repeated
 * here. That manifest already decides prefixes, direction and country domains,
 * and a second copy would eventually disagree with it — which is how a site
 * ends up advertising an hreflang that 404s.
 */
export default defineNuxtConfig({
  // Server-rendered in production. Rendering on the server is also what lets the
  // catalogue be read with a token the browser never sees.
  ssr: process.env.VERCEL === '1',
  compatibilityDate: '2024-11-01',

  future: { compatibilityVersion: 4 },

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n', '@nuxt/image', '@nuxt/icon', '@nuxt/fonts'],

  tailwindcss: {
    cssPath: ['~/app/assets/css/main.css', { injectPosition: 'first' }],
  },

  i18n: {
    baseUrl: `https://${PRIMARY_DOMAIN}`,
    defaultLocale: DEFAULT_LOCALE,
    strategy: 'prefix_except_default',
    langDir: 'locales',
    locales: LOCALES.map((locale) => ({
      code: locale.code,
      language: locale.hreflang,
      name: locale.label,
      file: `${locale.code}.json`,
      ...(locale.dir === 'rtl' ? { dir: 'rtl' as const } : {}),
    })),
    // Detection is ours: it runs in a server middleware that can see the CDN
    // country header, and it never redirects a URL that already states its
    // locale — which is what keeps crawlers seeing the page they asked for.
    detectBrowserLanguage: false,
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [400, 500, 600, 700] },
      { name: 'Manrope', provider: 'google', weights: [500, 600, 700, 800] },
    ],
  },

  runtimeConfig: {
    // Server-only. Nothing here is ever serialised into the page.
    databaseUrl: '',
    authSecret: '',
    ipHashSalt: '',
    sanityToken: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    adminEmails: '',
    turnstileSecretKey: '',
    resendApiKey: '',
    googleClientId: '',
    googleClientSecret: '',

    public: {
      siteUrl: `https://${PRIMARY_DOMAIN}`,
      stripePublishableKey: '',
      turnstileSiteKey: '',
    },
  },

  nitro: {
    // Fail the build rather than ship a route that throws at request time.
    typescript: { strict: true },
  },

  typescript: {
    strict: true,
    typeCheck: false,
    tsConfig: {
      // The Studio is a separate application with its own toolchain and its own
      // tsconfig; type-checking it from here checks it against the wrong
      // settings and doubles the work for no signal.
      exclude: ['../cms', '../assets-reference', '../import-data', '../competitor-research'],
    },
  },

  app: {
    head: {
      htmlAttrs: { lang: DEFAULT_LOCALE },
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
        { name: 'theme-color', content: '#0B1220' },
      ],
      link: [{ rel: 'icon', href: '/favicon.ico' }],
    },
  },
})
