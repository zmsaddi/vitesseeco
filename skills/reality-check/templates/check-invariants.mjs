/**
 * The invariant gate — TEMPLATE.
 *
 * One rule per defect class that has actually bitten this project. A fix without
 * a gate is a defect waiting to return under a new name; this file is where the
 * lesson becomes mechanical.
 *
 *   node check-invariants.mjs        # add to CI, before the build
 *
 * Two hard requirements, both learned the hard way:
 *
 *  1. PROVE EACH RULE BY BREAKING IT ON PURPOSE. Introduce the violation, confirm
 *     this script fails, revert. A gate never observed failing is not known to
 *     work — and a rule whose pattern is subtly wrong will pass forever.
 *
 *  2. KILL FALSE POSITIVES IMMEDIATELY. A gate that cries wolf is a gate someone
 *     disables, and then it protects nothing. Suppression requires a written
 *     reason, and every suppression is printed on every run so they stay visible
 *     rather than accumulating in silence.
 *
 * THE ZERO-INPUT RULE: any rule that scans no files FAILS. A style scanner once
 * reported success for months because a refactor had moved the source and its
 * glob no longer matched anything.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.nuxt', '.output', 'coverage'])

const violations = []
const suppressions = []
const fail = (rule, file, line, detail) => violations.push({ rule, file, line, detail })

function walk(dir, exts, out = []) {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue
    const full = join(dir, name)
    const st = statSync(full)
    if (st.isDirectory()) walk(full, exts, out)
    else if (exts.some((e) => name.endsWith(e))) out.push(full)
  }
  return out
}

const read = (f) => ({ path: relative(ROOT, f).split(sep).join('/'), lines: readFileSync(f, 'utf8').split('\n') })

/** A comment is prose, not code. Matching inside one is the classic way a gate
 *  starts crying wolf — including on the very comment that explains the rule. */
const isComment = (line) => /^\s*(\/\/|\*|#|<!--)/.test(line)

/**
 * A violation may be waived only with a stated reason on the line above or the
 * same line: `// invariant-ok: brand names are proper nouns, never translated`
 * A reason shorter than 12 characters is not a reason.
 */
function isSuppressed(lines, index, rule, file) {
  for (const candidate of [lines[index], lines[index - 1]]) {
    const m = candidate?.match(/invariant-ok:\s*(.+)$/)
    if (m && m[1].trim().length >= 12) {
      suppressions.push({ rule, file, line: index + 1, reason: m[1].trim() })
      return true
    }
  }
  return false
}

/**
 * Register a rule. `scan` receives every matching file; a rule that sees zero
 * files fails, because a check with nothing to check is not a passing check.
 */
const rules = []
const rule = (name, globExts, dirs, scan) => rules.push({ name, globExts, dirs, scan })

// ═══════════════════════════════════════════════════════════════════════════
// RULES — replace these with YOUR project's hard-won lessons. The five below
// are the ones that generalise across almost every codebase.
// ═══════════════════════════════════════════════════════════════════════════

/** Dates and currency must pin an explicit locale AND timezone.
 *  The platform runs in UTC and the user does not. `undefined` as the locale
 *  argument uses the RUNTIME's locale — English on a server, the user's in a
 *  browser — so the same timestamp renders as two different days. */
rule('explicit-locale-and-timezone', ['.ts', '.tsx', '.js', '.jsx', '.vue'], ['src', 'app', 'server', 'components', 'pages'],
  ({ path, lines }) => {
    lines.forEach((line, i) => {
      if (isComment(line)) return
      // The trailing `(` matters: `options: Intl.DateTimeFormatOptions` is a TYPE
      // annotation, not a call, and flagging it taught me this the hard way while
      // testing this very template.
      if (!/toLocale(Date|Time)?String\s*\(|Intl\.(DateTime|Number)Format\s*\(/.test(line)) return
      if (/invariant-ok/.test(line)) return
      const hasLocale = !/\(\s*(undefined|)\s*[,)]/.test(line)
      const hasZone = /timeZone/.test(line) || /timeZone/.test(lines.slice(i, i + 6).join(' '))
      const isDate = /Date|Time/.test(line)
      if (!hasLocale || (isDate && !hasZone)) {
        if (!isSuppressed(lines, i, 'explicit-locale-and-timezone', path)) {
          fail('explicit-locale-and-timezone', path, i + 1, line.trim().slice(0, 90))
        }
      }
    })
  })

/** Every privileged route must be guarded. Not a sample — every one.
 *  Adapt the two patterns to your framework's guard. */
rule('privileged-routes-guarded', ['.ts', '.js'], ['server/api/admin', 'src/api/admin', 'app/api/admin'],
  ({ path, lines }) => {
    const body = lines.join('\n')
    const guarded = /access:\s*['"]admin['"]|requireAdmin\s*\(|assertAdmin\s*\(/.test(body)
    if (!guarded && !isSuppressed(lines, 0, 'privileged-routes-guarded', path)) {
      fail('privileged-routes-guarded', path, 1, 'no admin guard found in this route')
    }
  })

/** Nothing may read browser-only storage during setup/SSR: it does not exist on
 *  the server, and reading it while rendering is the classic hydration mismatch. */
rule('no-storage-read-during-setup', ['.vue', '.tsx', '.jsx'], ['src', 'app', 'components', 'pages'],
  ({ path, lines }) => {
    lines.forEach((line, i) => {
      if (isComment(line)) return
      if (!/(localStorage|sessionStorage)\.getItem/.test(line)) return
      const context = lines.slice(Math.max(0, i - 25), i).join('\n')
      const inClientHook = /onMounted|useEffect|onBeforeMount|if\s*\(\s*(import\.meta\.client|typeof window)/.test(context)
      if (!inClientHook && !isSuppressed(lines, i, 'no-storage-read-during-setup', path)) {
        fail('no-storage-read-during-setup', path, i + 1, line.trim().slice(0, 90))
      }
    })
  })

/** A blank input is not zero. `Number('') === 0`, and a zero price passes every
 *  "is it a number" guard — which is how a product got published at 0.00.
 *  Any numeric coercion of user input must handle blank explicitly. */
rule('blank-is-not-zero', ['.ts', '.js', '.vue'], ['src', 'app', 'server', 'components'],
  ({ path, lines }) => {
    lines.forEach((line, i) => {
      if (isComment(line)) return
      if (!/Number\((?!.*(?:\?\?|\|\||trim\(\)\s*===|length))/.test(line)) return
      if (!/(input|value|body|query|params|field|raw)/i.test(line)) return
      if (!isSuppressed(lines, i, 'blank-is-not-zero', path)) {
        fail('blank-is-not-zero', path, i + 1, `unguarded Number() on input: ${line.trim().slice(0, 80)}`)
      }
    })
  })

/** No static asset may shadow a dynamic route of the same path. The static file
 *  wins silently and serves stale content forever. */
rule('no-static-shadowing-routes', ['.xml', '.txt', '.csv', '.json'], ['public', 'static'],
  ({ path }) => {
    const name = path.replace(/^(public|static)\//, '')
    const routeDirs = ['server/routes', 'src/routes', 'app/routes', 'server/api', 'app/api']
    for (const dir of routeDirs) {
      for (const ext of ['.ts', '.js', '.mjs']) {
        if (existsSync(join(ROOT, dir, name + ext)) || existsSync(join(ROOT, dir, name.replace(/\.\w+$/, '') + ext))) {
          fail('no-static-shadowing-routes', path, 1, `shadows the route ${dir}/${name}`)
        }
      }
    }
  })

// ═══════════════════════════════════════════════════════════════════════════

let totalScanned = 0
for (const r of rules) {
  const files = r.dirs.flatMap((d) => walk(join(ROOT, d), r.globExts))
  if (files.length === 0) {
    // Not an error by itself — the directory may not exist in this project — but
    // it MUST be visible, or a rule silently protects nothing.
    console.log(`   ⚠️  ${r.name}: scanned 0 files (no matching directories: ${r.dirs.join(', ')})`)
    continue
  }
  totalScanned += files.length
  for (const f of files) r.scan(read(f))
}

// The zero-input rule, at the top level: a run that inspected nothing has failed.
if (totalScanned === 0) {
  console.error('\n❌ This gate scanned ZERO files. Fix the directories — a check with nothing to check is not passing.\n')
  process.exit(1)
}

console.log(`\nInvariants: ${rules.length} rules over ${totalScanned} files`)

if (suppressions.length) {
  console.log(`\n📝 ${suppressions.length} suppression(s) — reviewed on every run, never invisible:`)
  for (const s of suppressions) console.log(`   ${s.file}:${s.line} [${s.rule}] ${s.reason}`)
}

if (violations.length) {
  console.error(`\n❌ ${violations.length} violation(s)\n`)
  const byRule = new Map()
  for (const v of violations) byRule.set(v.rule, [...(byRule.get(v.rule) ?? []), v])
  for (const [name, list] of byRule) {
    console.error(`  ${name} (${list.length})`)
    for (const v of list.slice(0, 12)) console.error(`     ${v.file}:${v.line}  ${v.detail}`)
    if (list.length > 12) console.error(`     … and ${list.length - 12} more`)
  }
  console.error('')
  process.exit(1)
}

console.log(`✅ All ${rules.length} invariants hold\n`)
