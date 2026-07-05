import { defineConfig } from 'sanity'
import { structureTool } from 'sanity/structure'
// @ts-ignore
import { visionTool } from '@sanity/vision'
// @ts-ignore
import { media } from 'sanity-plugin-media'
// @ts-ignore
import { languageFilter } from '@sanity/language-filter'
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

// One document each — deleting or duplicating them breaks the website.
const SINGLETONS = ['homePage', 'aboutPage', 'contactPage', 'legalPages', 'siteSettings']

// Created by the website (checkout / contact form), never by hand.
const SYSTEM_DOCS = ['order', 'contactMessage']

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
    visionTool(),
  ],

  schema: {
    types: schemaTypes,
    templates: (prev) => [
      ...prev,
      // One-click product creation with the right type preselected.
      { id: 'product-bike', title: '🚲 دراجة جديدة', schemaType: 'product', value: { productType: 'bike', isAvailable: true, stock: 0 } },
      { id: 'product-spare', title: '🔧 قطعة غيار جديدة', schemaType: 'product', value: { productType: 'spare_part', isAvailable: true, stock: 0 } },
      { id: 'product-accessory', title: '🎒 إكسسوار جديد', schemaType: 'product', value: { productType: 'accessory', isAvailable: true, stock: 0 } },
      { id: 'product-kids', title: '🧸 منتج أطفال جديد', schemaType: 'product', value: { productType: 'kids_car', isAvailable: true, stock: 0 } },
    ],
  },

  document: {
    // The global «create new» menu only offers documents editors actually
    // create by hand — no singletons, no orders, no contact messages.
    newDocumentOptions: (prev, { creationContext }) => {
      if (creationContext.type === 'global') {
        return prev.filter(
          (item) => !SINGLETONS.includes(item.templateId) && !SYSTEM_DOCS.includes(item.templateId)
        )
      }
      return prev
    },
    actions: (prev, context) => {
      if (SINGLETONS.includes(context.schemaType)) {
        return prev.filter(({ action }) => !['delete', 'duplicate', 'unpublish'].includes(action ?? ''))
      }
      if (SYSTEM_DOCS.includes(context.schemaType)) {
        return prev.filter(({ action }) => action !== 'duplicate')
      }
      if (context.schemaType === 'product') {
        return [...prev, duplicateAsColorAction]
      }
      return prev
    },
  },
})
