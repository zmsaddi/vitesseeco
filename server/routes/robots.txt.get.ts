/**
 * robots.txt
 *
 * AI answer engines are welcomed by name rather than left to the default rule.
 * A shop that wants to be recommended when someone asks an assistant for an
 * electric bike has to be readable by the assistants doing the recommending.
 *
 * Private paths are excluded from everyone — they are already behind
 * authentication, so this only keeps them out of indexes. Each is emitted BOTH
 * bare and under every locale prefix: `/compte` and `/nl/compte` are different
 * URLs to a crawler, and a rule for one says nothing about the other. The
 * prefixes come from the locales manifest, so adding a language cannot quietly
 * expose an account page.
 *
 * There is deliberately no public/robots.txt. A static file of that name shadows
 * this route entirely, and the two then drift with nothing to say which one
 * crawlers are actually reading.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { LOCALES, PRIMARY_DOMAIN } from '../../shared/locales'

/**
 * The owner's line: information yes, content harvesting no.
 *
 * Answer agents fetch a page to answer one customer's question and send that
 * customer here — they are welcome everywhere a search engine is. Training
 * crawlers pull the site wholesale into model-training corpora and send
 * nobody — they are refused. Ordinary Googlebot is governed by neither list:
 * search and AI Overviews keep full access; Google-Extended below only
 * controls Gemini TRAINING.
 */
const ANSWER_AGENTS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Perplexity-User',
  'MistralAI-User',
  'DuckAssistBot',
  'YouBot',
  'Amazonbot',
  'Bingbot',
]

const TRAINING_CRAWLERS = [
  'GPTBot',
  'ClaudeBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'CCBot',
  'Bytespider',
  'cohere-ai',
]

/** Nothing here is useful in a search result, and some of it is personal. */
const PRIVATE_PATHS = [
  '/api/',
  '/admin',
  '/compte',
  '/panier',
  '/commande',
  '/connexion',
  '/inscription',
  '/favoris',
]

/** Every private path, bare and under each locale prefix. */
function disallowLines(): string[] {
  const prefixes = ['', ...LOCALES.map((locale) => locale.prefix).filter(Boolean)]
  const paths = new Set<string>()
  for (const path of PRIVATE_PATHS) {
    for (const prefix of prefixes) paths.add(`${prefix}${path}`)
  }
  return [...paths].sort().map((path) => `Disallow: ${path}`)
}

export default defineEventHandler((event) => {
  const disallow = disallowLines()
  // A preview deployment is the same shop on a different hostname. Indexed, it
  // competes with the real one for its own product queries and can show a
  // customer a build that was never released. Vercel sets VERCEL_ENV on every
  // deployment; anything that is not production refuses everyone outright.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
    setResponseHeader(event, 'X-Robots-Tag', 'noindex, nofollow')
    return ['User-agent: *', 'Disallow: /', ''].join('\n')
  }

  const lines: string[] = []

  // A named group REPLACES the wildcard group for that agent, so the private
  // paths are repeated in each rather than inherited.
  for (const agent of ANSWER_AGENTS) {
    lines.push(`User-agent: ${agent}`, 'Allow: /', ...disallow, '')
  }

  // Refused wholesale: the machine-readable summary at /llms.txt is the
  // information channel; the site's editorial content is not training data.
  for (const agent of TRAINING_CRAWLERS) {
    lines.push(`User-agent: ${agent}`, 'Disallow: /', '')
  }

  lines.push('User-agent: *', 'Allow: /', ...disallow, '')

  lines.push(`Sitemap: https://${PRIMARY_DOMAIN}/sitemap.xml`)
  // Pointed at explicitly, so an assistant takes these answers from the shop
  // rather than inferring them from a rendered page.
  lines.push(`# Machine-readable summary: https://${PRIMARY_DOMAIN}/llms.txt`)
  lines.push(`# Full product list:        https://${PRIMARY_DOMAIN}/llms-full.txt`)

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return lines.join('\n')
})
