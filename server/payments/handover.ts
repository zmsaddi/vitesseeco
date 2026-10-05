/**
 * The signed handover receipt for a Payment Link sale.
 *
 * A Stripe invoice cannot carry an image, so the customer's signature lives in
 * a separate one-page PDF — a bon de livraison / Übergabeprotokoll — that the
 * invoice refers to. Both the signature and the PDF are uploaded as
 * `dispute_evidence` files: private to the account, never publicly linkable,
 * and already the kind of file a Klarna "not received" dispute asks for.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { stripe } from './stripe'
import { ORGANISATION } from '../../shared/organisation'
import { AppError, ERROR_CODES } from '../../shared/errors'

/** A finger signature is tens of kilobytes; anything larger is not one. */
export const MAX_SIGNATURE_BYTES = 300_000
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

/** data:image/png;base64,… → PNG bytes, or a validation error. */
export function decodeSignature(dataUrl: string): Buffer {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl)
  const bytes = match ? Buffer.from(match[1]!, 'base64') : null
  if (!bytes || bytes.length < 100 || bytes.length > MAX_SIGNATURE_BYTES || !bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new AppError(ERROR_CODES.VALIDATION_FAILED, { internal: 'signature is not a PNG of plausible size' })
  }
  return bytes
}

/**
 * The standard PDF fonts speak WinAnsi only. A name typed in another script
 * would throw inside pdf-lib and lose the whole receipt, so characters it
 * cannot draw are replaced rather than allowed to fail the handover.
 */
export function drawable(text: string): string {
  const extras = new Set('€–—‘’“”•…·'.split(''))
  return [...text.normalize('NFC')].map((char) => (char.charCodeAt(0) <= 0xff || extras.has(char) ? char : '?')).join('')
}

export type ReceiptLanguage = 'fr' | 'de' | 'nl' | 'es' | 'en'

interface ReceiptText {
  title: string
  seller: string
  customer: string
  item: string
  frame: string
  date: string
  pickup: string
  delivery: string
  statement: string
  signature: string
}

/**
 * French always — it is a French company's document — and the customer's own
 * language beside it, so the person signing can read what they are signing.
 */
const RECEIPT: Record<ReceiptLanguage, ReceiptText> = {
  fr: {
    title: 'Bon de livraison', seller: 'Vendeur', customer: 'Client', item: 'Article', frame: 'N° de cadre',
    date: 'Date de remise', pickup: 'retrait', delivery: 'livraison à domicile',
    statement: 'Le client confirme avoir reçu l’article ci-dessus, complet et en bon état.',
    signature: 'Signature du client',
  },
  de: {
    title: 'Übergabeprotokoll', seller: 'Verkäufer', customer: 'Kunde', item: 'Artikel', frame: 'Rahmennummer',
    date: 'Übergabedatum', pickup: 'Abholung', delivery: 'Lieferung',
    statement: 'Der Kunde bestätigt, den oben genannten Artikel vollständig und in einwandfreiem Zustand erhalten zu haben.',
    signature: 'Unterschrift des Kunden',
  },
  nl: {
    title: 'Afleveringsbon', seller: 'Verkoper', customer: 'Klant', item: 'Artikel', frame: 'Framenummer',
    date: 'Datum van overdracht', pickup: 'afhaling', delivery: 'thuislevering',
    statement: 'De klant bevestigt het bovenstaande artikel volledig en in goede staat te hebben ontvangen.',
    signature: 'Handtekening van de klant',
  },
  es: {
    title: 'Albarán de entrega', seller: 'Vendedor', customer: 'Cliente', item: 'Artículo', frame: 'N.º de cuadro',
    date: 'Fecha de entrega', pickup: 'recogida', delivery: 'entrega a domicilio',
    statement: 'El cliente confirma haber recibido el artículo anterior, completo y en buen estado.',
    signature: 'Firma del cliente',
  },
  en: {
    title: 'Delivery receipt', seller: 'Seller', customer: 'Customer', item: 'Item', frame: 'Frame number',
    date: 'Handover date', pickup: 'collection', delivery: 'home delivery',
    statement: 'The customer confirms having received the item above, complete and in good condition.',
    signature: 'Customer signature',
  },
}

export interface HandoverDetails {
  reference: string
  productName: string
  frameNumber: string
  /** DD/MM/YYYY */
  deliveredOn: string
  handover: 'pickup' | 'delivery'
  /** The customer's language, shown beside the French. */
  language: ReceiptLanguage
  customer: { name: string; address: string; email: string | null; phone: string | null }
}

export async function buildHandoverPdf(details: HandoverDetails, signaturePng: Buffer): Promise<Uint8Array> {
  const fr = RECEIPT.fr
  const other = details.language === 'fr' ? null : RECEIPT[details.language]
  /** "Bon de livraison / Übergabeprotokoll", or the French alone. */
  const both = (pick: (text: ReceiptText) => string) => (other ? `${pick(fr)} / ${pick(other)}` : pick(fr))

  const pdf = await PDFDocument.create()
  pdf.setTitle(`${fr.title} ${details.reference}`)
  pdf.setAuthor(ORGANISATION.legalName)
  const page = pdf.addPage([595.28, 841.89])
  const regular = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ink = rgb(0.1, 0.1, 0.12)
  const muted = rgb(0.4, 0.4, 0.45)

  let y = 790
  const line = (text: string, options: { size?: number; font?: typeof regular; color?: typeof ink; gap?: number } = {}) => {
    page.drawText(drawable(text), { x: 56, y, size: options.size ?? 10.5, font: options.font ?? regular, color: options.color ?? ink })
    y -= options.gap ?? 16
  }
  /** Long sentences wrapped to the text column, by measured width. */
  const paragraph = (text: string, gapAfter: number) => {
    const words = drawable(text).split(' ')
    let current = ''
    for (const word of words) {
      const next = current ? `${current} ${word}` : word
      if (regular.widthOfTextAtSize(next, 10.5) > 480 && current) {
        line(current, { gap: 14 })
        current = word
      } else current = next
    }
    if (current) line(current, { gap: gapAfter })
  }

  line(both((t) => t.title), { size: 18, font: bold, gap: 22 })
  line(`Réf. ${details.reference}`, { color: muted, gap: 30 })

  line(both((t) => t.seller), { font: bold })
  line(ORGANISATION.legalName)
  line(`${ORGANISATION.address.street}, ${ORGANISATION.address.postalCode} ${ORGANISATION.address.city}, France`)
  line(`SIREN ${ORGANISATION.siren} · TVA ${ORGANISATION.vatNumber}`)
  line(`${ORGANISATION.email} · ${ORGANISATION.phone}`, { gap: 26 })

  line(both((t) => t.customer), { font: bold })
  line(details.customer.name)
  line(details.customer.address)
  line([details.customer.email, details.customer.phone].filter(Boolean).join(' · ') || '—', { gap: 26 })

  line(both((t) => t.item), { font: bold })
  line(details.productName)
  line(`${both((t) => t.frame)} : ${details.frameNumber}`, { font: bold })
  line(`${both((t) => t.date)} : ${details.deliveredOn} – ${both((t) => (details.handover === 'delivery' ? t.delivery : t.pickup))}`, { gap: 30 })

  paragraph(fr.statement, other ? 18 : 30)
  if (other) paragraph(other.statement, 30)

  line(both((t) => t.signature), { font: bold, gap: 10 })
  const image = await pdf.embedPng(signaturePng)
  const scale = Math.min(300 / image.width, 120 / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale
  page.drawRectangle({ x: 56, y: y - 130, width: 320, height: 130, borderColor: muted, borderWidth: 0.6 })
  page.drawImage(image, { x: 66, y: y - 125 + (120 - height) / 2, width, height })

  return pdf.save()
}

export async function uploadEvidence(
  bytes: Uint8Array | Buffer,
  name: string,
  type: 'application/pdf' | 'image/png',
  idempotencyKey?: string
): Promise<string> {
  const file = await stripe().files.create(
    { purpose: 'dispute_evidence', file: { data: Buffer.from(bytes), name, type } },
    idempotencyKey ? { idempotencyKey } : undefined
  )
  return file.id
}

/**
 * Read an evidence file back for the admin. Only files this module wrote are
 * served: the name prefix is checked, so the route cannot be turned into a
 * reader for every document in the account.
 */
export async function readHandover(fileId: string): Promise<{ bytes: Buffer; name: string }> {
  const file = await stripe().files.retrieve(fileId)
  if (file.purpose !== 'dispute_evidence' || !file.filename?.startsWith('handover-') || !file.url) {
    throw new AppError(ERROR_CODES.NOT_FOUND, { internal: `${fileId} is not a handover receipt` })
  }
  const response = await fetch(file.url, {
    headers: { Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}` },
  })
  if (!response.ok) {
    throw new AppError(ERROR_CODES.SERVICE_UNAVAILABLE, { internal: `file contents ${response.status}` })
  }
  return { bytes: Buffer.from(await response.arrayBuffer()), name: file.filename }
}
