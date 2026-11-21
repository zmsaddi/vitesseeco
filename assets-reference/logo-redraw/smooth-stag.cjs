// Redraws the stag with smooth edges.
//
// The mark in public/brand/stag-symbol.svg is a trace of a 672 × 924 px picture:
// its outline follows that picture's pixel steps (1,710 tiny curves). This
// renders the mark very large, melts the steps with a blur far smaller than any
// real feature, cuts it back to a hard edge, and traces THAT — so the shape is
// kept and only the stair-stepping goes.
//
//   node smooth-stag.cjs <repo root> <out dir> <blur sigma in source pixels> [optTolerance] [alphaMax]
const fs = require('fs')
const path = require('path')
const { createRequire } = require('module')
const potrace = require('potrace')

const [repo, outDir, sigmaArg, tolArg, alphaArg, traceArg] = process.argv.slice(2)
const req = createRequire(path.join(path.resolve(repo), 'package.json'))
const sharp = req('sharp')

const SCALE = 4 // render pixels per viewBox unit
const SOURCE_PX = 2076 / 672 // viewBox units per pixel of the picture the mark was traced from
const sigmaSource = Number(sigmaArg)
const sigma = sigmaSource * SOURCE_PX * SCALE
const optTolerance = Number(tolArg ?? 0.4)
const alphaMax = Number(alphaArg ?? 1.1)
// Pixels per viewBox unit of the picture handed to the tracer. The tracer places
// about one node per feature it can resolve, so a coarser picture of an already
// smooth edge gives the few, long curves a designer would draw.
const TRACE = Number(traceArg ?? SCALE)

;(async () => {
  const svg = fs.readFileSync(path.join(repo, 'public/brand/stag-symbol.svg'), 'utf8')
  const d = svg.match(/ d="([^"]+)"/)[1]
  const [, , W, H] = svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)
  const flat = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * SCALE}" height="${H * SCALE}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><path fill-rule="evenodd" fill="#000" d="${d}"/></svg>`

  const big = await sharp(Buffer.from(flat), { limitInputPixels: false }).greyscale().png().toBuffer()
  const melted = await sharp(big, { limitInputPixels: false }).blur(sigma).threshold(128).png().toBuffer()
  // Shrink with averaging, so the edge position survives as grey levels, then cut again.
  const smooth = TRACE === SCALE ? melted : await sharp(melted, { limitInputPixels: false }).resize(Math.round(W * TRACE), Math.round(H * TRACE), { kernel: 'lanczos3' }).threshold(128).png().toBuffer()

  const traced = await new Promise((resolve, reject) => {
    const tracer = new potrace.Potrace({ turdSize: Math.max(2, Math.round(40 * (TRACE / SCALE) ** 2)), alphaMax, optCurve: true, optTolerance, threshold: 128, blackOnWhite: true })
    tracer.loadImage(smooth, (err) => (err ? reject(err) : resolve(tracer.getPathTag())))
  })
  const bigD = traced.match(/ d="([^"]+)"/)[1]
  // Back to the mark's own coordinates. Every number in a potrace path is absolute.
  const fx = (n) => (Math.round(n * 100) / 100).toString()
  const newD = bigD.replace(/-?\d+(\.\d+)?/g, (n) => fx(Number(n) / TRACE)).replace(/\s+/g, ' ').trim()
  if (/[a-z]/.test(newD.replace(/[MLCZ]/g, '').replace(/[\d.\s,-]/g, ''))) throw new Error('unexpected relative commands in the traced path')

  const count = (p) => { const c = {}; for (const k of p.match(/[MLCZ]/g)) c[k] = (c[k] || 0) + 1; return c }
  fs.mkdirSync(outDir, { recursive: true })
  const name = `stag-smooth-s${sigmaSource}-t${optTolerance}-a${alphaMax}-r${TRACE}`
  fs.writeFileSync(path.join(outDir, `${name}.d.txt`), newD)

  // How much ink moved: render both at the same size and count differing pixels.
  const render = async (p) => (await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#fff"/><path fill-rule="evenodd" fill="#000" d="${p}"/></svg>`)).greyscale().raw().toBuffer())
  const [a, b] = [await render(d), await render(newD)]
  let ink = 0, moved = 0
  for (let i = 0; i < a.length; i++) { const x = a[i] < 128, y = b[i] < 128; if (x) ink++; if (x !== y) moved++ }
  console.log(JSON.stringify({ name, before: count(d), after: count(newD), bytesBefore: d.length, bytesAfter: newD.length, inkMovedPercent: +(100 * moved / ink).toFixed(2) }))
})()
