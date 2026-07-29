import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const localesDir = join(__dirname, '..', 'i18n', 'locales')

const languages = ['fr', 'en', 'es', 'nl', 'de', 'ar']
let hasErrors = false

function getEntries(obj, prefix = '') {
  const entries = []
  for (const key of Object.keys(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof obj[key] === 'object' && obj[key] !== null) {
      entries.push(...getEntries(obj[key], fullKey))
    } else {
      entries.push([fullKey, String(obj[key])])
    }
  }
  return entries
}

function getKeys(obj, prefix = '') {
  return getEntries(obj, prefix).map(([key]) => key)
}

// vue-i18n reads "{name}" as an interpolation slot
function getPlaceholders(value) {
  return [...new Set(value.match(/\{[^{}]*\}/g) || [])].sort()
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

  const entries = {}
  for (const lang of languages) {
    entries[lang] = new Map(getEntries(locales[lang]))
  }

  // vue-i18n splits a message on "|" as a plural-form separator and renders only the
  // first segment — a literal pipe silently truncates the string at runtime
  let pipedCount = 0
  for (const lang of languages) {
    const piped = [...entries[lang]].filter(([, value]) => value.includes('|'))
    if (piped.length > 0) {
      console.error(`\n❌ ${lang.toUpperCase()} has ${piped.length} values containing "|" (plural separator — use " · "):`)
      piped.forEach(([key, value]) => console.error(`   - ${key}: ${value}`))
      pipedCount += piped.length
      hasErrors = true
    }
  }
  if (pipedCount === 0) {
    console.log(`\n✅ No "|" plural separators in any locale`)
  }

  let placeholderMismatches = 0
  for (const [key, frValue] of entries.fr) {
    const expected = getPlaceholders(frValue).join(' ')
    for (const lang of languages) {
      if (lang === 'fr') continue
      const value = entries[lang].get(key)
      if (value === undefined) continue
      const actual = getPlaceholders(value).join(' ')
      if (actual !== expected) {
        if (placeholderMismatches === 0) console.error('\n❌ Placeholder mismatches (must be identical across locales):')
        console.error(`   - ${key} — FR [${expected}] vs ${lang.toUpperCase()} [${actual}]`)
        placeholderMismatches++
        hasErrors = true
      }
    }
  }
  if (placeholderMismatches === 0) {
    console.log('✅ Placeholders match FR in every locale')
  }
}

if (hasErrors) {
  console.error('\n❌ LANGUAGE CHECK FAILED\n')
  process.exit(1)
} else {
  console.log('\n✅ ALL CHECKS PASSED\n')
}
