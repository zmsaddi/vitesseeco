import product from './product'
import category from './category'
import brand from './brand'
import colorVariant from './colorVariant'
import homePage from './homePage'
import aboutPage from './aboutPage'
import contactPage from './contactPage'
import legalPages from './legalPages'
import promoCode from './promoCode'
import testimonial from './testimonial'
import siteSettings from './siteSettings'
import localizedString from './localizedString'
import localizedText from './localizedText'
import seoFields from './seoFields'

export const schemaTypes = [
  // Object types (must be first)
  localizedString,
  localizedText,
  seoFields,
  colorVariant,

  // Documents
  product,
  category,
  brand,
  promoCode,
  testimonial,

  // Singletons (pages)
  homePage,
  aboutPage,
  contactPage,
  legalPages,
  siteSettings,
]
