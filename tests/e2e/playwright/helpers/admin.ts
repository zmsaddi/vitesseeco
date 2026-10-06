/**
 * An administrator's session, for the specs that drive the admin panel.
 *
 * The rig starts from an empty customers table, and an admin page needs more
 * than a login: the address must be on ADMIN_EMAILS (the rig's environment sets
 * the one below) and VERIFIED. Verification is a link in an email the rig never
 * sends, so the address is marked verified in the rig's own database — the same
 * step the money gate takes, behind the same loopback rule as the seed.
 *
 * One login per spec file, not per test: credential routes allow eight calls a
 * quarter of an hour per address, and the whole suite runs from one.
 */
import { request, type Cookie } from '@playwright/test'
import pg from 'pg'
import { isLoopbackUrl } from '../../../../shared/loopback-url.mjs'

export const ADMIN_EMAIL = 'sim-admin@vitesse-eco.test'
const PASSWORD = 'Simulation-2026!x'
/** Turnstile's always-pass test pair accepts any token; this is the one the other gates send. */
const CAPTCHA = 'sim.DUMMY.TOKEN'

export async function adminCookies(baseURL: string): Promise<Cookie[]> {
  const database = process.env.DATABASE_URL
  if (!database || !isLoopbackUrl(database)) {
    throw new Error(
      'The admin specs need DATABASE_URL: the loopback database the candidate server was started ' +
        'with, to mark the administrator verified. See docs/testing/BROWSER_GATES.md.'
    )
  }

  const api = await request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } })
  try {
    const login = await api.post('/api/auth/login', { data: { email: ADMIN_EMAIL, password: PASSWORD, captchaToken: CAPTCHA } })
    if (!login.ok()) {
      // A fresh rig: the account does not exist yet. Registering signs it in.
      const registered = await api.post('/api/auth/register', {
        data: { email: ADMIN_EMAIL, password: PASSWORD, firstName: 'Sim', lastName: 'Admin', captchaToken: CAPTCHA, locale: 'fr' },
      })
      if (!registered.ok()) {
        throw new Error(`neither login (${login.status()}) nor registration (${registered.status()}) gave an admin session`)
      }
    }

    const client = new pg.Client({ connectionString: database })
    await client.connect()
    try {
      await client.query(`UPDATE customers SET email_verified_at = COALESCE(email_verified_at, now()) WHERE email = $1`, [ADMIN_EMAIL])
    } finally {
      await client.end()
    }

    return (await api.storageState()).cookies
  } finally {
    await api.dispose()
  }
}
