#!/usr/bin/env node
/**
 * Bundle size budget guard (P5-04).
 *
 * Reads the .output directory after `nuxi build` and asserts that the total
 * gzip-compressed size is under BUNDLE_BUDGET_BYTES (default 13 MB). Fails
 * the CI step if exceeded so a regression cannot land silently.
 *
 * For per-route or per-chunk budgets we'd need a more sophisticated tool;
 * this is a coarse-but-effective canary.
 */
import { readdirSync, statSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

const BUDGET = Number.parseInt(process.env.BUNDLE_BUDGET_BYTES || String(6.5 * 1024 * 1024), 10)
const ROOTS = ['.output/public', '.output/server']

// Native platform binaries (sharp/libvips .so/.node) are runtime infrastructure,
// not code we control — their size moves with dependency releases, not with our
// changes, so they are tracked separately and excluded from the budget.
const NATIVE_BINARY = /\.(so(\.[\d.]+)?|node|dll|dylib)$/

function* walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) yield* walk(full)
    else yield { full, size: st.size }
  }
}

function gzipSize(filePath) {
  // Skip already-compressed assets (images, fonts, etc.) and source maps
  if (/\.(woff2|woff|png|jpg|jpeg|webp|avif|ico|map)$/.test(filePath)) {
    return 0
  }
  try {
    const content = readFileSync(filePath)
    return gzipSync(content).length
  } catch {
    return 0
  }
}

let total = 0
let nativeTotal = 0
const top = []
for (const root of ROOTS) {
  for (const f of walk(root)) {
    if (NATIVE_BINARY.test(f.full)) {
      nativeTotal += gzipSize(f.full)
      continue
    }
    const gz = gzipSize(f.full)
    total += gz
    if (gz > 50_000) top.push({ ...f, gz })
  }
}

const totalMb = (total / 1024 / 1024).toFixed(2)
const budgetMb = (BUDGET / 1024 / 1024).toFixed(2)

console.log(`Bundle gzip total (code): ${totalMb} MB (budget: ${budgetMb} MB)`)
console.log(`Native binaries (informational, not budgeted): ${(nativeTotal / 1024 / 1024).toFixed(2)} MB`)
console.log('Top contributors (>50KB gzip):')
top.sort((a, b) => b.gz - a.gz).slice(0, 10).forEach((f) => {
  console.log(`  ${(f.gz / 1024).toFixed(1).padStart(7)} KB  ${f.full.replace(/^\.output\//, '')}`)
})

if (total > BUDGET) {
  console.error(`\n❌ Bundle exceeds budget by ${((total - BUDGET) / 1024 / 1024).toFixed(2)} MB`)
  process.exit(1)
}
console.log('\n✅ Within budget')
