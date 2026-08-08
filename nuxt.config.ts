import { DEFAULT_LOCALE, LOCALES, PRIMARY_DOMAIN } from './shared/locales'

/**
 * The catalogue's Sanity coordinates, needed at BUILD time by the image
 * provider. The server reads the same names from the environment at runtime;
 * these fall back to the project's own values so a build never silently
 * produces image URLs pointing at a dataset that does not exist.
 */
const SANITY_PROJECT_ID = process.env.SANITY_PROJECT_ID ?? '2jvnjf0c'
const SANITY_DATASET = process.env.SANITY_DATASET ?? 'production'

/**
 * Nuxt configuration for the rebuild.
 *
 * Locale configuration is DERIVED from shared/locales.ts rather than repeated
 * here. That manifest already decides prefixes, direction and country domains,
 * and a second copy would eventually disagree with it — which is how a site
 * ends up advertising an hreflang that 404s.
 */
export default defineNuxtConfig({
  /**
   * Server-rendered. Always, everywhere, on every machine.
   *
   * This read `process.env.VERCEL === '1'` from the first foundation commit,
   * which described it as "SSR on Vercel only (ssr: false on Windows)" — a
   * dev-time workaround for a Nuxt 3.21 problem that no longer exists. The
   * consequence outlived the reason: the application's most basic behaviour
   * depended on a hosting provider's environment variable.
   *
   * What that cost, measured on the same source with and without the variable:
   *
   *              /produits HTML   <title>   canonical   og: tags
   *   without         3,027 B      absent        0           0
   *   with           17,986 B     present        1          14
   *
   * Both served by `node .output/server/index.mjs`, the command the docs give.
   * So following the documentation produced an SEO-less shell, and nothing
   * failed — every gate that reads server-rendered HTML silently proved
   * nothing, and the one that mattered would have been the SEO work.
   *
   * Rendering on the server is also what lets the catalogue be read with a
   * token the browser never sees, which is not an optional property.
   */
  ssr: true,
  compatibilityDate: '2024-11-01',

  future: { compatibilityVersion: 4 },

  modules: ['@nuxtjs/tailwindcss', '@nuxtjs/i18n', '@nuxt/image', '@nuxt/icon', '@nuxt/fonts'],

  /**
   * Images.
   *
   * The module was registered and never configured, so every `<NuxtImg>` passed
   * its absolute cdn.sanity.io URL straight through. The `width` attribute set
   * the layout box and nothing else — a phone downloaded the same 2048x2048
   * master a desktop did, on a listing showing two dozen of them.
   *
   * @nuxt/image ships a Sanity provider, and it understands the absolute CDN
   * URLs this catalogue stores. A hand-written provider was tried first and took
   * production down with "setup is not a function": a custom provider has to be
   * wrapped in the module's own `defineProvider`, and the built-in one already
   * is. There was no reason to write one.
   *
   * The screens are the breakpoints the layout actually uses, so a generated
   * srcset offers widths the browser can choose between rather than a ladder
   * invented by the default.
   */
  image: {
    provider: 'sanity',
    sanity: { projectId: SANITY_PROJECT_ID, dataset: SANITY_DATASET },
    screens: { xs: 320, sm: 400, md: 640, lg: 900, xl: 1200, xxl: 1600 },
  },

  tailwindcss: {
    // `~` already IS app/ under the Nuxt 4 layout. The previous value said
    // `~/app/assets/…`, which resolves to app/app/… — a path that does not
    // exist — and the module fell back to its default CSS without failing the
    // build. Every utility class still worked, so pages LOOKED functional in
    // tests, while the entire design system (:root tokens, .btn, .field,
    // .card) silently never entered the bundle: transparent buttons,
    // borderless inputs, a shop rendered as a wireframe.
    cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }],
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
        { name: 'theme-color', content: '#007A5E' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' },
      ],
    },
  },
})
