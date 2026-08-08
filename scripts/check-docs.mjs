/**
 * Documentation that cannot lie — TEMPLATE.
 *
 * Prose rots faster than code and fails more quietly. Nothing breaks when a
 * README describes a directory that was renamed a year ago; it just costs every
 * newcomer an afternoon, and it teaches everyone to stop trusting the docs.
 *
 * This makes documentation checkable. It walks your markdown and asserts that
 * every path, command and environment variable mentioned actually exists.
 *
 *   node verify-docs.mjs
 *
 * Add it to CI next to your other gates. The first run on a real project is
 * usually humbling — one pass found a project document where seven of eight
 * spot-checked paths did not exist, describing a directory layout that had been
 * replaced entirely.
 *
 * ── The habit this enforces ──────────────────────────────────────────────
 * Write documentation AGAINST THE CODE, not from memory. Put counts and paths in
 * it deliberately, because a number that can be checked is a number that stays
 * true. The act of verifying while writing is itself the value: on one rewrite
 * it caught four false claims in a document being written to replace a false
 * document.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import process from 'node:process'

// ─── CONFIG ────────────────────────────────────────────────────────────────
const CONFIG = {
  /** Markdown to check. */
  docs: ['README.md', 'CLAUDE.md', 'CONTRIBUTING.md', 'docs'],

  /** Where an environment example file lives, if you have one. */
  envExample: '.env.example',

  /** Directories whose files code may read env vars from. */
  sourceDirs: ['src', 'app', 'server', 'shared', 'scripts', 'lib'],

  /** package.json — script names in docs are checked against it. */
  manifest: 'package.json',

  /**
   * Paths mentioned in prose that are illustrative, not real.
   *
   * A leading slash means a URL route, not a file on disk — without that entry
   * this gate reported every documented endpoint as a missing file, which is
   * exactly how a check earns its way into somebody's ignore list.
   */
  allowMissingPaths: [/^https?:/, /^#/, /^mailto:/, /^\//, /\.\.\./, /<[^>]+>/, /\{|\}/, /\*/],

  /**
   * Headings under which missing paths are the POINT: a changelog, a list of
   * removed files, an architecture decision that records what used to exist.
   * Everything until the next heading of the same or higher level is skipped.
   */
  historicalHeadings: /retired|removed|deleted|superseded|historical|changelog|previously/i,

  /**
   * Names a framework injects rather than your code reading them directly.
   * Nuxt maps NUXT_PUBLIC_FOO onto runtimeConfig.public.foo, Vite exposes
   * VITE_*, Next NEXT_PUBLIC_* — grep for `process.env` will never find them, so
   * without this the gate declares every one of them undocumented-but-required
   * or documented-but-unused, depending on which way it is looking.
   */
  frameworkInjected: [/^NUXT_/, /^VITE_/, /^NEXT_PUBLIC_/, /^REACT_APP_/, /^PUBLIC_/],
}
// ───────────────────────────────────────────────────────────────────────────

const ROOT = process.cwd()
const problems = []
const note = (file, detail) => problems.push({ file, detail })

function markdownFiles(target, out = []) {
  const full = join(ROOT, target)
  if (!existsSync(full)) return out
  if (statSync(full).isFile()) {
    if (full.endsWith('.md')) out.push(full)
    return out
  }
  for (const name of readdirSync(full)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    markdownFiles(join(target, name), out)
  }
  return out
}

const files = CONFIG.docs.flatMap((d) => markdownFiles(d))
if (files.length === 0) {
  console.error('❌ No markdown found. Fix CONFIG.docs — a check with nothing to check is not passing.')
  process.exit(1)
}

// ─── 1. every relative link and code-fenced path exists ────────────────────
/**
 * Blank out the sections where a missing path is the subject rather than a
 * mistake, and any line the author marked with `verify-docs-ok`. Blanked rather
 * than removed so reported line numbers stay honest.
 */
function withoutHistory(text) {
  // A whole document can be a record of the past — an architecture decision, a
  // post-mortem, a migration note. `<!-- verify-docs: historical -->` anywhere
  // in it exempts every path, which is more honest than annotating each line and
  // pretending they are individually special.
  if (/<!--\s*verify-docs:\s*historical\s*-->/.test(text)) return ''
  const lines = text.split('\n')
  let skipDepth = 0
  return lines
    .map((line) => {
      const heading = line.match(/^(#{1,6})\s+(.*)$/)
      if (heading) {
        const depth = heading[1].length
        if (skipDepth && depth <= skipDepth) skipDepth = 0
        if (!skipDepth && CONFIG.historicalHeadings.test(heading[2])) skipDepth = depth
      }
      if (skipDepth) return ''
      return line.includes('verify-docs-ok') ? '' : line
    })
    .join('\n')
}

for (const file of files) {
  const rel = relative(ROOT, file).split(sep).join('/')
  const text = withoutHistory(readFileSync(file, 'utf8'))
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : ''

  // Markdown links: [label](target)
  for (const m of text.matchAll(/\[[^\]]*\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0]
    if (!target || CONFIG.allowMissingPaths.some((p) => p.test(target))) continue
    const resolved = target.startsWith('/')
      ? join(ROOT, target.slice(1))
      : join(ROOT, dir, target)
    if (!existsSync(resolved)) note(rel, `link points at a path that does not exist: ${target}`)
  }

  // Inline code that looks like a repository path: `server/api/thing.ts`
  for (const m of text.matchAll(/`([a-zA-Z0-9_./-]+\/[a-zA-Z0-9_./-]+\.[a-z]{2,5})`/g)) {
    const target = m[1]
    if (CONFIG.allowMissingPaths.some((p) => p.test(target))) continue
    if (!existsSync(join(ROOT, target))) note(rel, `mentions a file that does not exist: ${target}`)
  }
}

// ─── 2. every documented npm script exists ─────────────────────────────────
if (existsSync(join(ROOT, CONFIG.manifest))) {
  const scripts = JSON.parse(readFileSync(join(ROOT, CONFIG.manifest), 'utf8')).scripts ?? {}
  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join('/')
    const text = readFileSync(file, 'utf8')
    for (const m of text.matchAll(/\b(?:npm run|yarn|pnpm run) ([a-z0-9:_-]+)/g)) {
      if (!scripts[m[1]]) note(rel, `documents a script that does not exist: ${m[1]}`)
    }
  }
}

// ─── 3. env example and code agree, in BOTH directions ─────────────────────
/**
 * The asymmetry matters. A variable the example advertises but no code reads
 * sends whoever deploys you hunting for credentials they do not need — one real
 * example file listed keys for three payment providers and an email service that
 * no code on that branch touched. A variable code reads but the example omits is
 * worse: the deployment simply does not work, and nothing says why.
 */
if (existsSync(join(ROOT, CONFIG.envExample))) {
  // A commented-out line documents something OPTIONAL or not yet wired. It is a
  // note to the reader, not a promise the code keeps — so it counts as declared
  // (the code may legitimately read it) but is never reported as unused.
  const declared = new Set()
  const optional = new Set()
  for (const line of readFileSync(join(ROOT, CONFIG.envExample), 'utf8').split('\n')) {
    const m = line.match(/^(#?)\s*([A-Z][A-Z0-9_]+)=/)
    if (!m) continue
    declared.add(m[2])
    if (m[1]) optional.add(m[2])
  }

  const read = new Set()
  const walk = (dir) => {
    const full = join(ROOT, dir)
    if (!existsSync(full)) return
    for (const name of readdirSync(full)) {
      if (name === 'node_modules') continue
      const p = join(full, name)
      if (statSync(p).isDirectory()) walk(join(dir, name))
      else if (/\.(ts|js|mjs|vue|py|go|rb)$/.test(name)) {
        const src = readFileSync(p, 'utf8')
        for (const m of src.matchAll(/(?:process\.env|import\.meta\.env|os\.environ)[.[]\s*['"]?([A-Z][A-Z0-9_]+)/g)) {
          read.add(m[1])
        }
      }
    }
  }
  CONFIG.sourceDirs.forEach(walk)

  // Root-level config files only, NOT a recursive walk of the repository root:
  // that pulls in the build output and vendored code, and reports their internal
  // variables as ones you forgot to document. Noise like that is how a gate dies.
  for (const name of readdirSync(ROOT)) {
    if (!/^[a-z.]+\.config\.(ts|js|mjs)$/.test(name)) continue
    for (const m of readFileSync(join(ROOT, name), 'utf8')
      .matchAll(/(?:process\.env|import\.meta\.env)[.[]\s*['"]?([A-Z][A-Z0-9_]+)/g)) {
      read.add(m[1])
    }
  }

  // Variables the platform sets, which no example file should ever list.
  const AMBIENT = /^(NODE_ENV|CI|PORT|HOST|VERCEL|VERCEL_[A-Z_]+|NETLIFY|AWS_[A-Z_]+|npm_[a-z_]+)$/
  for (const name of [...read]) if (AMBIENT.test(name)) read.delete(name)

  for (const name of read) {
    if (!declared.has(name)) note(CONFIG.envExample, `code reads ${name}, the example never mentions it`)
  }
  for (const name of declared) {
    if (read.has(name) || optional.has(name)) continue
    if (CONFIG.frameworkInjected.some((p) => p.test(name))) continue
    note(CONFIG.envExample, `advertises ${name}, which no code reads`)
  }
}

// ─── 4. counted claims are counted, not remembered ─────────────────────────
/*
 * A path that disappears is caught above. A COUNT that drifts is not, and it
 * drifts silently: CLAUDE.md claimed 754 locale keys against 789, 144 products
 * against 146, 34 API routes against 35, 276 unit tests against 306. Every one
 * had been true when written.
 *
 * A number nobody can check is a number nobody should write. Each claim below
 * is a pattern with a capture group and a function that produces the real
 * figure from the filesystem — never from the network, so this stays a build
 * gate rather than a thing that fails when Sanity is slow.
 *
 * Adding a countable number to a document means adding it here too. That is
 * the cost, and it is the point.
 */
{
  const count = (dir, filter) => {
    const out = []
    const walk = (d) => {
      const full = join(ROOT, d)
      if (!existsSync(full)) return
      for (const name of readdirSync(full)) {
        if (name === 'node_modules' || name.startsWith('.')) continue
        const p = join(d, name)
        if (statSync(join(ROOT, p)).isDirectory()) walk(p)
        else if (filter(name, p)) out.push(p)
      }
    }
    walk(dir)
    return out.length
  }

  const localeKeys = () => {
    const file = join(ROOT, 'i18n', 'locales', 'fr.json')
    if (!existsSync(file)) return null
    const deep = (o) => Object.values(o).reduce((n, v) => n + (v && typeof v === 'object' ? deep(v) : 1), 0)
    return deep(JSON.parse(readFileSync(file, 'utf8')))
  }

  const vue = (n) => n.endsWith('.vue')
  const spec = (n) => n.endsWith('.spec.ts')

  /*
   * Each claim names the file that OWNS it. Scoping matters: an early version
   * matched "19 pages × 6 locales" — the simulator's route sweep — against the
   * number of .vue files, and "766 keys" inside an archived document against
   * today's locale file. A rule that reports things that are not wrong is a
   * rule that gets switched off.
   */
  const CLAIMS = [
    ['CLAUDE.md', /(\d+) keys × 6/, localeKeys, 'locale keys'],
    ['CLAUDE.md', /(\d+) pages, incl/, () => count('app/pages', vue), 'pages under app/pages'],
    ['CLAUDE.md', /(\d+) routes\. Every one declares/, () => count('server/api', (n) => n.endsWith('.ts')), 'routes under server/api'],
    ['CLAUDE.md', /(\d+) machine files/, () => count('server/routes', () => true), 'files under server/routes'],
    ['CLAUDE.md', /unit\/ \((\d+) files\)/, () => count('tests/unit', spec), 'unit spec files'],
    ['CLAUDE.md', /integration\/ \((\d+) suites/, () => count('tests/integration', spec), 'integration spec files'],
    ['docs/architecture/CURRENT.md', /(\d+) pages · \d+ components/, () => count('app/pages', vue), 'pages under app/pages'],
    ['docs/architecture/CURRENT.md', /\d+ pages · (\d+) components/, () => count('app/components', vue), 'components'],
    ['docs/architecture/CURRENT.md', /(\d+) composables/, () => count('app/composables', (n) => n.endsWith('.ts')), 'composables'],
    ['docs/architecture/CURRENT.md', /(\d+) routes, each declaring/, () => count('server/api', (n) => n.endsWith('.ts')), 'routes under server/api'],
    ['docs/architecture/CURRENT.md', /(\d+) machine files/, () => count('server/routes', () => true), 'files under server/routes'],
    ['docs/architecture/CURRENT.md', /(\d+) unit files/, () => count('tests/unit', spec), 'unit spec files'],
    ['docs/architecture/CURRENT.md', /(\d+) integration files/, () => count('tests/integration', spec), 'integration spec files'],
    ['docs/architecture/CURRENT.md', /(\d+) browser gates/, () => count('tests/e2e', (n) => n.endsWith('.mjs')), 'browser gates'],
    ['docs/architecture/CURRENT.md', /(\d+) gate and tooling scripts/, () => count('scripts', (n) => n.endsWith('.mjs')), 'scripts'],
    ['docs/architecture/CURRENT.md', /(\d+) migration file/, () => count('server/db/migrations', (n) => n.endsWith('.sql')), 'migration files'],
  ]

  for (const [owner, pattern, actual, what] of CLAIMS) {
    const path = join(ROOT, owner)
    if (!existsSync(path)) continue
    const match = pattern.exec(withoutHistory(readFileSync(path, 'utf8')))
    if (!match) {
      note(owner, `no longer states its ${what}; the claim this gate checks was removed or reworded`)
      continue
    }
    const real = actual()
    if (real === null || Number(match[1]) === real) continue
    note(owner, `claims ${match[1]} ${what}; there are ${real}`)
  }
}

// ─── report ────────────────────────────────────────────────────────────────
if (problems.length === 0) {
  console.log(`✅ Documentation matches the code (${files.length} file(s) checked)\n`)
  process.exit(0)
}

console.error(`\n❌ ${problems.length} documentation problem(s)\n`)
const byFile = new Map()
for (const p of problems) byFile.set(p.file, [...(byFile.get(p.file) ?? []), p.detail])
for (const [file, list] of byFile) {
  console.error(`  ${file} (${list.length})`)
  for (const d of list.slice(0, 15)) console.error(`     ${d}`)
  if (list.length > 15) console.error(`     … and ${list.length - 15} more`)
}
console.error('\nThe document is the bug. Fix it in the same commit as the code.\n')
process.exit(1)
