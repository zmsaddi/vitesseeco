/**
 * The invoice page, as the tablet at the counter lives it.
 *
 * The seller fills the handover form, then passes the device across: the
 * customer signs on a screen of their own and hands it back, and only the
 * seller's long press brings the list back. That list holds every other
 * buyer's name, email and phone, so every way back the page itself can see — a
 * reload, the back gesture, the history menu within the same page load — must
 * keep the customer on their screen, and none of it may leave the seller's own
 * navigation broken after. A jump through the history menu to a page loaded
 * earlier in the tab leaves without telling the page; the device's own lock
 * (Guided Access, screen pinning) answers that one, not this file.
 *
 * The sales are synthetic and served to the BROWSER: the page is reached by a
 * client-side link so its list request goes through the browser, where it is
 * answered here. The candidate needs no Stripe key, and nothing in this file
 * can change a real sale: the one server render it asks for, as a control,
 * only reads the list — and without a key, fails to.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { devices, type Page, type Route } from '@playwright/test'
import { test, expect, waitForHydration } from '../helpers/test'
import { adminCookies } from '../helpers/admin'

const locales = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'i18n', 'locales')
const FR = JSON.parse(readFileSync(join(locales, 'fr.json'), 'utf8')).admin as Record<string, string>
const AR = JSON.parse(readFileSync(join(locales, 'ar.json'), 'utf8')).admin as Record<string, string>

// The counter tablet, in the Chromium the gates install. Its own default
// browser is WebKit, which the rig does not ship.
const { defaultBrowserType: _webkit, ...iPad } = devices['iPad Mini']
test.use(iPad)

// One admin login for the whole file, so the tests share one worker and run in order.
test.describe.configure({ mode: 'serial' })

const DAY = 86_400_000

interface Sale {
  sessionId: string
  paidAt: string
  amountTotal: number
  productName: string
  email: string | null
  phone: string | null
  fulfilment: 'pickup' | 'delivery' | null
  deliveryAddress: string | null
  promotionCode: string | null
  paymentMethod: string
  billing: { name?: string; line1?: string; postalCode?: string; city?: string; country?: string }
  invoice: { id: string; number: string; hostedUrl: string | null; message: { subject: string; body: string } } | null
  handoverFileId: string | null
  deliveryFee: number | null
  feeUnknown: boolean
  pendingAttempt: boolean
  pendingInvoice: {
    id: string
    number: string
    frameNumber: string
    deliveredOn: string
    customerName: string | null
    total: number
    deliveryFeeIncluded: boolean
  } | null
  blocked: 'refunded' | 'disputed' | 'stripe_invoice' | null
  reversal: 'dispute_open' | 'credit_note_due' | 'dispute_in_review' | 'settled' | null
  stripeInvoiceNumber: string | null
}

const BUYERS = [
  ['MAX MUSTERMANN', 'AT'],
  ['ERIKA MUSTERMANN', 'DE'],
  ['JEAN DUPONT', 'FR'],
  ['MARIE DUPONT', 'BE'],
  ['JAN JANSEN', 'NL'],
  ['JUAN PEREZ', 'ES'],
] as const

function sale(index: number, overrides: Partial<Sale> = {}): Sale {
  const [name, country] = BUYERS[index]!
  return {
    sessionId: `cs_test_handover${index}`,
    paidAt: new Date(Date.now() - 2 * DAY).toISOString(),
    amountTotal: 125000,
    productName: 'V8 ULTRA MAX T',
    email: `buyer${index}@example.com`,
    phone: '+436601234567',
    fulfilment: 'pickup',
    deliveryAddress: null,
    promotionCode: null,
    paymentMethod: 'Carte bancaire',
    billing: { name, line1: 'Musterstrasse 1', postalCode: '1010', city: 'Wien', country },
    invoice: null,
    handoverFileId: null,
    deliveryFee: null,
    feeUnknown: false,
    pendingAttempt: false,
    pendingInvoice: null,
    blocked: null,
    reversal: null,
    stripeInvoiceNumber: null,
    ...overrides,
  }
}

let cookies: Awaited<ReturnType<typeof adminCookies>>
test.beforeAll(async ({ baseURL }) => {
  cookies = await adminCookies(baseURL!)
})

/** Sales the browser is told exist, and how often it asked. */
let items: Sale[] = []
let listRequests = 0

test.beforeEach(async ({ context }) => {
  items = BUYERS.map((_, index) => sale(index))
  listRequests = 0
  await context.addCookies(cookies)
  await context.route('**/api/admin/link-sales', (route: Route) => {
    listRequests++
    return route.fulfill({ json: { items, unreadable: 0 } })
  })
})

/** Server-rendered dashboard first, then the panel's own link: the list request is the browser's. */
async function openInvoices(page: Page, prefix = ''): Promise<void> {
  page.on('dialog', (dialog) => dialog.accept())
  await page.goto(`${prefix}/admin`)
  await page.locator(`header a[href="${prefix}/admin/factures"]`).click()
  await expect(page.locator('main li').first()).toBeVisible()
}

const card = (page: Page, index: number) => page.locator('main li', { hasText: `buyer${index}@example.com` })

async function draw(page: Page): Promise<void> {
  const box = (await page.getByRole('dialog').locator('canvas').boundingBox())!
  await page.mouse.move(box.x + 20, box.y + 80)
  await page.mouse.down()
  for (let i = 0; i <= 30; i++) await page.mouse.move(box.x + 20 + i * 10, box.y + 80 - Math.sin(i / 3) * 40)
  await page.mouse.up()
}

/** Changes whenever an entry is added: the length, or — when forward entries were dropped — the state. */
const historyState = (page: Page) => page.evaluate(() => `${history.length} ${JSON.stringify(history.state)}`)

async function openSigning(page: Page, index: number, frame = `FRAME-${index}`): Promise<void> {
  await card(page, index).getByLabel(FR.frame_number!).fill(frame)
  const before = await historyState(page)
  await card(page, index).getByRole('button', { name: FR.take_signature }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // The customer's screen has its own history entry before anyone reaches for Back.
  await expect.poll(() => historyState(page)).not.toBe(before)
}

async function signAndHandBack(page: Page, index: number, frame?: string): Promise<void> {
  await openSigning(page, index, frame)
  await draw(page)
  // The customer's own "I confirm and sign", in whichever language they read.
  await page.getByRole('dialog').locator('button.btn-primary').click()
}

async function holdToResume(page: Page, label = FR.hand_back_hold!): Promise<void> {
  const hold = page.getByRole('button', { name: label })
  const box = (await hold.boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  await page.waitForTimeout(1500)
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toHaveCount(0)
}

/** Whether the device still counts as in the customer's hands — the cookie the server reads. */
const handedOver = async (page: Page) => (await page.context().cookies()).some((cookie) => cookie.name === 'vs_handed_over')

/**
 * A slow tablet: the router's step back over the customer's entry takes `ms`.
 * For that long the hand-back screen is still up although its hold has already
 * fired — the moment in which a press used to start a hold nobody ended.
 */
async function slowStepBack(page: Page, ms = 300): Promise<void> {
  await page.addInitScript((delay) => {
    const go = history.go.bind(history)
    history.go = (delta?: number) => void setTimeout(() => go(delta), delay)
  }, ms)
}

/** The seller takes the signature again straight away, and the customer must keep that screen. */
async function customerKeepsTheNextScreen(page: Page): Promise<void> {
  await card(page, 0).getByRole('button', { name: FR.signature_again }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  // Past any 1.2 s timer a press during the step back could have left running.
  await page.waitForTimeout(1600)
  expect(await page.getByRole('dialog').count(), 'the customer’s screen was resumed under them').toBe(1)
  expect(await page.locator('main li').count(), 'the buyer list is on the customer’s screen').toBe(0)
  expect(await handedOver(page), 'the device no longer counts as in the customer’s hands').toBe(true)
}

const HAND_BACK_DE = 'Bitte geben Sie das Gerät dem Verkäufer zurück'

/**
 * What a server render left in the page's payload for the buyer list's fetch:
 * its answer under `data`, or its failure under `_errors`. The payload is
 * devalue's flat array — every value an index into it, negative ones standing
 * for undefined — and Nuxt wraps some containers as ["ShallowReactive", index].
 */
function listFetchInPayload(html: string): { data: unknown; error: unknown } {
  const raw = /<script[^>]*id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1]
  if (!raw) throw new Error('the page carries no payload')
  const flat = JSON.parse(raw) as unknown[]
  const at = (index: unknown): unknown => {
    if (typeof index !== 'number' || index < 0) return undefined
    let value = flat[index]
    while (Array.isArray(value) && typeof value[0] === 'string' && typeof value[1] === 'number') value = flat[value[1]]
    return value
  }
  const root = at(0) as Record<string, number>
  const entry = (section: string) => (at(root[section]) as Record<string, number> | undefined)?.['admin-link-sales']
  return { data: at(entry('data')) ?? null, error: at(entry('_errors')) ?? null }
}

test('a reload in the customer’s hands shows the hand-back screen, and the list is not even fetched', async ({ page }) => {
  await openInvoices(page)
  // The control. Rendered for the seller, the payload holds the server's fetch:
  // the list, or — in a rig with no Stripe key, like CI's — its failure. So a
  // payload that holds neither is a fetch that never ran, not one that came
  // back with nobody in it. The session goes as a header: its cookies are
  // Secure, which Chromium sends to a loopback address and Playwright's own
  // requests do not.
  const session = cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
  const forSeller = listFetchInPayload(await (await page.request.get('/admin/factures', { headers: { cookie: session } })).text())
  expect(forSeller.data ?? forSeller.error, 'the payload does not show a server-side fetch at all').not.toBeNull()

  await openSigning(page, 0)
  const before = listRequests

  const reloaded = await page.reload()
  await waitForHydration(page)
  const html = (await reloaded?.text()) ?? ''
  await expect(page.getByRole('dialog')).toContainText(HAND_BACK_DE)
  await expect(page.locator('main li')).toHaveCount(0)
  expect(listFetchInPayload(html), 'the server fetched the buyer list for the customer’s reload').toEqual({ data: null, error: null })
  for (const index of BUYERS.keys()) expect(html).not.toContain(`buyer${index}@example.com`)
  // Nor does the browser ask once the page has hydrated.
  expect(listRequests, 'the reloaded page asked for the buyer list').toBe(before)

  // Only the seller's hold brings it back.
  await holdToResume(page)
  await expect(card(page, 0)).toBeVisible()
  expect(new URL(page.url()).search).toBe('')
})

test('back during a second signing keeps the customer screen, and the next link still works', async ({ page }) => {
  await openInvoices(page)
  await signAndHandBack(page, 0)
  await holdToResume(page)

  await openSigning(page, 1)
  await page.goBack()
  await expect(page.getByRole('dialog')).toContainText(HAND_BACK_DE)
  await expect(page.locator('main li')).toHaveCount(0)
  await holdToResume(page)

  await page.locator('header a[href="/admin/commandes"]').click()
  await expect(page).toHaveURL(/\/admin\/commandes$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
})

test('a signing session leaves no dead Back press behind', async ({ page }) => {
  await openInvoices(page)
  await signAndHandBack(page, 0)
  await holdToResume(page)
  await signAndHandBack(page, 1)
  await holdToResume(page)

  await page.goBack()
  await expect(page).toHaveURL(/\/admin$/)
})

test('a jump through the history menu within the same page load keeps the customer’s screen', async ({ page }) => {
  await openInvoices(page)
  await openSigning(page, 0)
  // Two entries back is the dashboard this page load began on: the invoices
  // page was reached from it by a link, so the jump stays inside one document.
  await page.evaluate(() => history.go(-2))
  await expect(page.getByRole('dialog')).toContainText(HAND_BACK_DE)
  await holdToResume(page)

  expect(new URL(page.url()).pathname).toBe('/admin/factures')
  await page.reload()
  await waitForHydration(page)
  await expect(page.getByRole('heading', { level: 1, name: FR.invoices })).toBeVisible()
})

test('the history entry is created only once the customer screen has replaced the list', async ({ page }) => {
  await page.addInitScript(() => {
    const original = history.pushState.bind(history)
    const pushes: Array<{ listed: number; customerScreen: boolean }> = []
    ;(window as unknown as { __pushes: typeof pushes }).__pushes = pushes
    history.pushState = (state, unused, url) => {
      pushes.push({ listed: document.querySelectorAll('main li').length, customerScreen: !!document.querySelector('[role=dialog]') })
      return original(state, unused, url)
    }
  })
  await openInvoices(page)
  const before = await page.evaluate(() => (window as unknown as { __pushes: unknown[] }).__pushes.length)
  await openSigning(page, 0)
  await expect.poll(() => page.evaluate(() => (window as unknown as { __pushes: unknown[] }).__pushes.length)).toBeGreaterThan(before)
  const pushes = await page.evaluate((from) => (window as unknown as { __pushes: Array<{ listed: number; customerScreen: boolean }> }).__pushes.slice(from), before)
  // iOS keeps a picture of the page being left at the moment of the push, and
  // slides that picture in under a back swipe: it must be the customer's screen.
  for (const push of pushes) expect(push).toEqual({ listed: 0, customerScreen: true })
})

test('resuming returns the seller to the sale they were on', async ({ page }) => {
  await openInvoices(page)
  await card(page, 4).getByLabel(FR.frame_number!).fill('FRAME-4')
  const sign = card(page, 4).getByRole('button', { name: FR.take_signature })
  await sign.scrollIntoViewIfNeeded()
  const before = await page.evaluate(() => window.scrollY)
  expect(before).toBeGreaterThan(200)
  await sign.click()
  await draw(page)
  await page.getByRole('dialog').locator('button.btn-primary').click()
  await holdToResume(page)
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before - 5)
  expect(await page.evaluate(() => window.scrollY)).toBeLessThan(before + 5)
})

test('holding Enter resumes once: the key’s repeats cannot resume the next customer’s screen', async ({ page }) => {
  await slowStepBack(page)
  await openInvoices(page)
  await signAndHandBack(page, 0)
  await page.getByRole('button', { name: FR.hand_back_hold }).focus()
  // A held key repeats its keydown about thirty times a second for as long as
  // it is held: here through the step back, and a moment beyond.
  await page.keyboard.down('Enter')
  const dialog = page.getByRole('dialog')
  const deadline = Date.now() + 4000
  let back = 0
  while (Date.now() < deadline && (!back || Date.now() < back + 300)) {
    await page.waitForTimeout(33)
    if (!back && (await dialog.count()) === 0) back = Date.now()
    await page.keyboard.down('Enter')
  }
  // Still held when the list came back: releasing the key is not what resumed.
  expect(back, 'still on the hand-back screen with Enter held').toBeGreaterThan(0)
  await page.keyboard.up('Enter')

  await customerKeepsTheNextScreen(page)
})

test('a second press while the list comes back starts no hold of its own', async ({ page }) => {
  await slowStepBack(page)
  await openInvoices(page)
  await signAndHandBack(page, 0)
  const box = (await page.getByRole('button', { name: FR.hand_back_hold }).boundingBox())!
  await page.mouse.move(box.x + 10, box.y + 10)
  await page.mouse.down()
  // The hold has fired — the device is the seller's again — while the screen
  // is still up. The seller, unsure it worked, lets go and presses again.
  await expect.poll(() => handedOver(page), { intervals: [20] }).toBe(false)
  await page.mouse.up()
  await page.mouse.down()
  expect(await page.getByRole('dialog').count(), 'the second press came after the screen had gone').toBe(1)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.mouse.up()

  // Left on the list, nothing resumes a second time. A second resume would
  // pull the seller back to the sale they had scrolled away from.
  await page.waitForTimeout(300)
  await card(page, 5).scrollIntoViewIfNeeded()
  const scrolled = await page.evaluate(() => window.scrollY)
  expect(scrolled).toBeGreaterThan(200)
  await page.waitForTimeout(1600)
  expect(await page.evaluate(() => window.scrollY), 'the press started a hold that resumed again').toBe(scrolled)

  await customerKeepsTheNextScreen(page)
})

test('an Arabic panel still lays the customer’s screen out left to right', async ({ page }) => {
  await openInvoices(page, '/ar')
  await card(page, 0).getByLabel(AR.frame_number!).fill('FRAME-AR')
  await card(page, 0).getByRole('button', { name: AR.take_signature }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toHaveCSS('direction', 'ltr')
  await expect(dialog.getByText(/^Le client confirme/)).toHaveCSS('direction', 'ltr')
  await draw(page)
  await dialog.locator('button.btn-primary').click()
  await expect(dialog).toContainText(HAND_BACK_DE)
  // The seller's own control stays in the seller's language and direction.
  await expect(page.getByRole('button', { name: AR.hand_back_hold })).toHaveCSS('direction', 'rtl')
})

test('a signature taken late in the evening still stands the next morning', async ({ page }) => {
  // 23:58 in Paris, a sale paid the day before.
  await page.clock.install({ time: new Date('2026-03-10T22:58:00Z') })
  items = [sale(0, { paidAt: '2026-03-09T10:00:00Z' })]
  await openInvoices(page)
  await signAndHandBack(page, 0)
  await holdToResume(page)
  await expect(card(page, 0).getByText(FR.signature_taken!)).toBeVisible()

  // The tablet sleeps past midnight and wakes.
  await page.clock.setSystemTime(new Date('2026-03-10T23:10:00Z'))
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))
  await expect(card(page, 0).getByLabel(FR.delivered_on!)).toHaveValue('2026-03-10')
  await expect(card(page, 0).getByText(FR.signature_taken!)).toBeVisible()
})

test('the customer cannot be asked to sign for details the server would refuse', async ({ page }) => {
  await openInvoices(page)
  const form = card(page, 0)
  const sign = form.getByRole('button', { name: FR.take_signature })
  await form.getByLabel(FR.frame_number!).fill('FRAME-0')
  await expect(sign).toBeEnabled()

  await form.getByLabel(FR.billing_country!).fill('B')
  await expect(sign).toBeDisabled()
  await form.getByLabel(FR.billing_country!).fill('BE')
  await expect(sign).toBeEnabled()

  // A handover before the payment, or a mistyped year.
  await form.getByLabel(FR.delivered_on!).fill('2020-01-01')
  await expect(sign).toBeDisabled()
  await form.getByLabel(FR.delivered_on!).fill('2099-01-01')
  await expect(sign).toBeDisabled()
})

test('an invoice numbered by an interrupted attempt is finished without a form or a signature', async ({ page }) => {
  const pending = {
    id: 'in_test_pending',
    number: 'TEST-0042',
    frameNumber: 'FRAME-EARLIER',
    deliveredOn: new Date(Date.now() - DAY).toISOString().slice(0, 10),
    customerName: 'MAX MUSTERMANN',
    total: 125000,
    deliveryFeeIncluded: false,
  }
  items = [sale(0, { pendingAttempt: true, pendingInvoice: pending })]
  const sent: unknown[] = []
  await page.route('**/api/admin/link-sales/finish', async (route) => {
    sent.push(route.request().postDataJSON())
    const invoice = { id: pending.id, number: pending.number, hostedUrl: null, message: { subject: 's', body: 'b' } }
    items = [sale(0, { invoice })]
    await route.fulfill({
      json: { invoice: { ...invoice, resumed: true, frameNumber: pending.frameNumber, deliveredOn: pending.deliveredOn, customerName: pending.customerName, total: pending.total, differences: [], differs: false } },
    })
  })
  await openInvoices(page)

  const row = card(page, 0)
  await expect(row).toContainText(pending.number)
  await expect(row).toContainText(pending.frameNumber)
  await expect(row.getByRole('button', { name: FR.take_signature })).toHaveCount(0)
  await row.getByRole('button', { name: new RegExp(pending.number) }).click()
  // Exact: the button itself reads "Terminer la facture <number>".
  await expect(row.getByText(FR.invoiced!.replace('{number}', pending.number), { exact: true })).toBeVisible()
  await expect(row.getByRole('link', { name: FR.download_pdf })).toBeVisible()
  expect(sent).toEqual([{ sessionId: 'cs_test_handover0' }])
})

test('an interrupted invoice says what finishing makes final, delivery fee included or not', async ({ page }) => {
  const pending = (index: number, total: number, deliveryFeeIncluded: boolean) => ({
    id: `in_test_pending${index}`,
    number: `TEST-004${index}`,
    frameNumber: `FRAME-${index}`,
    deliveredOn: new Date(Date.now() - DAY).toISOString().slice(0, 10),
    customerName: BUYERS[index]![0],
    total,
    deliveryFeeIncluded,
  })
  const delivery = { fulfilment: 'delivery' as const, deliveryFee: 3500, deliveryAddress: 'Musterstrasse 1, 1010 Wien', pendingAttempt: true }
  // The fee ticked by mistake: numbered with it, though the customer paid none at the door.
  const withFee = pending(0, 128500, true)
  const withoutFee = pending(1, 125000, false)
  items = [sale(0, { ...delivery, pendingInvoice: withFee }), sale(1, { ...delivery, pendingInvoice: withoutFee })]
  const sent: unknown[] = []
  await page.route('**/api/admin/link-sales/finish', (route) => {
    sent.push(route.request().postDataJSON())
    return route.fulfill({ status: 409, json: { code: 'INVALID_STATE_TRANSITION', messageKey: 'admin.nothing_to_finish' } })
  })

  // Reached as openInvoices does, without its handler that accepts every dialog.
  await page.goto('/admin')
  await page.locator('header a[href="/admin/factures"]').click()
  await expect(page.locator('main li').first()).toBeVisible()

  const euros = (cents: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(cents / 100)
  const states = (key: string, invoice: ReturnType<typeof pending>) =>
    FR[key]!.replace('{number}', invoice.number).replace('{name}', invoice.customerName).replace('{total}', euros(invoice.total))
  await expect(card(page, 0)).toContainText(states('pending_states_fee', withFee))
  await expect(card(page, 1)).toContainText(states('pending_states_no_fee', withoutFee))
  // And how a mistake is corrected once it is final.
  await expect(card(page, 0)).toContainText(FR.pending_correction!)

  // The seller is asked once more, with the same values, and can still stop.
  const asked: string[] = []
  page.once('dialog', async (dialog) => {
    asked.push(dialog.message())
    await dialog.dismiss()
  })
  await card(page, 0).getByRole('button', { name: new RegExp(withFee.number) }).click()
  await expect.poll(() => asked.length).toBe(1)
  const flat = (text: string) => text.replace(/\s+/g, ' ')
  expect(flat(asked[0]!)).toBe(flat(`${states('pending_states_fee', withFee)} ${FR.confirm_finish!.replace('{number}', withFee.number)}`))
  await page.waitForTimeout(300)
  expect(sent, 'finished although the seller said no').toEqual([])
  await expect(card(page, 0).getByRole('button', { name: new RegExp(withFee.number) })).toBeEnabled()
})

test('an issue that finished an earlier invoice names what it states differently', async ({ page }) => {
  // An earlier attempt numbered the invoice with another address and country;
  // every value the warning restates — frame, date, name, total — matches the form.
  await page.route('**/api/admin/link-sales/invoice', (route) =>
    route.fulfill({
      json: {
        invoice: {
          id: 'in_test_resumed',
          number: 'TEST-0050',
          hostedUrl: null,
          message: { subject: 's', body: 'b' },
          resumed: true,
          frameNumber: 'FRAME-0',
          deliveredOn: new Date(Date.now() - DAY).toISOString().slice(0, 10),
          customerName: BUYERS[0][0],
          total: 125000,
          differences: ['address', 'country'],
          differs: true,
        },
      },
    })
  )
  await openInvoices(page)
  await signAndHandBack(page, 0)
  await holdToResume(page)
  await card(page, 0).getByRole('button', { name: FR.issue_invoice }).click()

  const fields = new Intl.ListFormat('fr-FR', { type: 'conjunction' }).format([FR.field_address!, FR.field_country!])
  await expect(card(page, 0).getByRole('status')).toContainText(FR.differs_in!.replace('{fields}', fields))
  await expect(card(page, 0).getByRole('status')).toHaveClass(/text-danger/)
})

test('money that went back after the number asks only for what is still to do', async ({ page }) => {
  const invoice = (number: string) => ({ id: `in_test_${number}`, number, hostedUrl: null, message: { subject: 's', body: 'b' } })
  items = [
    sale(0, { invoice: invoice('TEST-0001'), reversal: 'credit_note_due' }),
    sale(1, { invoice: invoice('TEST-0002'), reversal: 'settled' }),
    sale(2, { invoice: invoice('TEST-0003'), reversal: 'dispute_open' }),
    sale(3, { invoice: invoice('TEST-0004'), reversal: 'dispute_in_review' }),
    sale(4, { invoice: invoice('TEST-0005') }),
  ]
  await openInvoices(page)
  const line = (index: number, key: string) => card(page, index).getByText(FR[key]!, { exact: true })

  // Still to do: a warning.
  await expect(line(0, 'reversal_credit_note_due')).toHaveClass(/text-danger/)
  await expect(line(2, 'reversal_dispute_open')).toHaveClass(/text-danger/)
  // Waiting on the bank, or done: plain text, and no second credit note asked for.
  await expect(line(3, 'reversal_dispute_in_review')).toHaveClass(/text-content-muted/)
  await expect(line(1, 'reversal_settled')).toHaveClass(/text-content-muted/)
  await expect(card(page, 1)).not.toContainText(FR.reversal_credit_note_due!)
  // Nothing went back: nothing said.
  await expect(card(page, 4).getByRole('status')).toHaveCount(0)
})
