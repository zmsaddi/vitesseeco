/**
 * The brand kit generator.
 *
 * Every deliverable in public/brand/ is COMPOSED here from three source
 * ingredients — the potrace stag path, the drawn spark path, and the wordmark
 * outlined from the real Manrope-800 (so print shops need no font installed).
 * Change an ingredient or a palette value, re-run, and the whole kit stays
 * coherent. Never hand-edit the generated files.
 *
 *   node scripts/build-brand-kit.mjs
 *
 * Palette decreed by the owner 2026-07-31 (see README.md it emits).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import opentype from 'opentype.js'

const OUT = 'public/brand'
mkdirSync(OUT, { recursive: true })

// ── palette ────────────────────────────────────────────────────────────────
const P = {
  forest: { light: '#428177', deep: '#054239', black: '#002623' },
  wheat: { light: '#edebe0', mid: '#b9a779', deep: '#988561' },
  umber: { light: '#6b1f2a', deep: '#4a151e', black: '#260f14' },
  charcoal: { white: '#ffffff', mid: '#3d3a3b', black: '#161616' },
  sparkFrom: '#31C6FF',
  sparkTo: '#0077FF',
  // Derived tint of Forest light, the ONLY "Eco" colour on dark grounds —
  // #428177 sat at ~2.5:1 on Forest black and the critics rejected it; ad-hoc
  // mints varied per file. One tint, everywhere, ~5:1.
  forestTint: '#8CC5B9',
}

// ── ingredients ────────────────────────────────────────────────────────────
const stagSvg = readFileSync(`${OUT}/stag-symbol.svg`, 'utf8')
const STAG_D = stagSvg.match(/ d="([^"]+)"/)[1]
const STAG_VB = stagSvg.match(/viewBox="([^"]+)"/)[1] // 0 0 2076 2832
const [, , SW, SH] = STAG_VB.split(' ').map(Number)

const BOLT_D = 'M34 0 L0 62 h20 L8 118 56 44 H34 L52 0 Z' // vb -4 -4 64 126

const font = opentype.parse(
  readFileSync('node_modules/@fontsource/manrope/files/manrope-latin-800-normal.woff').buffer.slice(0)
)
/**
 * toPathData() lets JavaScript stringify near-zero floats, and "7.1e-15" is
 * not a number an SVG path parser accepts — it aborts THERE, silently dropping
 * every remaining glyph. That is how "Vitesse" rendered as "Vite" at some
 * sizes and survived at others. The commands are serialised by hand instead,
 * every coordinate pinned to two decimals.
 */
const fx = (n) => (Math.abs(n) < 1e-6 ? '0' : n.toFixed(2).replace(/\.00$/, ''))
const font500 = opentype.parse(
  readFileSync('node_modules/@fontsource/manrope/files/manrope-latin-500-normal.woff').buffer.slice(0)
)
const wordAt = (fnt, text, size) => {
  const path = fnt.getPath(text, 0, 0, size)
  const d = path.commands
    .map((c) =>
      c.type === 'M' ? `M${fx(c.x)} ${fx(c.y)}`
      : c.type === 'L' ? `L${fx(c.x)} ${fx(c.y)}`
      : c.type === 'C' ? `C${fx(c.x1)} ${fx(c.y1)} ${fx(c.x2)} ${fx(c.y2)} ${fx(c.x)} ${fx(c.y)}`
      : c.type === 'Q' ? `Q${fx(c.x1)} ${fx(c.y1)} ${fx(c.x)} ${fx(c.y)}`
      : 'Z')
    .join('')
  return { d, w: fnt.getAdvanceWidth(text, size) }
}
const word500 = (text, size) => wordAt(font500, text, size)
const word = (text, size) => {
  const path = font.getPath(text, 0, 0, size)
  const d = path.commands
    .map((c) =>
      c.type === 'M' ? `M${fx(c.x)} ${fx(c.y)}`
      : c.type === 'L' ? `L${fx(c.x)} ${fx(c.y)}`
      : c.type === 'C' ? `C${fx(c.x1)} ${fx(c.y1)} ${fx(c.x2)} ${fx(c.y2)} ${fx(c.x)} ${fx(c.y)}`
      : c.type === 'Q' ? `Q${fx(c.x1)} ${fx(c.y1)} ${fx(c.x)} ${fx(c.y)}`
      : 'Z')
    .join('')
  return { d, w: font.getAdvanceWidth(text, size) }
}

// ── helpers ────────────────────────────────────────────────────────────────
const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`
const stagAt = (x, y, h, fill) => {
  const s = h / SH
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(6)})"><path fill-rule="evenodd" fill="${fill}" d="${STAG_D}"/></g>`
}
const boltAt = (x, y, h, gradId, mono = null) => {
  const s = h / 126
  const fill = mono ?? `url(#${gradId})`
  return `<g transform="translate(${x} ${y}) scale(${s.toFixed(5)})"><path d="${BOLT_D}" fill="${fill}" transform="skewX(-6)" transform-origin="28 59"/></g>`
}
const sparkDefs = (id) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${P.sparkFrom}"/><stop offset="1" stop-color="${P.sparkTo}"/></linearGradient></defs>`
const write = (name, content) => {
  writeFileSync(`${OUT}/${name}`, content)
  console.log('  ', name.padEnd(28), (content.length / 1024).toFixed(1) + ' KB')
}

/**
 * The primary lockup, geometry shared by every composition:
 * stag (1.55× cap) · gap · Vitesse · gap · bolt (0.8×) · gap · Eco
 * Returns { body, w, h } drawn with baseline at y = fs.
 */
function lockup(fs, { stagFill, vitesseFill, ecoFill, gradId, boltMono = null }) {
  const capH = fs * 0.72
  const stagH = fs * 1.5
  const v = word('Vitesse', fs)
  const e = word('Eco', fs)
  const boltH = fs * 0.8
  const boltW = boltH * (64 / 126)
  /*
   * Seventeen independent critics measured the first pass. Three corrections
   * are now geometry, not taste:
   *  - the WORDMARK CENTRE aligns to the stag's visual centre (the antlers add
   *    empty mass above; a baseline-seated wordmark read bottom-heavy);
   *  - the bolt's 6° shear leans its ink LEFT, so the left gap is drawn wider
   *    than the right for equal OPTICAL gaps;
   *  - the bolt's lower tip grounds a touch below the baseline instead of
   *    floating above it.
   */
  const stagTop = fs - stagH * 0.92
  const stagCenter = stagTop + stagH * 0.5
  const baseline = stagCenter + capH * 0.5
  const gapL = fs * 0.27
  const gapR = fs * 0.17
  let x = 0
  const parts = []
  parts.push(stagAt(x, stagTop, stagH, stagFill))
  x += stagH * (SW / SH) + fs * 0.3
  parts.push(`<path fill="${vitesseFill}" transform="translate(${x} ${baseline})" d="${v.d}"/>`)
  x += v.w + gapL
  parts.push(boltAt(x, baseline + fs * 0.02 - boltH, boltH, gradId, boltMono))
  x += boltW + gapR
  parts.push(`<path fill="${ecoFill}" transform="translate(${x} ${baseline})" d="${e.d}"/>`)
  x += e.w
  return { body: parts.join(''), w: x, top: stagTop, bottom: stagTop + stagH, baseline }
}

/** Wrap a lockup in a canvas that actually CONTAINS it, with even padding. */
function lockupSvg(fs, opts, { pad = null, bg = null } = {}) {
  const L = lockup(fs, opts)
  const p2 = pad ?? fs * 0.24
  const w = Math.ceil(L.w + p2 * 2)
  const h = Math.ceil(L.bottom - L.top + p2 * 2)
  const rect = bg ? `<rect width="${w}" height="${h}" fill="${bg}"/>` : ''
  return { svg: svg(w, h, rect + sparkDefs(opts.gradId) + `<g transform="translate(${p2} ${p2 - L.top})">${L.body}</g>`), w, h }
}

// ═══ 1. the palette sheet — the colour AUTHORITY, so it must be complete ═══
{
  const fams = [
    ['Forest', [P.forest.light, P.forest.deep, P.forest.black]],
    ['Golden Wheat', [P.wheat.light, P.wheat.mid, P.wheat.deep]],
    ['Deep Umber', [P.umber.light, P.umber.deep, P.umber.black]],
    ['Charcoal', [P.charcoal.white, P.charcoal.mid, P.charcoal.black]],
  ]
  const H = 900
  let body = `<rect width="1040" height="${H}" fill="${P.wheat.light}"/>`
  // document header: this sheet states whose colours these are
  {
    const t = word('Vitesse', 34), e = word('Eco', 34)
    const bh = 27, bw = bh * (64 / 126)
    let hx = 40
    const hy = 64
    body += `<path fill="${P.charcoal.black}" transform="translate(${hx} ${hy})" d="${t.d}"/>`
    hx += t.w + 9
    body += sparkDefs('pal') + `<g transform="translate(${hx} ${hy + 0.7 - bh}) scale(${bh / 126})"><path d="${BOLT_D}" fill="url(#pal)" transform="skewX(-6)" transform-origin="28 59"/></g>`
    hx += bw + 6
    body += `<path fill="${P.forest.deep}" transform="translate(${hx} ${hy})" d="${e.d}"/>`
    const sub = word500('Palette officielle — décrétée 2026-07-31', 19)
    body += `<path fill="${P.charcoal.mid}" transform="translate(40 ${hy + 34})" d="${sub.d}"/>`
  }
  const label = (c, x, y) => {
    const [r, g, bl] = [c.slice(1, 3), c.slice(3, 5), c.slice(5, 7)].map((h2) => parseInt(h2, 16) / 255)
    const lin = (v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
    const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(bl)
    return `<text x="${x}" y="${y}" font-family="Consolas, monospace" font-size="15" font-weight="700" fill="${L > 0.22 ? P.charcoal.black : '#ffffff'}">${c.toUpperCase()}</text>`
  }
  fams.forEach(([name, cols], row) => {
    const y = 168 + row * 140
    const nm = word(name, 20)
    body += `<path fill="${P.charcoal.black}" transform="translate(40 ${y + 18})" d="${nm.d}"/>`
    cols.forEach((c, i) => {
      const x = 260 + i * 250
      body += `<rect x="${x}" y="${y - 14}" width="220" height="92" rx="12" fill="${c}" stroke="#98856188" stroke-width="1.5"/>`
      body += label(c, x + 14, y + 62)
    })
  })
  // derived tints + the spark — the system's OWN rules, stated completely
  {
    const y = 168 + 4 * 140
    const nm = word('Dérivés & étincelle', 20)
    body += `<path fill="${P.charcoal.black}" transform="translate(40 ${y + 18})" d="${nm.d}"/>`
    body += `<rect x="260" y="${y - 14}" width="220" height="92" rx="12" fill="${P.forestTint}" stroke="#98856188" stroke-width="1.5"/>`
    body += label(P.forestTint, 274, y + 62)
    const note1 = word500('« Eco » sur fonds sombres', 15)
    body += `<path fill="${P.charcoal.mid}" transform="translate(274 ${y + 24})" d="${note1.d}"/>`
    body += `<defs><linearGradient id="palsw" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${P.sparkFrom}"/><stop offset="1" stop-color="${P.sparkTo}"/></linearGradient></defs>`
    body += `<rect x="510" y="${y - 14}" width="220" height="92" rx="12" fill="url(#palsw)" stroke="#98856188" stroke-width="1.5"/>`
    body += `<text x="524" y="${y + 62}" font-family="Consolas, monospace" font-size="15" font-weight="700" fill="#ffffff">#31C6FF→#0077FF</text>`
    const note2 = word500('éclairs uniquement', 15)
    body += `<path fill="#ffffff" transform="translate(524 ${y + 24})" d="${note2.d}"/>`
    const foot = word500('Les surfaces, textes et actions restent dans les quatre familles ; les dérivés documentés servent les lavis et « Eco » sur sombre.', 16)
    body += `<path fill="${P.charcoal.mid}" transform="translate(40 ${H - 40})" d="${foot.d}"/>`
  }
  write('palette.svg', svg(1040, H, body))
}

// ═══ 2. the marks ══════════════════════════════════════════════════════════
for (const [name, fill] of [
  ['stag-gold', P.wheat.mid],
  ['stag-gold-deep', P.wheat.deep],
  ['stag-forest', P.forest.deep],
  ['stag-charcoal', P.charcoal.black],
  ['stag-cream', P.wheat.light],
  ['stag-white', P.charcoal.white],
]) {
  write(`${name}.svg`, svg(SW, SH, `<path fill-rule="evenodd" fill="${fill}" d="${STAG_D}"/>`))
}
write('bolt.svg', svg(80, 134, sparkDefs('s') + `<g transform="translate(16 4)"><path d="${BOLT_D}" fill="url(#s)" transform="skewX(-6)" transform-origin="28 59"/></g>`))

// ═══ 3. primary lockups ════════════════════════════════════════════════════
{
  write('logo-primary.svg', lockupSvg(100, { stagFill: P.wheat.deep, vitesseFill: P.charcoal.black, ecoFill: P.forest.deep, gradId: 'lp' }).svg)
  write('logo-primary-dark.svg', lockupSvg(100, { stagFill: P.wheat.mid, vitesseFill: P.wheat.light, ecoFill: P.forestTint, gradId: 'ld' }, { bg: P.forest.black }).svg)
}

// ═══ 4. stacked (square) — avatars, social profile ═════════════════════════
{
  const fs = 92
  const v = word('Vitesse', fs), e = word('Eco', fs)
  const gap = fs * 0.2, boltH = fs * 0.74, boltW = boltH * (64 / 126)
  const rowW = v.w + gap + boltW + gap + e.w
  const W2 = 1080, stagH2 = 560, LIFT = 14
  const stagW2 = stagH2 * (SW / SH)
  let b = `<rect width="1080" height="1080" fill="${P.wheat.light}"/>` + sparkDefs('st')
  b += stagAt((W2 - stagW2) / 2, 120 - LIFT, stagH2, P.wheat.deep)
  let x = (W2 - rowW) / 2
  const byl = 870 - LIFT
  b += `<path fill="${P.charcoal.black}" transform="translate(${x} ${byl})" d="${v.d}"/>`
  x += v.w + gap
  b += boltAt(x, byl - fs * 0.72 - (boltH - fs * 0.72) / 2, boltH, 'st')
  x += boltW + gap
  b += `<path fill="${P.forest.deep}" transform="translate(${x} ${byl})" d="${e.d}"/>`
  b += `<text x="540" y="958" text-anchor="middle" font-family="Manrope, Arial" font-weight="600" font-size="30" letter-spacing="4" fill="${P.charcoal.mid}">POITIERS · VITESSE-ECO.FR</text>`
  write('logo-stacked.svg', svg(1080, 1080, b))
}

// ═══ 5. the two approved tiles + avatar ════════════════════════════════════
for (const [name, bg] of [['tile-forest', P.forest.deep], ['tile-forest-black', P.forest.black]]) {
  const stagH3 = 700, stagW3 = stagH3 * (SW / SH)
  write(`${name}.svg`, svg(1024, 1024,
    `<rect width="1024" height="1024" rx="225" fill="${bg}"/>` +
    stagAt((1024 - stagW3) / 2, (1024 - stagH3) / 2, stagH3, P.wheat.mid)))
}
{
  const stagH4 = 620, stagW4 = stagH4 * (SW / SH)
  write('avatar-circle.svg', svg(1024, 1024,
    `<circle cx="512" cy="512" r="512" fill="${P.forest.deep}"/>` +
    stagAt((1024 - stagW4) / 2, (1024 - stagH4) / 2, stagH4, P.wheat.mid)))
}

// ═══ 6. the approved dark card ═════════════════════════════════════════════
{
  const L = lockup(84, { stagFill: P.wheat.mid, vitesseFill: P.charcoal.white, ecoFill: P.forestTint, gradId: 'cd' })
  const W3 = Math.ceil(L.w + 160)
  const H3 = Math.ceil(L.bottom - L.top + 140)
  write('card-dark.svg', svg(W3, H3,
    `<rect width="${W3}" height="${H3}" rx="36" fill="${P.forest.black}"/>` + sparkDefs('cd') +
    `<g transform="translate(80 ${70 - L.top})">${L.body}</g>`))
}

// ═══ 7. business card, 85×55 mm at 10px/mm ═════════════════════════════════
{
  const L = lockup(56, { stagFill: P.wheat.mid, vitesseFill: P.wheat.light, ecoFill: P.forestTint, gradId: 'bc' })
  let front = `<rect width="850" height="550" fill="${P.forest.black}"/>` + sparkDefs('bc')
  front += `<g transform="translate(${(850 - L.w) / 2} 180)">${L.body}</g>`
  front += `<rect x="80" y="330" width="690" height="2" fill="${P.wheat.deep}" opacity="0.5"/>`
  {
    const tg = word500('VÉLOS ÉLECTRIQUES · POITIERS', 27)
    front += `<path fill="${P.wheat.light}" transform="translate(${(850 - tg.w) / 2} 398)" d="${tg.d}"/>`
  }
  write('business-card-front.svg', svg(850, 550, front))

  // Fixed brand lines are OUTLINED (a print shop needs no font); only the
  // name and role stay live text, because they are the part people edit.
  let back = `<rect width="850" height="550" fill="${P.wheat.light}"/>`
  const stagH5 = 235, stagW5 = stagH5 * (SW / SH)
  // The whole composition (stag column + text column) centres as ONE group,
  // and the stag's centre sits on the text block's centre — the critics
  // measured both floating before.
  const LEFT = 348, RIGHT_SAFE = 40
  back += stagAt(96, 168, stagH5, P.wheat.deep)
  back += `<text x="${LEFT}" y="150" font-family="Manrope, Arial" font-weight="800" font-size="34" fill="${P.charcoal.black}">NOM Prénom</text>`
  back += `<text x="${LEFT}" y="192" font-family="Manrope, Arial" font-weight="600" font-size="24" fill="${P.charcoal.mid}">Fonction</text>`
  const fixed = [
    ['+33 7 45 83 00 49', 24, P.charcoal.mid],
    ['contact@vitesse-eco.fr', 24, P.charcoal.mid],
    ['32 Rue du Faubourg du Pont Neuf', 22, P.charcoal.mid],
    ['86000 Poitiers', 22, P.charcoal.mid],
    ['vitesse-eco.fr', 26, P.forest.deep],
  ]
  let y5 = 268
  for (const [txt, size, fill] of fixed) {
    const isSite = txt === 'vitesse-eco.fr'
    if (isSite) y5 += 18 // the sign-off is its own breath, not an address line
    const o = isSite ? word(txt, size) : word500(txt, size)
    if (LEFT + o.w > 850 - RIGHT_SAFE) throw new Error(`card back overflow: ${txt}`)
    back += `<path fill="${fill}" transform="translate(${LEFT} ${y5})" d="${o.d}"/>`
    y5 += size * 1.72
  }
  back += `<rect x="0" y="530" width="850" height="20" fill="${P.umber.light}"/>`
  write('business-card-back.svg', svg(850, 550, back))
}

// ═══ 8. invoice header + stamp ═════════════════════════════════════════════
{
  const L = lockup(64, { stagFill: P.wheat.deep, vitesseFill: P.charcoal.black, ecoFill: P.forest.deep, gradId: 'inv' })
  let b = `<rect width="2100" height="360" fill="${P.wheat.light}"/>` + sparkDefs('inv')
  b += `<g transform="translate(100 110)">${L.body}</g>`
  {
    const rows = [
      [word('VITESSE ECO SAS', 30), P.charcoal.black],
      [word500('32 Rue du Faubourg du Pont Neuf, 86000 Poitiers', 25), P.charcoal.mid],
      [word500('SIREN 100 732 247 · TVA FR43 100 732 247', 25), P.charcoal.mid],
      [word500('contact@vitesse-eco.fr · +33 7 45 83 00 49', 25), P.charcoal.mid],
    ]
    let y = 112
    for (const [o, fill] of rows) {
      b += `<path fill="${fill}" transform="translate(${2000 - o.w} ${y})" d="${o.d}"/>`
      y += 46
    }
  }
  b += `<rect x="100" y="300" width="1900" height="4" fill="${P.forest.deep}"/>`
  write('invoice-header.svg', svg(2100, 360, b))

  // the stamp: double ring, curved caption, stag at heart
  let st = `<circle cx="300" cy="300" r="290" fill="${P.wheat.light}"/>`
  st += `<circle cx="300" cy="300" r="282" fill="none" stroke="${P.forest.deep}" stroke-width="10"/>`
  st += `<circle cx="300" cy="300" r="196" fill="none" stroke="${P.forest.deep}" stroke-width="6"/>`
  st += `<defs><path id="arcT" d="M 88 300 A 212 212 0 0 1 512 300" fill="none"/><path id="arcB" d="M 62 300 A 238 238 0 0 0 538 300" fill="none"/></defs>`
  st += `<text font-family="Manrope, Arial" font-weight="800" font-size="52" letter-spacing="10" fill="${P.forest.deep}"><textPath href="#arcT" startOffset="50%" text-anchor="middle">VITESSE ECO</textPath></text>`
  st += `<text font-family="Manrope, Arial" font-weight="700" font-size="40" letter-spacing="14" fill="${P.forest.deep}"><textPath href="#arcB" startOffset="50%" text-anchor="middle">POITIERS · FRANCE</textPath></text>`
  const stagH6 = 240, stagW6 = stagH6 * (SW / SH)
  st += stagAt(300 - stagW6 / 2, 300 - stagH6 / 2 - 6, stagH6, P.wheat.deep)
  write('invoice-stamp.svg', svg(600, 600, st))
}

// ═══ 9. social kit ═════════════════════════════════════════════════════════
{
  // cover 1500×500 — forest black, watermark stag right, lockup left
  const L = lockup(72, { stagFill: P.wheat.mid, vitesseFill: P.wheat.light, ecoFill: P.forestTint, gradId: 'cov' })
  let c = `<rect width="1500" height="500" fill="${P.forest.black}"/>` + sparkDefs('cov')
  const wmH = 430, wmW = wmH * (SW / SH)
  c += `<g opacity="0.16">${stagAt(1500 - wmW - 70, (500 - wmH) / 2, wmH, P.wheat.mid)}</g>`
  c += `<g transform="translate(90 190)">${L.body}</g>`
  c += `<text x="96" y="330" font-family="Manrope, Arial" font-weight="600" font-size="30" letter-spacing="3" fill="${P.wheat.light}" opacity="0.85">Vélos électriques — choisis et préparés à Poitiers.</text>`
  write('social-cover.svg', svg(1500, 500, c))

  // square post template 1080×1080
  const Lp = lockup(46, { stagFill: P.wheat.deep, vitesseFill: P.charcoal.black, ecoFill: P.forest.deep, gradId: 'sq' })
  let sq = `<rect width="1080" height="1080" fill="${P.wheat.light}"/>` + sparkDefs('sq')
  sq += `<g transform="translate(60 60)">${Lp.body}</g>`
  sq += `<rect x="60" y="150" width="960" height="770" rx="24" fill="${P.charcoal.white}" stroke="${P.wheat.deep}" stroke-opacity="0.35"/>`
  sq += `<text x="540" y="560" text-anchor="middle" font-family="Manrope, Arial" font-weight="700" font-size="34" fill="${P.charcoal.mid}" opacity="0.35">[ visuel produit / message ]</text>`
  sq += `<text x="540" y="1010" text-anchor="middle" font-family="Manrope, Arial" font-weight="800" font-size="32" letter-spacing="4" fill="${P.forest.deep}">VITESSE-ECO.FR</text>`
  write('social-post-square.svg', svg(1080, 1080, sq))

  // story 1080×1920
  const Ls = lockup(52, { stagFill: P.wheat.mid, vitesseFill: P.wheat.light, ecoFill: P.forestTint, gradId: 'sto' })
  let sto = `<rect width="1080" height="1920" fill="${P.forest.black}"/>` + sparkDefs('sto')
  sto += `<g transform="translate(${(1080 - Ls.w) / 2} 236)">${Ls.body}</g>`
  sto += `<rect x="70" y="400" width="940" height="1210" rx="28" fill="${P.wheat.light}"/>`
  sto += `<text x="540" y="1010" text-anchor="middle" font-family="Manrope, Arial" font-weight="700" font-size="36" fill="${P.charcoal.mid}" opacity="0.35">[ contenu ]</text>`
  sto += `<text x="540" y="1668" text-anchor="middle" font-family="Manrope, Arial" font-weight="800" font-size="38" letter-spacing="5" fill="${P.wheat.mid}">VITESSE-ECO.FR</text>`
  write('story-template.svg', svg(1080, 1920, sto))

  /*
   * The link preview — 1200×630, the size every scraper crops to.
   *
   * The site shipped with no og:image at all, so a link pasted into WhatsApp
   * showed a bare URL — and WhatsApp is, by the shop's own contact page, how
   * most customers open a conversation. The cover above is 1500×500 and would
   * be cropped through the lockup; this is the same identity composed for 1.91:1.
   *
   * Rendered to public/og-default.jpg by scripts/build-og-image.mjs, because
   * Facebook and WhatsApp still do not agree about SVG or WebP.
   */
  const Lo = lockup(84, { stagFill: P.wheat.mid, vitesseFill: P.wheat.light, ecoFill: P.forestTint, gradId: 'og' })
  let og = `<rect width="1200" height="630" fill="${P.forest.black}"/>` + sparkDefs('og')
  const ogH = 560, ogW = ogH * (SW / SH)
  og += `<g opacity="0.14">${stagAt(1200 - ogW - 40, (630 - ogH) / 2, ogH, P.wheat.mid)}</g>`
  // The lockup draws ABOVE its origin — the baseline sits at the translate
  // point — so this is a baseline, not a top edge. Computing it from the height
  // put the antlers off the top of the card.
  og += `<g transform="translate(80 250)">${Lo.body}</g>`
  og += `<text x="86" y="404" font-family="Manrope, Arial" font-weight="600" font-size="34" letter-spacing="2" fill="${P.wheat.light}" opacity="0.9">Vélos électriques — choisis et préparés à Poitiers.</text>`
  og += `<rect x="86" y="446" width="120" height="5" fill="${P.forestTint}"/>`
  og += `<text x="86" y="530" font-family="Manrope, Arial" font-weight="800" font-size="30" letter-spacing="5" fill="${P.wheat.mid}">VITESSE-ECO.FR</text>`
  write('og-card.svg', svg(1200, 630, og))

  /*
   * The maskable app icon — 512×512.
   *
   * The manifest declared only `purpose: "any"` icons, and the existing one is
   * a rounded square with the stag filling it edge to edge. Android crops a
   * maskable icon to whatever shape the launcher uses, most often a circle, and
   * would have taken the antlers off. This is full-bleed with the stag inside
   * the 80% safe zone, which is the whole point of the purpose.
   */
  const iconH = 512 * 0.52
  let ic = `<rect width="512" height="512" fill="${P.forest.black}"/>`
  ic += stagAt((512 - iconH * (SW / SH)) / 2, (512 - iconH) / 2, iconH, P.wheat.mid)
  write('icon-maskable.svg', svg(512, 512, ic))
}

// ═══ 10. e-mail signature ══════════════════════════════════════════════════
{
  const L = lockup(40, { stagFill: P.wheat.deep, vitesseFill: P.charcoal.black, ecoFill: P.forest.deep, gradId: 'sig' })
  let b = `<rect width="640" height="150" fill="${P.charcoal.white}"/>` + sparkDefs('sig')
  b += `<g transform="translate(24 34)">${L.body}</g>`
  b += `<rect x="24" y="96" width="592" height="2" fill="${P.wheat.deep}" opacity="0.5"/>`
  b += `<text x="24" y="130" font-family="Manrope, Arial" font-weight="600" font-size="18" fill="${P.charcoal.mid}">vitesse-eco.fr · +33 7 45 83 00 49 · Poitiers</text>`
  write('email-signature.svg', svg(640, 150, b))
}

// ═══ 11. brochure — DL roll-fold, 297×210 mm at 10 px/mm, both sides ══════
{
  // Roll-fold: the tuck-in flap is 2 mm narrower or every copy buckles.
  const PH = 2100
  const OUTER_W = [970, 1000, 1000]   // flap · back · cover
  const INNER_W = [1000, 1000, 970]   // p1 · p2 · fold-in
  const xs = (ws) => [0, ws[0], ws[0] + ws[1]]
  const guide = (x) => `<line x1="${x}" y1="0" x2="${x}" y2="${PH}" stroke="${P.charcoal.mid}" stroke-opacity="0.18" stroke-dasharray="14 18" stroke-width="2"/>`

  // ── OUTER ────────────────────────────────────────────────────────────────
  const OX = xs(OUTER_W)
  let o = `<rect width="2970" height="2100" fill="${P.wheat.light}"/>` + sparkDefs('brA')
  // flap: badge up top, contact block anchored to the lower third
  const stampScale = 0.85
  o += `<g transform="translate(${OX[0] + (OUTER_W[0] - 600 * stampScale) / 2} 330) scale(${stampScale})">`
  o += `<circle cx="300" cy="300" r="282" fill="none" stroke="${P.forest.deep}" stroke-width="10"/>`
  o += `<circle cx="300" cy="300" r="196" fill="none" stroke="${P.forest.deep}" stroke-width="6"/>`
  const stagHst = 240, stagWst = stagHst * (SW / SH)
  o += stagAt(300 - stagWst / 2, 300 - stagHst / 2 - 6, stagHst, P.wheat.deep) + `</g>`
  {
    const flap = [
      ['32 Rue du Faubourg du Pont Neuf', 33],
      ['86000 Poitiers', 33],
      ['+33 7 45 83 00 49', 33],
      ['contact@vitesse-eco.fr', 33],
    ]
    let fy = 1430
    for (const [txt, size] of flap) {
      const w = word500(txt, size)
      o += `<path fill="${P.charcoal.mid}" transform="translate(${OX[0] + (OUTER_W[0] - w.w) / 2} ${fy})" d="${w.d}"/>`
      fy += size * 1.85
    }
    const site1 = word('vitesse-eco.fr', 40)
    o += `<path fill="${P.forest.deep}" transform="translate(${OX[0] + (OUTER_W[0] - site1.w) / 2} ${fy + 44})" d="${site1.d}"/>`
  }
  o += guide(OX[1]) 
  const wmH2 = 900, wmW2 = wmH2 * (SW / SH)
  o += `<g opacity="0.12">${stagAt(OX[1] + (OUTER_W[1] - wmW2) / 2, 500, wmH2, P.wheat.deep)}</g>`
  {
    const bk = word500('Vélos électriques — Poitiers', 40)
    o += `<path fill="${P.charcoal.mid}" transform="translate(${OX[1] + (OUTER_W[1] - bk.w) / 2} 1700)" d="${bk.d}"/>`
  }
  o += guide(OX[2])
  o += `<rect x="${OX[2]}" y="0" width="${OUTER_W[2]}" height="${PH}" fill="${P.forest.black}"/>`
  const stagHc = 620, stagWc = stagHc * (SW / SH)
  o += stagAt(OX[2] + (OUTER_W[2] - stagWc) / 2, 360, stagHc, P.wheat.mid)
  {
    const fs2 = 64
    const v2 = word('Vitesse', fs2), e2 = word('Eco', fs2)
    const gapL2 = fs2 * 0.27, gapR2 = fs2 * 0.17, boltH2 = fs2 * 0.8, boltW2 = boltH2 * (64 / 126)
    const rowW2 = v2.w + gapL2 + boltW2 + gapR2 + e2.w
    let cx = OX[2] + (OUTER_W[2] - rowW2) / 2
    const cy = 1180
    o += `<path fill="${P.wheat.light}" transform="translate(${cx} ${cy})" d="${v2.d}"/>`
    cx += v2.w + gapL2
    o += boltAt(cx, cy + fs2 * 0.02 - boltH2, boltH2, 'brA')
    cx += boltW2 + gapR2
    o += `<path fill="${P.forestTint}" transform="translate(${cx} ${cy})" d="${e2.d}"/>`
  }
  {
    const tag = word500('Choisis, préparés et suivis avec soin.', 36)
    o += `<path fill="${P.wheat.light}" opacity="0.9" transform="translate(${OX[2] + (OUTER_W[2] - tag.w) / 2} 1300)" d="${tag.d}"/>`
    const cta = word('vitesse-eco.fr', 42)
    o += `<rect x="${OX[2] + (OUTER_W[2] - cta.w - 120) / 2}" y="1760" width="${cta.w + 120}" height="110" rx="55" fill="${P.forest.deep}"/>`
    o += `<path fill="#ffffff" transform="translate(${OX[2] + (OUTER_W[2] - cta.w) / 2} 1832)" d="${cta.d}"/>`
  }
  write('brochure-outer.svg', svg(2970, 2100, o))

  // ── INNER ────────────────────────────────────────────────────────────────
  const IX = xs(INNER_W)
  let n = `<rect width="2970" height="2100" fill="#ffffff"/>` + sparkDefs('brB')
  const heads = ['Nos vélos', 'Livraison par nos soins', 'Garantie & atelier']
  for (let i = 0; i < 3; i++) {
    const x0 = IX[i], pw = INNER_W[i]
    if (i) n += guide(x0)
    const h = word(heads[i], 46)
    n += `<path fill="${P.forest.deep}" transform="translate(${x0 + 90} 220)" d="${h.d}"/>`
    n += `<rect x="${x0 + 90}" y="266" width="${Math.round(h.w)}" height="6" fill="${P.wheat.mid}"/>`
    n += `<rect x="${x0 + 90}" y="340" width="${pw - 180}" height="620" rx="20" fill="${P.wheat.light}" stroke="${P.wheat.deep}" stroke-opacity="0.4"/>`
    const ph = word500('[ photo ]', 30)
    n += `<path fill="${P.charcoal.mid}" opacity="0.4" transform="translate(${x0 + (pw - ph.w) / 2} 668)" d="${ph.d}"/>`
    for (let l = 0; l < 10; l++) {
      n += `<rect x="${x0 + 90}" y="${1060 + l * 78}" width="${pw - 180 - (l % 3) * 90}" height="26" rx="13" fill="${P.charcoal.mid}" opacity="0.16"/>`
    }
    // every panel gets a grounded base line, so no column floats
    n += `<rect x="${x0 + 90}" y="1960" width="120" height="6" fill="${P.wheat.mid}"/>`
    const gh = 190, gw = gh * (SW / SH)
    if (i === 2) n += `<g opacity="0.9">${stagAt(x0 + pw - gw - 90, 1770, gh, P.wheat.deep)}</g>`
  }
  write('brochure-inner.svg', svg(2970, 2100, n))
}

console.log('\nbrand kit complete.')
