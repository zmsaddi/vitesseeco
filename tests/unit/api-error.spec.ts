import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { apiError, apiErrorMessage, issueText } from '../../app/utils/apiError'

/**
 * vue-i18n's `t` over the real locale files, reduced to what these sentences
 * use: a lookup and {named} slots. A missing key comes back as the key, which
 * is exactly what vue-i18n does — and what a customer then reads.
 */
function translator(locale: 'fr' | 'de' | 'ar') {
  const messages = JSON.parse(readFileSync(join(process.cwd(), 'i18n', 'locales', `${locale}.json`), 'utf8'))
  return (key: string, named: Record<string, unknown> = {}): string => {
    const value = key
      .split('.')
      .reduce<unknown>((node, part) => (node as Record<string, unknown> | undefined)?.[part], messages)
    if (typeof value !== 'string') return key
    return value.replace(/\{(\w+)\}/g, (whole, name: string) => (name in named ? String(named[name]) : whole))
  }
}

/** The body h3 actually sends for an AppError — the shape $fetch hands back as err.data. */
const h3Body = (payload: object) => ({
  error: true,
  url: '/api/auth/login',
  statusCode: 401,
  statusMessage: 'INVALID_CREDENTIALS',
  message: 'INVALID_CREDENTIALS',
  data: payload,
})

describe('reading an API error', () => {
  it('finds the payload h3 nests under the body', () => {
    const err = { data: h3Body({ code: 'INVALID_CREDENTIALS', messageKey: 'errors.invalid_credentials' }) }
    expect(apiError(err)).toEqual({ code: 'INVALID_CREDENTIALS', messageKey: 'errors.invalid_credentials' })
  })

  it('carries field issues and details through', () => {
    const issues = [{ path: 'email', message: 'errors.invalid_email' }]
    const err = { data: h3Body({ code: 'VALIDATION_FAILED', messageKey: 'errors.validation_failed', details: { issues } }) }
    expect(apiError(err).details?.issues).toEqual(issues)
  })

  it('still reads a flat payload, should a route ever send one', () => {
    expect(apiError({ data: { code: 'X', messageKey: 'errors.x' } }).messageKey).toBe('errors.x')
  })

  it('is empty for anything that never reached a route', () => {
    expect(apiError(new TypeError('Failed to fetch'))).toEqual({})
    expect(apiError({ data: '<html>502 Bad Gateway</html>' })).toEqual({})
    expect(apiError({ data: { statusCode: 500 } })).toEqual({})
    expect(apiError(null)).toEqual({})
  })
})

describe('the sentence a page shows for a failure', () => {
  const t = translator('fr')
  const failure = (payload: object) => ({ data: h3Body(payload) })

  it('names the field rather than "some details are incorrect"', () => {
    // Checkout sends the phone twice — on the order and on the address — and
    // the customer should read it once.
    const err = failure({
      code: 'VALIDATION_FAILED',
      messageKey: 'errors.validation_failed',
      details: {
        issues: [
          { path: 'phone', message: 'errors.invalid_phone' },
          { path: 'shippingAddress.phone', message: 'errors.invalid_phone' },
        ],
      },
    })
    expect(apiErrorMessage(err, t, 'fr')).toBe("Ce numéro de téléphone n'est pas valide.")
  })

  it('tells the stock page that the struck-through price is the obstacle', () => {
    const err = failure({
      code: 'VALIDATION_FAILED',
      messageKey: 'errors.validation_failed',
      details: { issues: [{ path: 'compareAtPrice', message: 'errors.compare_price_not_higher' }] },
    })
    expect(apiErrorMessage(err, t, 'fr')).toBe('Le prix barré doit être supérieur au prix actuel.')
  })

  it('says each different problem once', () => {
    const err = failure({
      code: 'VALIDATION_FAILED',
      messageKey: 'errors.validation_failed',
      details: {
        issues: [
          { path: 'email', message: 'errors.invalid_email' },
          { path: 'phone', message: 'errors.invalid_phone' },
          { path: 'shippingAddress.phone', message: 'errors.invalid_phone' },
        ],
      },
    })
    expect(apiErrorMessage(err, t, 'fr')).toBe(
      "Cette adresse email n'est pas valide. · Ce numéro de téléphone n'est pas valide."
    )
  })

  it('never prints the prose an issue carried', () => {
    const err = failure({
      code: 'VALIDATION_FAILED',
      messageKey: 'errors.validation_failed',
      details: { issues: [{ path: 'email', message: 'Invalid email address' }] },
    })
    expect(apiErrorMessage(err, t, 'fr')).toBe("Cette valeur n'est pas valide.")
    expect(issueText('Invalid email address', t)).toBe("Cette valeur n'est pas valide.")
  })

  it('says how long a rate limit lasts, in the language of the page', () => {
    // 841 seconds is what is left of a fifteen-minute login window: the block
    // the customer was told would last "un instant".
    const err = failure({ code: 'RATE_LIMITED', messageKey: 'errors.rate_limited', details: { retryAfterSeconds: 841 } })
    expect(apiErrorMessage(err, t, 'fr')).toBe('Trop de tentatives. Réessayez dans 15 minutes.')
    expect(apiErrorMessage(err, translator('de'), 'de')).toBe(
      'Zu viele Versuche. Bitte versuchen Sie es in 15 Minuten erneut.'
    )
    expect(apiErrorMessage(err, translator('ar'), 'ar')).toContain('دقيقة')

    const lastSeconds = failure({ code: 'RATE_LIMITED', messageKey: 'errors.rate_limited', details: { retryAfterSeconds: 20 } })
    expect(apiErrorMessage(lastSeconds, t, 'fr')).toBe('Trop de tentatives. Réessayez dans 1 minute.')
  })

  it('promises no time when it does not know one', () => {
    const err = failure({ code: 'RATE_LIMITED', messageKey: 'errors.rate_limited' })
    expect(apiErrorMessage(err, t, 'fr')).toBe('Trop de tentatives. Veuillez patienter avant de réessayer.')
  })

  it("falls back to the code's own sentence, then to the generic one", () => {
    expect(apiErrorMessage(failure({ code: 'OUT_OF_STOCK', messageKey: 'errors.out_of_stock' }), t, 'fr')).toBe(
      'Stock insuffisant.'
    )
    expect(apiErrorMessage(new TypeError('Failed to fetch'), t, 'fr')).toBe('Une erreur est survenue de notre côté.')
  })
})
