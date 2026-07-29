import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { STATIC_PATHS } from '../../server/routes/sitemap.xml.get'

/**
 * A sitemap that lists a page the app does not serve submits a soft 404 to
 * Google, and Google counts soft 404s against the whole site. The list had
 * drifted six pages ahead of the app — this makes that impossible to repeat,
 * because the only way to add a URL here is to have the page.
 */
describe('the sitemap only advertises pages that exist', () => {
  const pageExists = (path: string): boolean => {
    const base = join(process.cwd(), 'app', 'pages')
    const clean = path === '/' ? 'index' : path.replace(/^\//, '')
    return existsSync(join(base, `${clean}.vue`)) || existsSync(join(base, clean, 'index.vue'))
  }

  it.each(STATIC_PATHS.map((entry) => entry.path))('serves %s', (path) => {
    expect(pageExists(path)).toBe(true)
  })

  it('has no duplicate paths', () => {
    const paths = STATIC_PATHS.map((entry) => entry.path)
    expect(new Set(paths).size).toBe(paths.length)
  })
})
