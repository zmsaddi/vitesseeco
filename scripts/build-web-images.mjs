/**
 * The raster images the web platform insists on, rendered from the brand kit.
 *
 * Two things browsers and scrapers will not take as SVG:
 *
 *  - **The link preview.** The site shipped with no og:image, so a link pasted
 *    into WhatsApp — which the contact page itself calls the way most customers
 *    open a conversation — showed a bare URL. Facebook and WhatsApp remain
 *    inconsistent about SVG and WebP, and a preview that fails to load looks
 *    broken rather than absent, so it is a JPEG.
 *  - **The maskable app icon.** The manifest declared only `purpose: "any"`,
 *    and that icon is a rounded square with the stag edge to edge; a launcher
 *    that crops to a circle takes the antlers off.
 *
 * Both are COMPOSED in scripts/build-brand-kit.mjs, because the brand kit's own
 * README is emphatic that its assets are generated and never hand-edited. This
 * only rasterises them.
 *
 *   node scripts/build-brand-kit.mjs && node scripts/build-web-images.mjs
 */
import { readFileSync, statSync } from 'node:fs'
import process from 'node:process'
import sharp from 'sharp'

const JOBS = [
  {
    source: 'public/brand/og-card.svg',
    target: 'public/og-default.jpg',
    // The size every scraper crops to; anything else is cropped for us.
    width: 1200,
    height: 630,
    // Twitter rejects a card above 5 MB and a slow connection notices long
    // before that. A preview image has no business being large.
    maxKb: 300,
    encode: (pipeline) => pipeline.jpeg({ quality: 84, mozjpeg: true }),
  },
  {
    source: 'public/brand/icon-maskable.svg',
    target: 'public/icon-maskable-512.png',
    width: 512,
    height: 512,
    maxKb: 120,
    encode: (pipeline) => pipeline.png({ compressionLevel: 9 }),
  },
]

let failed = 0

for (const job of JOBS) {
  const info = await job
    .encode(sharp(readFileSync(job.source), { density: 144 }).resize(job.width, job.height, { fit: 'cover' }))
    .toFile(job.target)

  const kb = Math.round(statSync(job.target).size / 1024)
  const wrongSize = info.width !== job.width || info.height !== job.height

  if (wrongSize) {
    console.error(`❌ ${job.target} is ${info.width}×${info.height}, expected ${job.width}×${job.height}`)
    failed++
  } else if (kb > job.maxKb) {
    console.error(`❌ ${job.target} is ${kb} KB, over its ${job.maxKb} KB budget`)
    failed++
  } else {
    console.log(`✅ ${job.target} — ${info.width}×${info.height}, ${kb} KB`)
  }
}

if (failed > 0) process.exit(1)
