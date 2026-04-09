export default defineNuxtConfig({
  ssr: process.env.VERCEL === '1',
  compatibilityDate: '2024-11-01',

  experimental: {
    payloadExtraction: true,
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
    baseUrl: 'https://vitesse-eco.fr',
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
      cookieSecure: process.env.NODE_ENV === 'production',
      alwaysRedirect: false,
      fallbackLocale: 'fr',
      redirectOn: 'root',
    },
  },

  sanity: {
    projectId: '2jvnjf0c',
    dataset: 'production',
    useCdn: true,
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
    turnstileSecretKey: '',
    public: {
      sanityProjectId: '2jvnjf0c',
      sanityDataset: 'production',
      stripePublishableKey: '',
      siteUrl: 'https://vitesse-eco.fr',
      googlePlacesApiKey: '',
      turnstileSiteKey: '',
    },
  },

  app: {
    head: {
      title: 'Vitesse Eco — Fatbikes Électriques',
      meta: [
        { name: 'description', content: 'Vitesse Eco — Votre spécialiste en fatbikes électriques en France. Découvrez notre gamme de vélos électriques premium.' },
        { name: 'theme-color', content: '#0A1628' },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'Vitesse Eco' },
        { property: 'og:title', content: 'Vitesse Eco — Fatbikes Électriques Premium' },
        { property: 'og:description', content: 'Découvrez notre gamme de fatbikes électriques. Livraison gratuite en France. 11 modèles de 999€ à 1899€.' },
        { property: 'og:image', content: 'https://vitesse-eco.fr/poster.jpeg' },
        { property: 'og:url', content: 'https://vitesse-eco.fr' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Vitesse Eco — Fatbikes Électriques' },
        { name: 'twitter:description', content: 'Fatbikes électriques premium. Livraison gratuite en France.' },
        { name: 'twitter:image', content: 'https://vitesse-eco.fr/poster.jpeg' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' },
        { rel: 'privacy-policy', href: 'https://vitesse-eco.fr/politique-confidentialite' },
      ],
      script: [
        { type: 'application/ld+json', innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Vitesse Eco',
          url: 'https://vitesse-eco.fr',
          potentialAction: { '@type': 'SearchAction', target: 'https://vitesse-eco.fr/produits?q={search_term_string}', 'query-input': 'required name=search_term_string' },
        }) },
        { type: 'application/ld+json', innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: 'Vitesse Eco',
          url: 'https://vitesse-eco.fr',
          logo: 'https://vitesse-eco.fr/logo.png',
          contactPoint: {
            '@type': 'ContactPoint',
            email: 'contact@vitesse-eco.fr',
            contactType: 'customer service',
            availableLanguage: ['French', 'English', 'Spanish', 'Dutch', 'German', 'Arabic'],
          },
          address: {
            '@type': 'PostalAddress',
            streetAddress: '32 Rue du Faubourg du Pont Neuf',
            addressLocality: 'Poitiers',
            postalCode: '86000',
            addressCountry: 'FR',
          },
        }) },
      ],
    },
  },
})
