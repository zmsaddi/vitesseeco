import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
// @ts-ignore
import { visionTool } from '@sanity/vision'
// @ts-ignore
import { media } from 'sanity-plugin-media'
// @ts-ignore
import { languageFilter } from '@sanity/language-filter'
// @ts-ignore
import { assist } from '@sanity/assist'
// @ts-ignore
import { colorInput } from '@sanity/color-input'
import { schemaTypes } from './schemas'
import { deskStructure } from './structure/deskStructure'
import { duplicateAsColorAction } from './plugins/duplicateAsColor'

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
    structureTool({ structure: deskStructure }),
    languageFilter({
      supportedLanguages: LANGUAGES,
      defaultLanguages: ['fr'],
      documentTypes: ['product', 'faq', 'article', 'landingPage', 'homePage', 'aboutPage', 'contactPage', 'legalPages', 'siteSettings', 'testimonial', 'category', 'shippingMethod'],
      filterField: (enclosingType: any, member: any, selectedLanguageIds: any) => {
        if (enclosingType.name === 'localizedString' || enclosingType.name === 'localizedText') {
          return selectedLanguageIds.includes(member.name)
        }
        return true
      },
    }),
    colorInput(),
    media(),
    assist(),
    visionTool(),
  ],

  schema: { types: schemaTypes },

  document: {
    actions: (prev, context) => {
      if (context.schemaType === 'product') {
        return [...prev, duplicateAsColorAction]
      }
      return prev
    },
  },
})
