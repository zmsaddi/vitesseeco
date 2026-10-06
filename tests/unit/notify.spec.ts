import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type Stripe from 'stripe'
import {
  closedOrderPaymentMessage,
  linkSaleMessage,
  ltr,
  notifyOwner,
  plainText,
  renderEmail,
  renderTelegram,
  type OwnerMessage,
} from '../../server/services/notify'

const message: OwnerMessage = {
  ping: '💶 طلب <مدفوع> & جديد',
  pingLink: 'https://vitesse-eco.fr/admin/commandes',
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
    expect(text).toContain('<b>💶 طلب &lt;مدفوع&gt; &amp; جديد</b>')
    expect(text.endsWith(message.pingLink)).toBe(true)
  })

  it('gives Telegram the ping and the list, never the record', () => {
    const text = renderTelegram(message)
    expect(text).not.toContain('VE-1')
    expect(text).not.toContain('250')
    expect(text).not.toContain('V8')
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

describe('plainText', () => {
  it('keeps what names a town, in any script', () => {
    expect(plainText('Saint-Benoît')).toBe('Saint-Benoît')
    expect(plainText("L'Isle-d’Abeau")).toBe("L'Isle-d’Abeau")
    expect(plainText('الدار البيضاء')).toBe('الدار البيضاء')
  })

  it('leaves nothing a chat or mail client could turn into a link, a mention or a command', () => {
    const lure = plainText('https://vitesse-eco-admin.com/login @admin /start www.x.fr', 200)
    expect(lure).not.toMatch(/[.:/@]/)
  })

  it('cannot add a line or reorder the text around it', () => {
    expect(plainText('Poitiers\n\n⚠️ Alerte\u2028sécurité\u202e')).toBe('Poitiers Alerte sécurité')
  })

  it('is capped', () => {
    expect(plainText('a'.repeat(100))).toHaveLength(40)
    expect(plainText('a'.repeat(100)).endsWith('…')).toBe(true)
    expect(plainText(null)).toBe('')
  })
})

describe('right-to-left lines', () => {
  const LRM = '\u200E'

  it('marks an edge only where the bidi algorithm would move it', () => {
    // Digits or a sign right after Arabic would become Arabic-numeric.
    expect(ltr('+33745830049')).toBe(`${LRM}+33745830049`)
    expect(ltr('86000 Poitiers FR')).toBe(`${LRM}86000 Poitiers FR`)
    // A trailing symbol would take the line's direction.
    expect(ltr('1 250,00 €')).toBe(`${LRM}1 250,00 €${LRM}`)
    expect(ltr('Poitiers Reconnectez…')).toBe(`Poitiers Reconnectez…${LRM}`)
  })

  it('leaves identifiers clean, because they are copied into searches', () => {
    expect(ltr('ORD-MUVZ9UWLZTQ59E6A')).toBe('ORD-MUVZ9UWLZTQ59E6A')
    const alert = closedOrderPaymentMessage({ orderNumber: 'ORD-7', provider: 'paypal', reference: '8MC585209K746392H', status: 'cancelled' })
    expect(alert.lines).toContain('8MC585209K746392H')
    expect(alert.title).not.toContain(LRM)
  })
})

describe('linkSaleMessage', () => {
  const session = {
    id: 'cs_live_1',
    amount_total: 125000,
    created: 1790000000,
    livemode: true,
    payment_intent: 'pi_live_1',
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

  it('says what sold, for how much, where and how it is handed over', () => {
    const built = linkSaleMessage(session, ['1 × V8 ULTRA MAX T'])
    // fr-FR groups thousands with a narrow no-break space (or a no-break space,
    // depending on the ICU version) — any space is the right answer.
    expect(built.title).toMatch(/1[\s\u202f\u00a0]250,00/)
    expect(built.lines).toContain('• 1 × V8 ULTRA MAX T')
    expect(built.lines.some((line) => line.includes('1030 Wien AT'))).toBe(true)
    expect(built.lines.some((line) => line.startsWith('التسليم: توصيل'))).toBe(true)
    expect(built.link).toBe('https://dashboard.stripe.com/payments/pi_live_1')
  })

  it('carries no name, email, phone or street — Stripe has them, one tap away', () => {
    const everything = [renderTelegram(linkSaleMessage(session, [])), renderEmail(linkSaleMessage(session, [])).text].join('\n')
    for (const personal of ['MUSTERMANN', 'm@example.com', '6601234567', 'Musterstrasse', 'Beispielgasse']) {
      expect(everything).not.toContain(personal)
    }
  })

  it('points a test sale at the test dashboard', () => {
    const test = { ...session, livemode: false } as Stripe.Checkout.Session
    expect(linkSaleMessage(test, []).link).toBe('https://dashboard.stripe.com/test/payments/pi_live_1')
  })

  it('still reads when the checkout collected almost nothing', () => {
    const bare = { id: 'cs_1', amount_total: 0, created: 1790000000, customer_details: null } as unknown as Stripe.Checkout.Session
    const built = linkSaleMessage(bare, [])
    expect(built.title).toContain('0,00')
    expect(built.link).toBe('https://dashboard.stripe.com/payments')
  })

  it('keeps the euro sign with its amount in a right-to-left title', () => {
    expect(linkSaleMessage(session, []).title).toMatch(/\u200E1[\s\u202f\u00a0]250,00[\s\u00a0]€\u200E/)
  })
})

describe('closedOrderPaymentMessage', () => {
  it('names the order, the provider, the payment and what a person must do', () => {
    const built = closedOrderPaymentMessage({ orderNumber: 'ORD-1', provider: 'paypal', reference: 'CAP-9', status: 'cancelled' })
    expect(built.title).toContain('PayPal')
    expect(built.title).toContain('ORD-1')
    expect(built.lines.join(' ')).toContain('CAP-9')
    expect(built.lines.join(' ')).toContain('ملغى')
    expect(built.link.endsWith('/admin/commandes/ORD-1')).toBe(true)
  })

  it('speaks of Stripe for a Stripe payment', () => {
    const built = closedOrderPaymentMessage({ orderNumber: 'ORD-2', provider: 'stripe', reference: 'cs_live_9', status: 'cancelled' })
    expect(built.title).toContain('Stripe')
    expect(built.lines.join(' ')).toContain('cs_live_9')
  })
})
