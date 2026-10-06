/**
 * Which language a link-sale customer is addressed in, and what they confirm
 * when they sign for an item.
 *
 * Shared because two sides must agree on it: the signing screen the customer
 * reads on the tablet, and the receipt PDF the server builds from the same
 * country. Decided in two places, the customer could read one sentence and
 * sign a document carrying another.
 */
export type ReceiptLanguage = 'fr' | 'de' | 'nl' | 'es' | 'en'

const RECEIPT_LANGUAGES: readonly string[] = ['fr', 'de', 'nl', 'es', 'en'] satisfies ReceiptLanguage[]

/** For a value read back from somewhere the page does not control, such as a cookie. */
export function isReceiptLanguage(value: unknown): value is ReceiptLanguage {
  return typeof value === 'string' && RECEIPT_LANGUAGES.includes(value)
}

const LANGUAGE_BY_COUNTRY: Record<string, ReceiptLanguage> = {
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  NL: 'nl',
  ES: 'es',
}

/** From the billing country typed on the form; English for anywhere else. */
export function languageFor(country: string | null | undefined): ReceiptLanguage {
  return LANGUAGE_BY_COUNTRY[(country ?? '').trim().toUpperCase()] ?? 'en'
}

/** The sentence the customer signs under, in each language. */
export const ACKNOWLEDGEMENT: Record<ReceiptLanguage, string> = {
  fr: 'Le client confirme avoir reçu l’article ci-dessus, complet et en bon état.',
  de: 'Der Kunde bestätigt, den oben genannten Artikel vollständig und in einwandfreiem Zustand erhalten zu haben.',
  nl: 'De klant bevestigt het bovenstaande artikel volledig en in goede staat te hebben ontvangen.',
  es: 'El cliente confirma haber recibido el artículo anterior, completo y en buen estado.',
  en: 'The customer confirms having received the item above, complete and in good condition.',
}

/** French always — a French company's document — then the customer's own language. */
export function acknowledgementLines(language: ReceiptLanguage): string[] {
  return language === 'fr' ? [ACKNOWLEDGEMENT.fr] : [ACKNOWLEDGEMENT.fr, ACKNOWLEDGEMENT[language]]
}

/**
 * The words on the signing screen itself. The customer holds the device, so
 * they read their language, not the admin's.
 */
export const SIGNING_TEXT: Record<
  ReceiptLanguage,
  { signature: string; hint: string; clear: string; confirm: string; cancel: string; handBack: string }
> = {
  fr: {
    signature: 'Votre signature',
    hint: 'Signez avec le doigt dans le cadre.',
    clear: 'Effacer',
    confirm: 'Je confirme et je signe',
    cancel: 'Annuler',
    handBack: 'Merci. Veuillez rendre l’appareil au vendeur.',
  },
  de: {
    signature: 'Ihre Unterschrift',
    hint: 'Bitte mit dem Finger im Rahmen unterschreiben.',
    clear: 'Löschen',
    confirm: 'Ich bestätige und unterschreibe',
    cancel: 'Abbrechen',
    handBack: 'Danke. Bitte geben Sie das Gerät dem Verkäufer zurück.',
  },
  nl: {
    signature: 'Uw handtekening',
    hint: 'Teken met uw vinger in het vak.',
    clear: 'Wissen',
    confirm: 'Ik bevestig en teken',
    cancel: 'Annuleren',
    handBack: 'Dank u. Geef het apparaat terug aan de verkoper.',
  },
  es: {
    signature: 'Su firma',
    hint: 'Firme con el dedo dentro del recuadro.',
    clear: 'Borrar',
    confirm: 'Confirmo y firmo',
    cancel: 'Cancelar',
    handBack: 'Gracias. Devuelva el dispositivo al vendedor.',
  },
  en: {
    signature: 'Your signature',
    hint: 'Sign with your finger inside the box.',
    clear: 'Clear',
    confirm: 'I confirm and sign',
    cancel: 'Cancel',
    handBack: 'Thank you. Please hand the device back to the seller.',
  },
}
