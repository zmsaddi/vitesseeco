import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '..', 'i18n', 'locales')

const languages = ['fr', 'en', 'es', 'nl', 'de', 'ar']
let hasErrors = false

function getKeys(obj, prefix = '') {
  const keys = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      keys.push(...getKeys(obj[key], fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

// Load all locale files
const locales = {}
for (const lang of languages) {
  try {
    const content = readFileSync(join(localesDir, `${lang}.json`), 'utf-8')
    locales[lang] = JSON.parse(content)
  } catch (e) {
    console.error(`❌ Could not load ${lang}.json: ${e.message}`)
    hasErrors = true
  }
}

if (!hasErrors) {
  const frKeys = getKeys(locales.fr).sort()
  console.log(`\n📋 French (reference) has ${frKeys.length} keys\n`)

  for (const lang of languages) {
    if (lang === 'fr') continue
    const langKeys = getKeys(locales[lang]).sort()

    const missingInLang = frKeys.filter(k => !langKeys.includes(k))
    const extraInLang = langKeys.filter(k => !frKeys.includes(k))

    if (missingInLang.length > 0) {
      console.error(`❌ ${lang.toUpperCase()} missing ${missingInLang.length} keys:`)
      missingInLang.forEach(k => console.error(`   - ${k}`))
      hasErrors = true
    }
    if (extraInLang.length > 0) {
      console.error(`❌ ${lang.toUpperCase()} has ${extraInLang.length} extra keys:`)
      extraInLang.forEach(k => console.error(`   - ${k}`))
      hasErrors = true
    }
    if (missingInLang.length === 0 && extraInLang.length === 0) {
      console.log(`✅ ${lang.toUpperCase()} — ${langKeys.length} keys (matches FR)`)
    }
  }
}

if (hasErrors) {
  console.error('\n❌ LANGUAGE CHECK FAILED\n')
  process.exit(1)
} else {
  console.log('\n✅ ALL CHECKS PASSED\n')
}
