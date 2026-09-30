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

export interface HandoverDetails {
  reference: string
  productName: string
  frameNumber: string
  /** DD/MM/YYYY */
  deliveredOn: string
  handover: 'pickup' | 'delivery'
  customer: { name: string; address: string; email: string | null; phone: string | null }
}

export async function buildHandoverPdf(details: HandoverDetails, signaturePng: Buffer): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  pdf.setTitle(`Bon de livraison ${details.reference}`)
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

  line('Bon de livraison / Übergabeprotokoll', { size: 18, font: bold, gap: 22 })
  line(`Réf. ${details.reference}`, { color: muted, gap: 30 })

  line('Vendeur / Verkäufer', { font: bold })
  line(ORGANISATION.legalName)
  line(`${ORGANISATION.address.street}, ${ORGANISATION.address.postalCode} ${ORGANISATION.address.city}, France`)
  line(`SIREN ${ORGANISATION.siren} · TVA ${ORGANISATION.vatNumber}`)
  line(`${ORGANISATION.email} · ${ORGANISATION.phone}`, { gap: 26 })

  line('Client / Kunde', { font: bold })
  line(details.customer.name)
  line(details.customer.address)
  line([details.customer.email, details.customer.phone].filter(Boolean).join(' · ') || '—', { gap: 26 })

  line('Article / Artikel', { font: bold })
  line(details.productName)
  line(`N° de cadre / Rahmennummer : ${details.frameNumber}`, { font: bold })
  line(
    `Date de remise / Übergabedatum : ${details.deliveredOn} – ` +
      (details.handover === 'delivery' ? 'livraison à domicile / Lieferung' : 'retrait / Abholung'),
    { gap: 30 }
  )

  line('Le client confirme avoir reçu l’article ci-dessus, complet et en bon état.', { gap: 14 })
  line('Der Kunde bestätigt, den oben genannten Artikel vollständig und in einwandfreiem', { gap: 14 })
  line('Zustand erhalten zu haben.', { gap: 30 })

  line('Signature du client / Unterschrift des Kunden', { font: bold, gap: 10 })
  const image = await pdf.embedPng(signaturePng)
  const scale = Math.min(300 / image.width, 120 / image.height, 1)
  const width = image.width * scale
  const height = image.height * scale
  page.drawRectangle({ x: 56, y: y - 130, width: 320, height: 130, borderColor: muted, borderWidth: 0.6 })
  page.drawImage(image, { x: 66, y: y - 125 + (120 - height) / 2, width, height })

  return pdf.save()
}

export async function uploadEvidence(bytes: Uint8Array | Buffer, name: string, type: 'application/pdf' | 'image/png'): Promise<string> {
  const file = await stripe().files.create({
    purpose: 'dispute_evidence',
    file: { data: Buffer.from(bytes), name, type },
  })
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
