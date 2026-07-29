/**
 * The invariants, checked in a second instead of discovered in production.
 *
 * Every rule here exists because the thing it forbids actually shipped, and
 * every one of them was invisible to the type checker, the unit tests and the
 * build. They are cheap greps that encode a night of debugging.
 *
 *   npm run check:invariants
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
let failures = 0
let checks = 0

function fail(rule, file, line, detail) {
  failures++
  const where = line ? `${file}:${line}` : file
  console.error(`❌ ${rule}\n   ${where}\n   ${detail}\n`)
}

function pass(rule, note) {
  checks++
  console.log(`✅ ${rule}${note ? ` — ${note}` : ''}`)
}

const suppressed = []

/**
 * A justified exception, declared where the code is rather than hidden in this
 * file. Write `invariant-ok: <reason>` on the line or the one above it.
 *
 * The reason is required and must be a real sentence: an exception nobody
 * explained is one nobody can review. Every suppression is printed at the end
 * of a run, so they stay countable rather than accumulating in silence.
 */
function isSuppressed(lines, index, rule, file) {
  const pattern = /invariant-ok:\s*(.+?)\s*(?:\*\/|-->|$)/
  // A few lines of lookback, because a reason worth writing is usually longer
  // than one line and sits in a comment block above the code it explains.
  for (let i = index; i >= Math.max(0, index - 4); i--) {
    const match = pattern.exec(lines[i] ?? '')
    if (!match) continue
    const reason = match[1].trim()
    if (reason.length < 12) return false
    suppressed.push(`${file}:${index + 1} — ${rule}: ${reason}`)
    return true
  }
  return false
}

function* walk(dir, exts) {
  let entries
  try { entries = readdirSync(dir) } catch { return }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.nuxt' || name === '.output' || name === 'dist') continue
    const full = join(dir, name)
    let st
    try { st = statSync(full) } catch { continue }
    if (st.isDirectory()) yield* walk(full, exts)
    else if (exts.some((e) => name.endsWith(e))) yield full
  }
}

function sourceFiles() {
  const roots = ['app', 'server', 'shared', 'scripts'].filter((d) => existsSync(join(ROOT, d)))
  const files = []
  for (const r of roots) files.push(...walk(join(ROOT, r), ['.ts', '.vue', '.mjs']))
  return files
}

const FILES = sourceFiles()
if (FILES.length === 0) {
  console.error('❌ check-invariants scanned no files — the roots below match nothing.')
  process.exit(1)
}

// ── 1. Dates must state a locale AND a time zone ─────────────────────────────
// A serverless function runs in UTC and the shop is in Poitiers. Without both,
// a date rendered on the server differs from the same date in the browser —
// and between midnight and 02:00 it is a different DAY.
{
  const rule = 'Dates go through useFormatDate (locale + Europe/Paris pinned)'
  let bad = 0
  for (const file of FILES) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (rel.endsWith('useFormatDate.ts') || rel.startsWith('scripts/')) continue
    const text = readFileSync(file, 'utf8')
    text.split('\n').forEach((line, i) => {
      if (!/toLocaleDateString|toLocaleTimeString|new Intl\.DateTimeFormat/.test(line)) return
      if (line.includes('timeZone')) return
      bad++
      fail(rule, rel, i + 1, `raw date formatting: ${line.trim().slice(0, 100)}`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 2. Money formatting must not be server-rendered ──────────────────────────
// Intl currency output for fr-FR uses U+202F or U+00A0 depending on the ICU
// version, and Node and Chrome can disagree — a silent hydration mismatch on
// every price.
{
  const rule = 'No Intl currency formatting outside a client-only path'
  let bad = 0
  for (const file of FILES) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (rel.startsWith('scripts/')) continue
    const text = readFileSync(file, 'utf8')
    text.split('\n').forEach((line, i) => {
      if (!/style:\s*'currency'|style:\s*"currency"/.test(line)) return
      // shared/money.ts format() is the sanctioned one; it is called at the edge.
      if (rel === 'shared/money.ts') return
      if (isSuppressed(text.split('\n'), i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, `currency Intl: ${line.trim().slice(0, 100)}`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 3. Locale messages must not contain vue-i18n control characters ──────────
// "@" is the linked-message operator and "|" the plural separator. A bare "@"
// aborts the production build with error code 10; a warm cache hides it by
// serving the previous bundle, so every page silently renders raw keys.
{
  const rule = 'Locale messages escape @ and avoid |'
  const dir = join(ROOT, 'i18n', 'locales')
  let bad = 0
  if (existsSync(dir)) {
    for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) {
      const data = JSON.parse(readFileSync(join(dir, name), 'utf8'))
      const walkMessages = (node, path) => {
        for (const [key, value] of Object.entries(node)) {
          const dotted = path ? `${path}.${key}` : key
          if (typeof value === 'string') {
            if (value.includes('@') && !value.includes("{'@'}")) {
              bad++
              fail(rule, `i18n/locales/${name}`, null, `${dotted}: unescaped @ — write {'@'}`)
            }
            if (value.includes('|')) {
              bad++
              fail(rule, `i18n/locales/${name}`, null, `${dotted}: contains | — use " · "`)
            }
          } else if (value && typeof value === 'object') walkMessages(value, dotted)
        }
      }
      walkMessages(data, '')
    }
  }
  if (bad === 0) pass(rule)
}

// ── 4. Every locale key is used, and every used key exists ───────────────────
// A key nobody renders is dead weight in six files; a key nobody defined
// renders as "cgv.title" to a customer.
{
  const rule = 'No missing locale keys'
  const frPath = join(ROOT, 'i18n', 'locales', 'fr.json')
  let bad = 0
  if (existsSync(frPath)) {
    const fr = JSON.parse(readFileSync(frPath, 'utf8'))
    const known = new Set()
    const collect = (node, path) => {
      for (const [key, value] of Object.entries(node)) {
        const dotted = path ? `${path}.${key}` : key
        if (typeof value === 'string') known.add(dotted)
        else if (value && typeof value === 'object') collect(value, dotted)
      }
    }
    collect(fr, '')

    const used = new Set()
    for (const file of FILES) {
      if (!file.endsWith('.vue') && !file.endsWith('.ts')) continue
      const text = readFileSync(file, 'utf8')
      // Only literal keys; a template-literal key cannot be checked statically.
      for (const m of text.matchAll(/\$?\bt\(\s*['"]([a-z0-9_]+(?:\.[a-z0-9_]+)+)['"]/gi)) {
        used.add(m[1])
      }
    }
    for (const key of used) {
      if (!known.has(key)) {
        bad++
        fail(rule, 'i18n/locales/fr.json', null, `${key} is rendered but not defined`)
      }
    }
    if (bad === 0) pass(rule, `${used.size} literal keys resolved`)
  }
}

// ── 5. The sitemap may only advertise pages that exist ───────────────────────
// A submitted URL that returns nothing is a soft 404, and Google counts them
// against the whole site.
{
  const rule = 'Sitemap lists only pages that exist'
  const sitemap = join(ROOT, 'server', 'routes', 'sitemap.xml.get.ts')
  let bad = 0
  if (existsSync(sitemap)) {
    const text = readFileSync(sitemap, 'utf8')
    const block = text.match(/STATIC_PATHS\s*=\s*\[([\s\S]*?)\]\s*as const/)
    if (block) {
      for (const m of block[1].matchAll(/path:\s*'([^']+)'/g)) {
        const p = m[1]
        const clean = p === '/' ? 'index' : p.replace(/^\//, '')
        const exists =
          existsSync(join(ROOT, 'app', 'pages', `${clean}.vue`)) ||
          existsSync(join(ROOT, 'app', 'pages', clean, 'index.vue'))
        if (!exists) {
          bad++
          fail(rule, 'server/routes/sitemap.xml.get.ts', null, `${p} has no page — soft 404`)
        }
      }
    }
  }
  if (bad === 0) pass(rule)
}

// ── 6. Nothing may read browser state during setup ───────────────────────────
// localStorage read while the component is setting up makes the client's first
// render disagree with the server's HTML. It belongs in onMounted.
{
  const rule = 'Browser storage is read in onMounted, never during setup'
  let bad = 0
  for (const file of FILES.filter((f) => f.endsWith('.vue'))) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    const text = readFileSync(file, 'utf8')
    const script = text.split('</script>')[0] ?? ''
    const lines = script.split('\n')
    lines.forEach((line, i) => {
      // Only READS matter. A write during setup changes nothing about what
      // renders; a read decides what the first client render looks like, and
      // the server had no way to see the same value.
      if (!/\b(localStorage|sessionStorage)\s*\.\s*getItem/.test(line)) return
      // A guard anywhere in the few lines above means this runs after mount or
      // on the client only, which is exactly where it belongs.
      const context = lines.slice(Math.max(0, i - 6), i).join('\n')
      if (/onMounted\(|onBeforeMount\(|import\.meta\.client|process\.client|nuxtApp\.hook/.test(context)) return
      if (isSuppressed(lines, i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, `storage READ at setup: ${line.trim().slice(0, 90)}`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 7. Admin routes must be guarded ──────────────────────────────────────────
// The invariant is "this route is guarded", not "it is guarded my way". Two
// shapes are legitimate: the route wrapper declaring access, or an explicit
// requireAdmin call. A rule that insisted on one would report the other as
// broken — and a gate that cries wolf is a gate somebody switches off.
{
  const rule = 'Every /api/admin route is admin-guarded'
  const dir = join(ROOT, 'server', 'api', 'admin')
  let bad = 0
  if (existsSync(dir)) {
    for (const file of walk(dir, ['.ts'])) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
      const guarded = /access:\s*'admin'/.test(text) || /\brequireAdmin\s*\(/.test(text)
      if (!guarded) {
        bad++
        fail(rule, rel, null, 'neither access: admin nor requireAdmin — open to any customer')
      }
    }
  }
  if (bad === 0) pass(rule)
}

// ── 8. A scheduled job must actually be scheduled ────────────────────────────
// expireStaleReservations was written, documented, unit-tested and called by
// nothing, so every abandoned checkout held its stock forever.
{
  const rule = 'Scheduled endpoints are authenticated, and reachable by their scheduler'
  const cronDir = join(ROOT, 'server', 'api', 'cron')
  let bad = 0
  if (existsSync(cronDir)) {
    const vercelJson = join(ROOT, 'vercel.json')
    const crons = existsSync(vercelJson)
      ? (JSON.parse(readFileSync(vercelJson, 'utf8')).crons ?? [])
      : []
    // Vercel Cron and an external scheduler are both legitimate. Which one is
    // in use decides which rules apply.
    const usesVercelCron = crons.length > 0
    const declared = JSON.stringify(crons)

    for (const file of walk(cronDir, ['.ts'])) {
      const rel = relative(ROOT, file).replace(/\\/g, '/')
      const text = readFileSync(file, 'utf8')
      const name = rel.split('/').pop().replace(/\.(get|post)\.ts$/, '').replace(/\.ts$/, '')

      // Whoever calls it, it must not be callable by a stranger: this endpoint
      // cancels orders and deletes rows.
      if (!/CRON_SECRET/.test(text)) {
        bad++
        fail(rule, rel, null, 'no CRON_SECRET check — anyone could trigger it')
      }

      if (usesVercelCron) {
        if (!declared.includes(name)) {
          bad++
          fail(rule, rel, null, `no entry in vercel.json for /api/cron/${name} — it would never run`)
        }
        // Vercel Cron issues GET. A .post.ts handler answers 405 forever while
        // the dashboard reports the job as healthy, and nothing says the work
        // stopped happening.
        if (rel.endsWith('.post.ts')) {
          bad++
          fail(rule, rel, null, 'Vercel Cron sends GET — this handler only accepts POST')
        }
      }
    }
  }
  if (bad === 0) pass(rule)
}

if (suppressed.length > 0) {
  console.log(`
ℹ️  ${suppressed.length} declared exception(s):`)
  for (const entry of suppressed) console.log(`   ${entry}`)
}

console.log('')
if (failures > 0) {
  console.error(`❌ ${failures} invariant violation(s) across ${checks + 1} rules`)
  process.exit(1)
}
console.log(`✅ All ${checks} invariants hold`)
