/**
 * Price formatting, pinned to the customer's locale.
 *
 * Before this existed, thirteen templates rendered prices with a raw
 * `(cents / 100).toFixed(2) + ' €'` and ten more interpolated the server's
 * decimal strings directly — so every price on the storefront read "950.00 €",
 * an anglophone format, to customers in a shop whose default language is
 * French ("950,00 €"), and equally wrong for nl/de/es/ar. `toFixed` slipped
 * past the invariant gate precisely because it never touches Intl.
 *
 * The one place a dot-decimal is CORRECT is machine output — schema.org
 * offers.price, feeds — which must keep `toDecimalString`/`toFixed` and say so
 * with an `invariant-ok` comment.
 */
import { DEFAULT_LOCALE, getLocale, isLocaleCode } from '~~/shared/locales'

export function useFormatPrice() {
  const { locale } = useI18n()

  const formatLocale = computed(() =>
    getLocale(isLocaleCode(locale.value) ? locale.value : DEFAULT_LOCALE).formatLocale
  )

  /**
   * The reason the invariant gate bans Intl currency everywhere else: Node and
   * Chrome can disagree on the space inside "950,00 €" — U+202F narrow
   * no-break vs U+00A0 no-break, depending on each side's ICU — which turns
   * every server-rendered price into a silent hydration mismatch. Normalising
   * to U+00A0 makes both sides byte-identical whatever their ICU says, and is
   * what makes this composable safe to run during SSR.
   */
  const normalise = (formatted: string) => formatted.replace(/ /g, ' ')

  /** 95000 (cents) → "950,00 €" in fr, "€950.00" in en, "٩٥٠٫٠٠ €" in ar. */
  function formatCents(cents: number | null | undefined): string {
    if (cents === null || cents === undefined || !Number.isFinite(cents)) return ''
    return normalise(
      new Intl.NumberFormat(formatLocale.value, { style: 'currency', currency: 'EUR' }).format(
        cents / 100
      )
    )
  }

  /**
   * "1498.00" — the wire format the pricing API answers with — rendered for
   * the customer. The wire string stays dot-decimal by contract; only its
   * presentation is localized. A plain number in euros is accepted too, because
   * some admin endpoints answer with one.
   *
   * The empty check is explicit rather than falsy: `0` is a real amount, and
   * "free shipping" must render as "0,00 €" and not as a blank cell.
   */
  function formatDecimal(decimal: string | number | null | undefined): string {
    if (decimal === null || decimal === undefined || decimal === '') return ''
    const value = Number(decimal)
    if (!Number.isFinite(value)) return ''
    return normalise(
      new Intl.NumberFormat(formatLocale.value, { style: 'currency', currency: 'EUR' }).format(value)
    )
  }

  /**
   * A rate the server sends as a plain number — a conversion rate, a VAT rate.
   *
   * It lives here rather than in a template because the invariant gate bans
   * `Intl` everywhere but this file, and for the same reason: `20.5 %` is an
   * anglophone rendering, and a French, German or Arabic reader is owed their
   * own decimal mark and their own place for the sign.
   */
  function formatPercent(value: number | string | null | undefined): string {
    const numeric = typeof value === 'string' ? Number(value) : value
    if (numeric === null || numeric === undefined || !Number.isFinite(numeric)) return ''
    return normalise(
      new Intl.NumberFormat(formatLocale.value, {
        style: 'percent',
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(numeric / 100)
    )
  }

  return { formatCents, formatDecimal, formatPercent }
}
