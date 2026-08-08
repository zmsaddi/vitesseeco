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

// ── 2. Money formatting is confined to the two sanctioned edges ──────────────
// Intl currency output for fr-FR uses U+202F or U+00A0 depending on the ICU
// version, and Node and Chrome can disagree — a silent hydration mismatch on
// every price. shared/money.ts serves machines; useFormatPrice serves humans
// and normalises the space so server and client render byte-identically.
{
  const rule = 'Intl currency only in shared/money.ts or useFormatPrice'
  const SANCTIONED = new Set(['shared/money.ts', 'app/composables/useFormatPrice.ts'])
  let bad = 0
  for (const file of FILES) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (rel.startsWith('scripts/')) continue
    const text = readFileSync(file, 'utf8')
    text.split('\n').forEach((line, i) => {
      if (!/style:\s*'currency'|style:\s*"currency"/.test(line)) return
      if (SANCTIONED.has(rel)) return
      if (isSuppressed(text.split('\n'), i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, `currency Intl: ${line.trim().slice(0, 100)}`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 2b. Displayed prices go through useFormatPrice ───────────────────────────
// Raw toFixed(2) renders "950.00 €" — anglophone always, on a shop whose
// default language is French — and it slipped past the Intl rule above
// precisely because it never calls Intl. Thirteen templates had it. Machine
// decimals (schema.org offers.price, feed columns) legitimately keep it,
// stated with an invariant-ok reason.
{
  const rule = 'Displayed prices go through useFormatPrice, not toFixed'
  let bad = 0
  for (const file of FILES) {
    const rel = relative(ROOT, file).replace(/\\/g, '/')
    if (!rel.endsWith('.vue') || !rel.startsWith('app/')) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      // A wire string with a currency or percent glyph stuck on the end is the
      // same defect wearing different clothes: "1498.00 €" instead of
      // "1 498,00 €". The toFixed rule below reported green while twelve of
      // these sat in the admin panel, because none of them calls toFixed.
      // Any closing brace followed by the glyph: catches both `{{ x }} €` and
      // the `${x} €` inside a template literal, which the narrower form missed
      // on a shipping line that read "12.90 €" to every customer.
      const suffixed = /\}\s*[€%]/.test(line)
      if (!/toFixed\(2\)/.test(line) && !suffixed) return
      if (isSuppressed(lines, i, rule, rel)) return
      bad++
      const why = suffixed ? 'a wire value with a currency glyph appended' : 'raw toFixed on a price'
      fail(rule, rel, i + 1, `${why}: ${line.trim().slice(0, 90)}`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 2b2. Every internal link points at a page that exists ────────────────────
// The confirmation page sent every customer who completed an order to
// /compte/commandes. The folder is /compte/orders. It rendered, it looked
// right, and it 404'd for everyone — a dead end at the end of the happy path.
// Only literal arguments are checked; a template literal is a runtime value.
{
  const rule = 'Internal links point at pages that exist'
  const pagesDir = join(ROOT, 'app', 'pages')
  let bad = 0
  if (existsSync(pagesDir)) {
    const known = new Set()
    for (const file of walk(pagesDir, ['.vue'])) {
      const rel = relative(pagesDir, file).split('\\').join('/').replace(/\.vue$/, '')
      // index.vue is its folder; [param].vue matches anything, so its parent is
      // recorded and the segment itself is not compared literally.
      known.add('/' + rel.replace(/\/index$/, '').replace(/^index$/, ''))
    }
    for (const file of FILES) {
      const rel = relative(ROOT, file).split('\\').join('/')
      if (!rel.startsWith('app/')) continue
      const lines = readFileSync(file, 'utf8').split('\n')
      lines.forEach((line, i) => {
        for (const m of line.matchAll(/localePath\(\s*'(\/[^']*)'\s*\)/g)) {
          const path = m[1].replace(/\/$/, '') || '/'
          if (path === '/' || known.has(path)) continue
          // A concrete path may be served by a dynamic segment — /produits/x by
          // produits/[slug].vue — but only at the SAME depth, and only where
          // every other segment matches literally. Matching on "some page under
          // this parent is dynamic" is what let /compte/commandes through on the
          // first attempt: /compte/orders/[orderNumber] made the whole of
          // /compte/ look dynamic, and the rule reported green on the very
          // defect it was written for.
          const segments = path.split('/').filter(Boolean)
          const servedByDynamic = [...known].some((candidate) => {
            const parts = candidate.split('/').filter(Boolean)
            if (parts.length !== segments.length) return false
            return parts.every((part, idx) => part === segments[idx] || part.startsWith('['))
          })
          if (servedByDynamic) continue
          if (isSuppressed(lines, i, rule, rel)) continue
          bad++
          fail(rule, rel, i + 1, `links to ${path}, which no page serves`)
        }
      })
    }
  }
  if (bad === 0) pass(rule)
}

// ── 2b3. Search and Merchant state the SAME product group id ─────────────────
// The feed emits it as item_group_id and the product page as
// inProductGroupWithID. Shortening the feed value to Google's 50-character
// limit without shortening the page's left them declaring two different groups
// for one model — Search and Merchant each grouping the colours their own way.
// Both must go through shared/product-group.ts, which is the only thing that
// keeps them equal.
{
  const rule = 'Search and Merchant agree on the product group id'
  let bad = 0
  const sites = [
    ['server/feeds/merchant.ts', 'item_group_id'],
    ['app/pages/produits/[slug].vue', 'inProductGroupWithID'],
  ]
  for (const [rel, attribute] of sites) {
    const file = join(ROOT, rel)
    if (!existsSync(file)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, i) => {
      if (!line.includes(attribute)) return
      // The declaration itself, not a comment mentioning it.
      if (/^\s*(\/\/|\*)/.test(line)) return
      if (line.includes('groupId(')) return
      if (isSuppressed(lines, i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, `${attribute} is set without groupId(), so it can drift from the other side`)
    })
  }
  if (bad === 0) pass(rule)
}

// ── 2c. Every layout offers a way to change language ─────────────────────────
// A layout that replaces SiteHeader inherits none of its controls. The admin
// shell did exactly that and shipped with no switcher, so the panel was
// reachable only by typing "/admin" — which under prefix_except_default IS the
// French route. Six translated locales, one of them ever visible.
{
  const rule = 'Every layout can change language'
  const dir = join(ROOT, 'app', 'layouts')
  let bad = 0
  if (existsSync(dir)) {
    for (const file of walk(dir, ['.vue'])) {
      const rel = relative(ROOT, file).split('\\').join('/')
      const text = readFileSync(file, 'utf8')
      if (/<SiteHeader|useSwitchLocalePath/.test(text)) continue
      bad++
      fail(rule, rel, null, 'renders neither <SiteHeader nor a useSwitchLocalePath switcher')
    }
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

// ── 9. A static file must not shadow an authored route ──────────────────────
// Nitro serves public/ before server/routes/. A public/robots.txt silently
// replaces the generated one, and the two drift with nothing to say which the
// world is reading.
{
  const rule = 'No static file shadows a server route'
  let bad = 0
  const routes = join(ROOT, 'server', 'routes')
  const publicDir = join(ROOT, 'public')
  if (existsSync(routes) && existsSync(publicDir)) {
    for (const file of walk(routes, ['.ts'])) {
      const name = relative(routes, file)
        .split('\\')
        .join('/')
        .replace(/\.(get|post)\.ts$/, '')
        .replace(/\.ts$/, '')
      if (existsSync(join(publicDir, name))) {
        bad++
        fail(rule, `public/${name}`, null, `shadows server/routes/${name} — the route never runs`)
      }
    }
  }
  if (bad === 0) pass(rule)
}

// ── 10. A script must not write columns the schema does not have ────────────
// backfill-inventory.mjs wrote `stock` and `reserved` long after the schema
// moved to `on_hand` and a separate reservations table. It would have failed on
// the one run that matters — the one before the shop opens.
{
  const rule = 'Scripts only write columns the schema declares'
  let bad = 0
  const schemaPath = join(ROOT, 'server', 'db', 'schema.ts')
  const scriptsDir = join(ROOT, 'scripts')
  if (existsSync(schemaPath) && existsSync(scriptsDir)) {
    const schema = readFileSync(schemaPath, 'utf8')
    // Every quoted snake_case name in the schema file. Deliberately loose: a
    // column can be declared through a shared helper (`timestamps.updatedAt`)
    // where a stricter pattern sees nothing and reports a column that exists.
    // A missed violation is a smaller failure than a rule nobody trusts.
    const columns = new Set([...schema.matchAll(/'([a-z][a-z0-9_]*)'/g)].map((m) => m[1]))
    for (const file of walk(scriptsDir, ['.mjs'])) {
      const rel = relative(ROOT, file).split('\\').join('/')
      const text = readFileSync(file, 'utf8')
      for (const m of text.matchAll(/INSERT INTO\s+(\w+)\s*\(([^)]+)\)/gi)) {
        for (const raw of m[2].split(',')) {
          const column = raw.trim()
          if (!column || columns.has(column)) continue
          bad++
          fail(rule, rel, null, `writes ${m[1]}.${column}, which the schema does not declare`)
        }
      }
    }
  }
  if (bad === 0) pass(rule)
}

// ── 15. The shop's own contact details come from one place ──────────────────
// shared/organisation.ts existed to be the single source, and ten pages
// hard-coded the phone and the email anyway — thirty-two literals. The
// Impressum a German customer reads could drift from the Organization data
// Google reads, which is the kind of mismatch that costs a Knowledge Panel.
// app/components/ContactLink.vue renders them, and isolates them for Arabic.
{
  const rule = 'Contact details render through ContactLink, not literals'
  let bad = 0
  const appDir = join(ROOT, 'app')
  const LITERAL = /(tel:\+?33\s*7\s*45|mailto:contact@vitesse-eco\.fr|wa\.me\/33745830049)/
  for (const file of walk(appDir, ['.vue'])) {
    const rel = relative(ROOT, file).split('\\').join('/')
    if (rel.endsWith('components/ContactLink.vue')) continue
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      // A label may still SAY wa.me/…; only a destination is a duplicate.
      if (!LITERAL.test(line) || /label="/.test(line)) return
      if (isSuppressed(lines, i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, 'hard-codes a contact detail that shared/organisation.ts owns')
    })
  }
  if (bad === 0) pass(rule)
}

// ── 16. A back arrow must point back in every language ──────────────────────
// Three pages drew "back" as a literal ← character. A character always points
// the same way; in Arabic, back is to the right, so the control pointed
// forward. Measured, not guessed: the same paragraph in a browser puts a
// leading "+" of a phone number after the digits under `dir="rtl"`.
{
  const rule = 'Directional arrows mirror with the page direction'
  let bad = 0
  const appDir = join(ROOT, 'app')
  for (const file of walk(appDir, ['.vue'])) {
    const rel = relative(ROOT, file).split('\\').join('/')
    const lines = readFileSync(file, 'utf8').split(/\r?\n/)
    lines.forEach((line, i) => {
      if (!/[←→]/.test(line)) return
      if (isSuppressed(lines, i, rule, rel)) return
      bad++
      fail(rule, rel, i + 1, 'draws direction as a character; use an icon with `rtl:rotate-180`')
    })
  }
  if (bad === 0) pass(rule)
}

console.log('')
if (failures > 0) {
  console.error(`❌ ${failures} invariant violation(s) across ${checks + 1} rules`)
  process.exit(1)
}
console.log(`✅ All ${checks} invariants hold`)
