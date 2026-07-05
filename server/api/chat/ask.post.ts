/**
 * Chat widget Q&A endpoint.
 *
 * Two engines, picked at runtime:
 * - AI (when ANTHROPIC_API_KEY is set): Claude answers in the visitor's
 *   language, grounded on FAQ + catalog context. Model kept cheap (Haiku).
 * - Rules (default, zero external accounts): keyword-scored FAQ match from
 *   Sanity + product name search; falls back to a human handoff suggestion.
 *
 * The widget works identically either way — adding the key upgrades answers
 * without any code change (owner decision: external accounts wired later).
 */
import { createClient } from '@sanity/client'
import { rateLimit } from '~/server/utils/rateLimit'

const LOCALES = ['fr', 'en', 'es', 'nl', 'de', 'ar']

interface FaqRow {
  question: string | null
  answer: string | null
}
interface ProductRow {
  name: string | null
  slug: string | null
  price: number | null
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 3)
}

export default defineEventHandler(async (event) => {
  rateLimit(event, { maxRequests: 20, windowMs: 60_000 })

  const body = await readBody(event)
  const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 500) : ''
  const locale = LOCALES.includes(body?.locale) ? (body.locale as string) : 'fr'
  if (!message) throw createError({ statusCode: 400, message: 'Empty message' })

  const sanity = createClient({
    projectId: '2jvnjf0c',
    dataset: 'production',
    apiVersion: '2024-01-01',
    useCdn: true,
  })

  const [faqs, products] = await Promise.all([
    sanity.fetch<FaqRow[]>(
      `*[_type == "faq"]{
        "question": coalesce(question[$locale], question.fr, question.en),
        "answer": coalesce(answer[$locale], answer.fr, answer.en)
      }`,
      { locale }
    ),
    sanity.fetch<ProductRow[]>(
      `*[_type == "product" && isAvailable == true && defined(slug.current)]{
        "name": coalesce(name[$locale], name.fr),
        "slug": slug.current,
        price
      }`,
      { locale }
    ),
  ])

  const msgTokens = tokens(message)

  // ── AI engine ──────────────────────────────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (apiKey) {
    // Ground on the best-matching FAQ/product subset to keep tokens cheap.
    const faqContext = faqs
      .map((f) => ({ f, score: tokens(`${f.question} ${f.answer}`).filter((t) => msgTokens.includes(t)).length }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map(({ f }) => `Q: ${f.question}\nA: ${f.answer}`)
      .join('\n\n')
    const productContext = products
      .map((p) => ({ p, score: tokens(p.name || '').filter((t) => msgTokens.includes(t)).length }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ p }) => `${p.name} — ${p.price} € — https://vitesse-eco.fr/produits/${p.slug}`)
      .join('\n')

    try {
      const res: any = await $fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: {
          model: 'claude-haiku-4-5',
          max_tokens: 400,
          system: `You are the customer assistant of Vitesse Eco (vitesse-eco.fr), a French electric-mobility store in Poitiers (e-bikes, parts, accessories). Answer briefly and helpfully in the language of locale "${locale}". Use ONLY the context below; if the answer is not in it, say you'll connect them with an advisor. Never invent prices, stock or policies.\n\nFAQ:\n${faqContext}\n\nProducts:\n${productContext}`,
          messages: [{ role: 'user', content: message }],
        },
      })
      const text = res?.content?.[0]?.text
      if (text) return { answer: text, source: 'ai' as const }
    } catch (err) {
      console.error('[CHAT] AI engine failed, falling back to rules', err)
    }
  }

  // ── Rules engine ───────────────────────────────────────────────────────
  let bestFaq: FaqRow | null = null
  let bestScore = 0
  for (const f of faqs) {
    if (!f.question || !f.answer) continue
    const qTokens = tokens(`${f.question} ${f.answer}`)
    const score = msgTokens.filter((t) => qTokens.includes(t)).length
    if (score > bestScore) {
      bestScore = score
      bestFaq = f
    }
  }
  if (bestFaq && bestScore >= 2) {
    return { answer: bestFaq.answer as string, source: 'faq' as const }
  }

  const matched = products
    .map((p) => ({ p, score: tokens(p.name || '').filter((t) => msgTokens.includes(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ p }) => ({ name: p.name as string, slug: p.slug as string, price: p.price }))
  if (matched.length) {
    return { answer: '', source: 'products' as const, products: matched }
  }

  return { answer: '', source: 'fallback' as const, suggestWhatsApp: true }
})
