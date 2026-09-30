import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import { linkSaleMessage, notifyOwner, renderEmail, renderTelegram, type OwnerMessage } from '../../server/services/notify'

const message: OwnerMessage = {
  title: '💶 طلب مدفوع VE-1 — 1 250,00 €',
  lines: ['• 1 × V8 <Ultra> & co'],
  link: 'https://vitesse-eco.fr/admin/commandes/VE-1',
}

const ENV_KEYS = ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'RESEND_API_KEY', 'NOTIFY_EMAIL_FROM', 'NOTIFY_EMAIL_TO'] as const
let saved: Record<string, string | undefined>

beforeEach(() => {
  saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]))
  for (const key of ENV_KEYS) delete process.env[key]
})
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key]
    else process.env[key] = saved[key]
  }
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('rendering', () => {
  it('escapes what Telegram HTML would otherwise parse', () => {
    const text = renderTelegram(message)
    expect(text).toContain('<b>💶 طلب مدفوع VE-1')
    expect(text).toContain('V8 &lt;Ultra&gt; &amp; co')
    expect(text.endsWith(message.link)).toBe(true)
  })

  it('puts the title in the subject and the link last', () => {
    const email = renderEmail(message)
    expect(email.subject).toBe(message.title)
    expect(email.text.endsWith(message.link)).toBe(true)
  })
})

describe('notifyOwner', () => {
  it('sends nothing when no channel is configured', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    await notifyOwner(message)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('sends to both channels, the email to the configured list', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't0k'
    process.env.TELEGRAM_CHAT_ID = '42'
    process.env.RESEND_API_KEY = 're_x'
    process.env.NOTIFY_EMAIL_FROM = 'Shop <a@b.fr>'
    process.env.NOTIFY_EMAIL_TO = 'one@b.fr, two@b.fr'
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }))
    vi.stubGlobal('fetch', fetchSpy)
    await notifyOwner(message)
    const urls = fetchSpy.mock.calls.map(([url]) => String(url))
    expect(urls).toContain('https://api.telegram.org/bott0k/sendMessage')
    expect(urls).toContain('https://api.resend.com/emails')
    const email = JSON.parse(fetchSpy.mock.calls.find(([url]) => String(url).includes('resend'))![1].body)
    expect(email.to).toEqual(['one@b.fr', 'two@b.fr'])
    const telegram = JSON.parse(fetchSpy.mock.calls.find(([url]) => String(url).includes('telegram'))![1].body)
    expect(telegram).toMatchObject({ chat_id: '42', parse_mode: 'HTML' })
  })

  it('never throws: a dead channel is logged, the other still sends', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't0k'
    process.env.TELEGRAM_CHAT_ID = '42'
    process.env.RESEND_API_KEY = 're_x'
    process.env.NOTIFY_EMAIL_FROM = 'Shop <a@b.fr>'
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchSpy = vi.fn((url: string) =>
      url.includes('telegram') ? Promise.reject(new Error('network down')) : Promise.resolve(new Response('{}', { status: 200 }))
    )
    vi.stubGlobal('fetch', fetchSpy)
    await expect(notifyOwner(message)).resolves.toBeUndefined()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('telegram'), expect.stringContaining('network down'))
  })

  it('treats a non-2xx answer as a failure, not a success', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 't0k'
    process.env.TELEGRAM_CHAT_ID = '42'
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('chat not found', { status: 400 })))
    await notifyOwner(message)
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('telegram'), expect.stringContaining('400'))
  })
})

describe('linkSaleMessage', () => {
  const session = {
    id: 'cs_live_1',
    amount_total: 125000,
    created: 1790000000,
    customer_details: {
      individual_name: 'MAX MUSTERMANN',
      name: null,
      email: 'm@example.com',
      phone: '+436601234567',
      address: { line1: 'Musterstrasse 1', postal_code: '1030', city: 'Wien', country: 'AT' },
    },
    custom_fields: [
      { key: 'delivery', dropdown: { value: 'delivery' } },
      { key: 'address', text: { value: 'Beispielgasse 2' } },
    ],
  } as unknown as Stripe.Checkout.Session

  it('says who bought what, how it is handed over, and how much', () => {
    const built = linkSaleMessage(session, ['1 × V8 ULTRA MAX T'])
    // fr-FR groups thousands with a narrow no-break space (or a no-break space,
    // depending on the ICU version) — any space is the right answer.
    expect(built.title).toMatch(/1[\s  ]250,00/)
    expect(built.lines).toContain('• 1 × V8 ULTRA MAX T')
    expect(built.lines).toContain('الزبون: MAX MUSTERMANN')
    expect(built.lines).toContain('الهاتف: +436601234567')
    expect(built.lines.some((line) => line.includes('Beispielgasse 2'))).toBe(true)
    expect(built.lines.some((line) => line.includes('1030 Wien'))).toBe(true)
  })

  it('still reads when the checkout collected almost nothing', () => {
    const bare = { id: 'cs_1', amount_total: 0, created: 1790000000, customer_details: null } as unknown as Stripe.Checkout.Session
    const built = linkSaleMessage(bare, [])
    expect(built.lines).toContain('الزبون: —')
  })
})
