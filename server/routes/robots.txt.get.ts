/**
 * robots.txt
 *
 * AI answer engines are welcomed by name rather than left to the default rule.
 * A shop that wants to be recommended when someone asks an assistant for an
 * electric bike has to be readable by the assistants doing the recommending.
 *
 * Private paths are excluded from everyone. They are already behind
 * authentication — this only keeps them out of indexes.
 */
import { defineEventHandler, setResponseHeader } from 'h3'
import { PRIMARY_DOMAIN } from '../../shared/locales'

const AI_CRAWLERS = [
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'meta-externalagent',
  'Bingbot',
]

const PRIVATE_PATHS = ['/admin', '/compte', '/commande', '/api/']

export default defineEventHandler((event) => {
  const lines: string[] = []

  for (const agent of AI_CRAWLERS) {
    lines.push(`User-agent: ${agent}`, 'Allow: /')
    for (const path of PRIVATE_PATHS) lines.push(`Disallow: ${path}`)
    lines.push('')
  }

  lines.push('User-agent: *', 'Allow: /')
  for (const path of PRIVATE_PATHS) lines.push(`Disallow: ${path}`)
  lines.push('')
  lines.push(`Sitemap: https://${PRIMARY_DOMAIN}/sitemap.xml`)

  setResponseHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=86400')
  return lines.join('\n')
})
