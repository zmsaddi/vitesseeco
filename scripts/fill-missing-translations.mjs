/**
 * Fill missing English (en) and Arabic (ar) translations
 * for product names, category names, and color variant names in Sanity CMS.
 */

import { createClient } from '@sanity/client'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

function getSanityToken() {
  if (process.env.SANITY_TOKEN) return process.env.SANITY_TOKEN
  const configPaths = [
    join(process.env.HOME || process.env.USERPROFILE || '', '.config', 'sanity', 'config.json'),
    join(process.env.APPDATA || '', 'sanity', 'config.json'),
  ]
  for (const p of configPaths) {
    if (existsSync(p)) {
      const config = JSON.parse(readFileSync(p, 'utf-8'))
      if (config.authToken) return config.authToken
    }
  }
  throw new Error('No Sanity token found')
}

const client = createClient({
  projectId: '2jvnjf0c',
  dataset: 'production',
  apiVersion: '2024-01-01',
  token: getSanityToken(),
  useCdn: false,
})

// ── Product name translations ──
const productTranslations = {
  'prod-v20-mini':        { en: 'V20 Mini',         ar: 'V20 ميني' },
  'prod-v20-pro':         { en: 'V20 Pro',          ar: 'V20 برو' },
  'prod-v20-limited':     { en: 'V20 Limited',      ar: 'V20 ليمتد' },
  'prod-s20-pro':         { en: 'S20 Pro',          ar: 'S20 برو' },
  'prod-v20-cross':       { en: 'V20 Cross',        ar: 'V20 كروس' },
  'prod-q30':             { en: 'Q30 Foldable',     ar: 'Q30 قابل للطي' },
  'prod-d50':             { en: 'D50',              ar: 'D50' },
  'prod-c28':             { en: 'C28',              ar: 'C28' },
  'prod-eb30':            { en: 'EB30',             ar: 'EB30' },
  'prod-v20-max':         { en: 'V20 Max',          ar: 'V20 ماكس' },
  'prod-v20-limited-pro': { en: 'V20 Limited Pro',  ar: 'V20 ليمتد برو' },
}

// ── Category name translations ──
const categoryTranslations = {
  'cat-urban':     { en: 'Urban',      ar: 'حضري' },
  'cat-offroad':   { en: 'Off-Road',   ar: 'طرق وعرة' },
  'cat-pliable':   { en: 'Foldable',   ar: 'قابل للطي' },
  'cat-lady':      { en: 'Lady',       ar: 'نسائي' },
  'cat-longrange': { en: 'Long Range', ar: 'مدى طويل' },
}

// ── Color name translations (French → en/ar) ──
const colorTranslations = {
  'noir':       { en: 'Black',      ar: 'أسود' },
  'blanc':      { en: 'White',      ar: 'أبيض' },
  'gris nardo': { en: 'Nardo Grey', ar: 'رمادي ناردو' },
  'gris foncé': { en: 'Dark Grey',  ar: 'رمادي داكن' },
  'gris fonce': { en: 'Dark Grey',  ar: 'رمادي داكن' },
  'rose gold':  { en: 'Rose Gold',  ar: 'ذهبي وردي' },
  'violet':     { en: 'Purple',     ar: 'بنفسجي' },
  'vert':       { en: 'Green',      ar: 'أخضر' },
  'marron':     { en: 'Brown',      ar: 'بني' },
  'beige':      { en: 'Beige',      ar: 'بيج' },
}

function findColorTranslation(frenchName) {
  if (!frenchName) return null
  const key = frenchName.toLowerCase().trim()
  if (colorTranslations[key]) return colorTranslations[key]
  // partial match
  for (const [k, v] of Object.entries(colorTranslations)) {
    if (key.includes(k) || k.includes(key)) return v
  }
  return null
}

async function run() {
  let updated = 0
  let skipped = 0
  let errors = 0

  // ── 1. Update product names ──
  console.log('\n=== Updating product names ===')
  for (const [id, names] of Object.entries(productTranslations)) {
    try {
      const result = await client.patch(id)
        .set({ 'name.en': names.en, 'name.ar': names.ar })
        .commit()
      console.log(`  ✓ ${id}: en="${names.en}", ar="${names.ar}"`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${id}: ${err.message}`)
      errors++
    }
  }

  // ── 2. Update category names ──
  console.log('\n=== Updating category names ===')
  for (const [id, names] of Object.entries(categoryTranslations)) {
    try {
      const result = await client.patch(id)
        .set({ 'name.en': names.en, 'name.ar': names.ar })
        .commit()
      console.log(`  ✓ ${id}: en="${names.en}", ar="${names.ar}"`)
      updated++
    } catch (err) {
      console.error(`  ✗ ${id}: ${err.message}`)
      errors++
    }
  }

  // ── 3. Update color variant names inside products ──
  console.log('\n=== Updating color variant names ===')
  const products = await client.fetch(`*[_type == "product" && defined(variants)] { _id, variants }`)

  for (const product of products) {
    if (!product.variants || product.variants.length === 0) continue

    let needsUpdate = false
    const updatedVariants = product.variants.map((variant) => {
      const colorName = variant.colorName
      if (!colorName) return variant

      const frName = colorName.fr
      if (!frName) return variant

      const translation = findColorTranslation(frName)
      if (!translation) {
        console.log(`  ? ${product._id}: no translation for fr="${frName}"`)
        return variant
      }

      const missingEn = !colorName.en
      const missingAr = !colorName.ar

      if (!missingEn && !missingAr) {
        return variant
      }

      needsUpdate = true
      return {
        ...variant,
        colorName: {
          ...colorName,
          ...(missingEn ? { en: translation.en } : {}),
          ...(missingAr ? { ar: translation.ar } : {}),
        },
      }
    })

    if (needsUpdate) {
      try {
        await client.patch(product._id)
          .set({ variants: updatedVariants })
          .commit()
        const colors = updatedVariants
          .filter(v => v.colorName?.en || v.colorName?.ar)
          .map(v => `${v.colorName.fr}→en:${v.colorName.en},ar:${v.colorName.ar}`)
          .join(' | ')
        console.log(`  ✓ ${product._id}: ${colors}`)
        updated++
      } catch (err) {
        console.error(`  ✗ ${product._id} variants: ${err.message}`)
        errors++
      }
    } else {
      skipped++
    }
  }

  console.log(`\n=== Done ===`)
  console.log(`Updated: ${updated}, Skipped (already complete): ${skipped}, Errors: ${errors}`)
}

run().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
