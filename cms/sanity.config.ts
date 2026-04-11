import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
import { visionTool } from '@sanity/vision'
import { media } from 'sanity-plugin-media'
import { languageFilter } from '@sanity/language-filter'
import { assist } from '@sanity/assist'
import { colorInput } from '@sanity/color-input'
import { schemaTypes } from './schemas'
import { deskStructure } from './structure/deskStructure'

const LANGUAGES = [
  { id: 'fr', title: '🇫🇷 Français' },
  { id: 'en', title: '🇬🇧 English' },
  { id: 'es', title: '🇪🇸 Español' },
  { id: 'nl', title: '🇳🇱 Nederlands' },
  { id: 'de', title: '🇩🇪 Deutsch' },
  { id: 'ar', title: '🇸🇦 العربية' },
]

export default defineConfig({
  name: 'vitesseeco',
  title: 'Vitesse Eco',
  projectId: '2jvnjf0c',
  dataset: 'production',

  plugins: [
    structureTool({
      structure: deskStructure,
    }),

    // Language filter — show only selected language fields
    languageFilter({
      supportedLanguages: LANGUAGES,
      defaultLanguages: ['fr'],
      documentTypes: ['product', 'faq', 'article', 'landingPage', 'homePage', 'aboutPage', 'contactPage', 'legalPages', 'siteSettings', 'testimonial', 'category', 'shippingMethod'],
      filterField: (enclosingType, member, selectedLanguageIds) => {
        // Filter localizedString and localizedText fields
        if (
          enclosingType.name === 'localizedString' ||
          enclosingType.name === 'localizedText'
        ) {
          return selectedLanguageIds.includes(member.name)
        }
        return true
      },
    }),

    // Media library — visual image management
    media(),

    // Color picker for variants
    colorInput(),

    // AI Assist — helps write content
    assist(),

    // GROQ playground
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
  },

  // Studio theme
  studio: {
    components: {},
  },
})
