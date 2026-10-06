/**
 * The sentences the candidate renders, read from the same locale files it was
 * built from.
 *
 * A spec that asserts on a message asserts on the words a customer reads, so a
 * key that renders raw — "errors.email_unavailable" under a field — fails
 * instead of matching itself. Reading the file rather than copying the text
 * keeps the assertion true when the wording is edited.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

type Locale = 'fr' | 'en' | 'nl' | 'de' | 'es' | 'ar'

const cache = new Map<Locale, Record<string, unknown>>()

function messages(locale: Locale): Record<string, unknown> {
  let loaded = cache.get(locale)
  if (!loaded) {
    loaded = JSON.parse(
      readFileSync(join(here, '..', '..', '..', '..', 'i18n', 'locales', `${locale}.json`), 'utf8')
    ) as Record<string, unknown>
    cache.set(locale, loaded)
  }
  return loaded
}

/** The text of a message key, with its {placeholders} filled; throws on an unknown key. */
export function message(key: string, params: Record<string, string | number> = {}, locale: Locale = 'fr'): string {
  const value = key
    .split('.')
    .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages(locale))
  if (typeof value !== 'string') throw new Error(`${locale}.json has no message ${key}`)
  return value.replace(/\{(\w+)\}/g, (whole, name: string) => (name in params ? String(params[name]) : whole))
}

/**
 * A message as a whole-text pattern, with one `{slot}` free to be anything
 * `fill` matches — for a sentence whose figure the spec cannot know to the
 * second, like how long a rate limit has left to run.
 */
export function messagePattern(key: string, slot: string, fill: string): RegExp {
  const escaped = message(key, { [slot]: '\u0000' }).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`^${escaped.replace('\u0000', fill)}$`)
}
