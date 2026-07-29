/**
 * Dates, formatted the same way on the server and in the browser.
 *
 * Two things have to be stated explicitly or a date renders differently in each
 * place, and every one of them was getting both wrong:
 *
 *  - **The locale.** `toLocaleDateString(undefined, …)` means "whatever the
 *    runtime defaults to". Node on Vercel answers en-GB; a French customer's
 *    Chrome answers fr-FR. The order page was showing "21 July 2026" from the
 *    server and "21 juillet 2026" after hydration.
 *  - **The time zone.** A Vercel function runs in UTC; the shop is in Poitiers.
 *    Without a zone, an order placed at 00:30 Paris time rendered as "20 juil.
 *    22:30" server-side and "21 juil. 00:30" in the browser — the wrong DAY, on
 *    a screen used to plan the van's route.
 *
 * Everything is shown in the shop's own time, because that is the time the
 * owner, the driver and the invoice all work in. A customer in Amsterdam seeing
 * Poitiers time on their order is correct, not a bug: it is when the shop
 * recorded the order.
 */

/** Full BCP-47 tags. A bare "fr" works, but the region fixes the conventions. */
const LOCALE_TAGS: Record<string, string> = {
  fr: 'fr-FR',
  en: 'en-GB',
  nl: 'nl-NL',
  de: 'de-DE',
  es: 'es-ES',
  ar: 'ar-MA',
}

/** Poitiers. The shop's clock, and the one on the paperwork. */
export const SHOP_TIME_ZONE = 'Europe/Paris'

export function useFormatDate() {
  const { locale } = useI18n()

  const tag = computed(() => LOCALE_TAGS[locale.value] || 'fr-FR')

  function format(
    value: string | Date | null | undefined,
    options: Intl.DateTimeFormatOptions
  ): string {
    if (!value) return ''
    const date = value instanceof Date ? value : new Date(value)
    // An unparseable string would otherwise render "Invalid Date" to a customer.
    if (Number.isNaN(date.getTime())) return ''
    return new Intl.DateTimeFormat(tag.value, { timeZone: SHOP_TIME_ZONE, ...options }).format(date)
  }

  /** "21 juillet 2026" — for a customer reading their own order. */
  const formatLongDate = (value: string | Date | null | undefined) =>
    format(value, { year: 'numeric', month: 'long', day: 'numeric' })

  /** "21/07/2026" — compact, for lists. */
  const formatShortDate = (value: string | Date | null | undefined) =>
    format(value, { day: '2-digit', month: '2-digit', year: 'numeric' })

  /** "21 juil. 2026, 00:30" — when the hour matters, as it does for dispatch. */
  const formatDateTime = (value: string | Date | null | undefined) =>
    format(value, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

  return { format, formatLongDate, formatShortDate, formatDateTime, SHOP_TIME_ZONE }
}
