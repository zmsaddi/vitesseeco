#!/usr/bin/env node
/**
 * Forbid raw hex colors in .vue templates (P2-03).
 *
 * Phase 2 establishes Tailwind tokens as the single source of truth for
 * colors. Raw hex like #ABCDEF in a class binding (`bg-[#ABCDEF]`) or
 * inline style is a token-system bypass and should be replaced with a
 * named utility (bg-accent, text-success, etc.) or a token added to
 * tailwind.config.ts.
 *
 * Allowed exceptions:
 *  - color attribute on elements bound to dynamic Sanity data
 *    (e.g., :style="{ backgroundColor: product.colorHex }") — these are
 *    USER-PROVIDED hex values, not design choices, so they're fine.
 *  - style sections in cms/ studio (separate aesthetic, not the Vue app)
 *
 * Run: npm run check:hex
 * CI:  add to the build job before nuxi build.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const ROOTS = ['pages', 'components', 'layouts', 'app.vue']
const HEX_PATTERN = /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?\b/g

// Lines we tolerate. Each entry is a substring that must appear on the line.
const ALLOWED_CONTEXTS = [
  'colorHex',          // dynamic Sanity color values
  'product.color',     // dynamic
  '.style',            // inline computed styles in scripts
  'gradient(',         // SVG gradients with raw colors are acceptable
  '<!--',              // comment lines
  'rrggbb',            // textual examples
  '#RRGGBB',
  '<svg',              // brand SVGs (Google logo, etc.) — third-party brand colors
  '<path',             // continuation of brand SVGs across lines
  'fill="#',           // explicit brand-color SVG fills
]

function* walk(dir) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) yield* walk(full)
    else if (name.endsWith('.vue')) yield full
  }
}

function check(filePath) {
  const text = readFileSync(filePath, 'utf8')
  const lines = text.split('\n')
  const violations = []
  let inStyle = false
  let inScript = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (/<style\b/i.test(line)) inStyle = true
    if (/<\/style>/i.test(line)) { inStyle = false; continue }
    if (/<script\b/i.test(line)) inScript = true
    if (/<\/script>/i.test(line)) { inScript = false; continue }
    if (inStyle) continue // raw hex in scoped <style> blocks is allowed
    if (inScript) continue // raw hex in <script setup> is also allowed (data, computed)

    const matches = line.match(HEX_PATTERN)
    if (!matches) continue

    const lower = line.toLowerCase()
    const allowed = ALLOWED_CONTEXTS.some((c) => lower.includes(c.toLowerCase()))
    if (allowed) continue

    violations.push({ file: filePath, line: i + 1, content: line.trim(), matches })
  }
  return violations
}

function main() {
  let total = 0
  const allViolations = []
  for (const root of ROOTS) {
    let files = []
    if (root.endsWith('.vue')) files = [root]
    else files = [...walk(root)]
    for (const f of files) {
      const v = check(f)
      if (v.length) {
        total += v.length
        allViolations.push(...v)
      }
    }
  }

  if (total === 0) {
    console.log('✅ No raw hex colors found in .vue templates')
    process.exit(0)
  }

  console.error(`❌ Found ${total} raw hex color(s) in .vue templates:\n`)
  for (const v of allViolations) {
    console.error(`  ${v.file}:${v.line}`)
    console.error(`    ${v.content}`)
    console.error(`    matched: ${v.matches.join(', ')}\n`)
  }
  console.error('Replace with a Tailwind token (e.g. bg-accent) or add to tailwind.config.ts.')
  process.exit(1)
}

main()
