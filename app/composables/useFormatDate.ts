import { getLocale, isLocaleCode, DEFAULT_LOCALE } from '~~/shared/locales'

/**
 * Dates, rendered identically on the server and in the browser.
 *
 * Two things must be stated or a date differs between the two, and both were
 * being left to chance:
 *
 *  - **The locale.** `toLocaleDateString()` with no argument means "whatever
 *    the runtime defaults to". Node answers en-GB; a French browser answers
 *    fr-FR. The account page rendered an English date inside a French page and
 *    then swapped it after hydration.
 *  - **The time zone.** A serverless function runs in UTC and the shop is in
 *    Poitiers. Without a zone, an order placed at 00:30 Paris time renders as
 *    22:30 the previous day on the server — the wrong DAY, on the screen used
 *    to plan the van's route. Every night between midnight and 02:00 in summer,
 *    every date on the site was a day behind until the browser corrected it.
 *
 * The format locale comes from the locales manifest rather than a second table
 * here, so a new language cannot arrive with its dates unformatted.
 *
 * Everything is shown in the shop's own time. A customer in Amsterdam seeing
 * Poitiers time on their order is correct: it is when the shop recorded it, and
 * it is what the invoice says.
 */

/** Poitiers. The shop's clock, and the one on the paperwork. */
export const SHOP_TIME_ZONE = 'Europe/Paris'

export function useFormatDate() {
  const { locale } = useI18n()

  const formatLocale = computed(() =>
    getLocale(isLocaleCode(locale.value) ? locale.value : DEFAULT_LOCALE).formatLocale
  )

  function format(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions
  ): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    // A malformed timestamp would otherwise print "Invalid Date" to a customer.
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(formatLocale.value, {
      timeZone: SHOP_TIME_ZONE,
      ...options,
    }).format(date)
  }

  /** "30 juillet 2026" — for a customer reading their own order. */
  const formatLongDate = (value: string | Date | null | undefined) =>
    format(value, { dateStyle: 'long' })

  /** "30/07/2026" — compact, for lists. */
  const formatShortDate = (value: string | Date | null | undefined) =>
    format(value, { dateStyle: 'short' })

  /** "30 juil. 2026, 00:43" — when the hour matters, as it does for dispatch. */
  const formatDateTime = (value: string | Date | null | undefined) =>
    format(value, { dateStyle: 'medium', timeStyle: 'short' })

  return { format, formatLongDate, formatShortDate, formatDateTime, SHOP_TIME_ZONE }
}
