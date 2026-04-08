export default defineNuxtConfig({
  ssr: process.env.VERCEL === '1',
  compatibilityDate: '2024-11-01',

  experimental: {
    payloadExtraction: false,
  },

  vue: {
    compilerOptions: {
      // Suppress hydration mismatch warnings in production
    },
  },

  modules: [
    '@nuxtjs/tailwindcss',
    '@nuxtjs/i18n',
    '@pinia/nuxt',
    '@nuxt/image',
    '@nuxtjs/sanity',
    '@nuxt/icon',
    '@nuxt/fonts',
  ],

  tailwindcss: {
    cssPath: ['~/assets/css/main.css', { injectPosition: 'first' }],
  },

  i18n: {
    langDir: 'locales',
    locales: [
      { code: 'fr', language: 'fr-FR', file: 'fr.json', name: 'Français' },
      { code: 'en', language: 'en-GB', file: 'en.json', name: 'English' },
      { code: 'es', language: 'es-ES', file: 'es.json', name: 'Español' },
      { code: 'nl', language: 'nl-NL', file: 'nl.json', name: 'Nederlands' },
      { code: 'de', language: 'de-DE', file: 'de.json', name: 'Deutsch' },
      { code: 'ar', language: 'ar-SA', file: 'ar.json', name: 'العربية', dir: 'rtl' },
    ],
    defaultLocale: 'fr',
    strategy: 'prefix_except_default',
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'i18n_redirected',
      cookieSecure: false,
      alwaysRedirect: false,
      fallbackLocale: 'fr',
      redirectOn: 'root',
    },
  },

  sanity: {
    projectId: '2jvnjf0c',
    dataset: 'production',
    useCdn: false,
    apiVersion: '2024-01-01',
  },

  fonts: {
    families: [
      { name: 'Inter', provider: 'google', weights: [300, 400, 500, 600, 700] },
      { name: 'Montserrat', provider: 'google', weights: [400, 500, 600, 700, 800] },
    ],
  },

  runtimeConfig: {
    sanityToken: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    resendApiKey: '',
    authSecret: '',
    databaseUrl: '',
    googleClientId: '',
    googleClientSecret: '',
    public: {
      sanityProjectId: '2jvnjf0c',
      sanityDataset: 'production',
      stripePublishableKey: '',
      siteUrl: 'https://vitesse-eco.fr',
    },
  },

  app: {
    head: {
      title: 'Vitesse Eco — Fatbikes Électriques',
      meta: [
        { name: 'description', content: 'Vitesse Eco — Votre spécialiste en fatbikes électriques en France. Découvrez notre gamme de vélos électriques premium.' },
        { name: 'theme-color', content: '#0A1628' },
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/logo.png' },
      ],
    },
  },
})
