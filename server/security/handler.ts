/**
 * The route wrapper.
 *
 * Every API route is declared through `defineRoute`, which is what makes the
 * security rules structural rather than advisory. A handler cannot forget to
 * validate its body, check CSRF, apply a rate limit or guard an admin route,
 * because it never gets the chance to: the wrapper does those things before the
 * handler runs, and the handler receives already-validated input.
 *
 * The previous build asked each route to opt in. Thirty-eight defects later,
 * the lesson is that opt-in security is a list of the routes someone remembered.
 */
import { createError, defineEventHandler, getQuery, getRequestHost, readBody, type H3Event } from 'h3'
import type { ZodType, z } from 'zod'
import { AppError, ERROR_CODES, toAppError } from '../../shared/errors'
import { isLocaleCode, type LocaleCode } from '../../shared/locales'
import { resolveMarket, type MarketDefinition } from '../../shared/markets'
import { applyApiHeaders } from './headers'
import { assertSameOrigin, routeKey } from './request'
import { enforceRateLimit, type RateLimitPreset } from './rateLimit'
import { requireCustomer, resolveSession, type AuthenticatedCustomer } from './session'

export type AccessLevel = 'public' | 'customer' | 'admin'

export interface RouteContext<TBody, TQuery> {
  event: H3Event
  body: TBody
  query: TQuery
  /** Present for `customer` and `admin` routes; null only when access is public. */
  customer: AuthenticatedCustomer | null
  /**
   * Whose price list applies to this request.
   *
   * Computed here from the host and the locale that was just validated, so no
   * route can accept a market as its own input. That matters: a market read from
   * the body would let the page and the basket disagree about what something
   * costs. See shared/markets.ts.
   */
  market: MarketDefinition
}

export interface RouteDefinition<TBody, TQuery> {
  /**
   * Who may call this. There is no default: every route states it, so a new
   * route cannot be accidentally public.
   */
  access: AccessLevel
  rateLimit: RateLimitPreset
  /** Schema for the request body. Omit for routes that take none. */
  body?: ZodType<TBody>
  /** Schema for the query string. Omit for routes that take none. */
  query?: ZodType<TQuery>
  handler: (context: RouteContext<TBody, TQuery>) => Promise<unknown> | unknown
}

/** Admin allowlist, resolved per request so a change does not need a redeploy. */
function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )
}

/**
 * Whether an address is on the allowlist.
 *
 * Exported so the session endpoint can tell its own owner that the panel exists
 * without duplicating the comparison. It answers a question about the caller's
 * own identity only — never use it to decide what to render for someone else.
 */
export function isAdminEmail(email: string): boolean {
  const allowlist = adminEmails()
  return allowlist.size > 0 && allowlist.has(email.toLowerCase())
}

async function requireAdmin(event: H3Event): Promise<AuthenticatedCustomer> {
  const customer = await requireCustomer(event)

  // An empty allowlist means nobody is an admin. Failing closed is the point:
  // a missing environment variable must not open the panel to every customer.
  if (!isAdminEmail(customer.email)) {
    throw new AppError(ERROR_CODES.FORBIDDEN, {
      internal: `${customer.email} attempted admin route ${routeKey(event)}`,
    })
  }
  return customer
}

/** The locale a validated payload carries, if it carries one. */
function localeIn(payload: unknown): LocaleCode | undefined {
  const value = (payload as { locale?: unknown } | undefined)?.locale
  return isLocaleCode(value) ? value : undefined
}

function formatIssues(error: z.ZodError): Array<{ path: string; message: string }> {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }))
}

export function defineRoute<TBody = undefined, TQuery = undefined>(
  definition: RouteDefinition<TBody, TQuery>
) {
  return defineEventHandler(async (event: H3Event) => {
    applyApiHeaders(event)

    try {
      // 1. Cross-site state changes never reach a handler.
      assertSameOrigin(event)

      // 2. Identity before rate limiting, so an authenticated caller can be
      //    given a per-account budget rather than sharing one with a whole NAT.
      let customer: AuthenticatedCustomer | null = null
      if (definition.access === 'admin') {
        customer = await requireAdmin(event)
      } else if (definition.access === 'customer') {
        customer = await requireCustomer(event)
      } else {
        customer = await resolveSession(event)
      }

      // 3. Budget.
      await enforceRateLimit(event, definition.rateLimit, {
        subject: customer?.id,
      })

      // 4. Input. Parsed, not merely checked — the handler receives the parsed
      //    value, so it cannot accidentally use the raw one.
      let body = undefined as TBody
      if (definition.body) {
        const raw = await readBody(event).catch(() => undefined)
        const parsed = definition.body.safeParse(raw)
        if (!parsed.success) {
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
            details: { issues: formatIssues(parsed.error) },
            internal: `body validation failed for ${routeKey(event)}`,
          })
        }
        body = parsed.data
      }

      let query = undefined as TQuery
      if (definition.query) {
        const parsed = definition.query.safeParse(getQuery(event))
        if (!parsed.success) {
          throw new AppError(ERROR_CODES.VALIDATION_FAILED, {
            details: { issues: formatIssues(parsed.error) },
            internal: `query validation failed for ${routeKey(event)}`,
          })
        }
        query = parsed.data
      }

      // 5. Market. Derived, never declared — the locale the caller already sent
      //    is the only thing it depends on, so quoting and charging cannot drift.
      const market = resolveMarket({
        host: getRequestHost(event),
        locale: localeIn(query) ?? localeIn(body),
      })

      return await definition.handler({ event, body, query, customer, market })
    } catch (error) {
      throw respond(event, error)
    }
  })
}

/**
 * Turn anything thrown into an HTTP response.
 *
 * The browser receives a stable code and an i18n key. It never receives an
 * internal message, a stack, or a database error string — those go to the log,
 * which is where they are useful and where they are not a disclosure.
 */
function respond(event: H3Event, error: unknown) {
  const appError = toAppError(error)

  if (appError.status >= 500) {
    console.error(`[${appError.code}] ${routeKey(event)}`, appError.internal ?? appError.message, appError.cause ?? '')
  } else if (appError.status === 403 || appError.status === 429) {
    // Worth seeing in aggregate: these are the shapes an attack makes.
    console.warn(`[${appError.code}] ${routeKey(event)} ${appError.internal ?? ''}`)
  }

  return createError({
    statusCode: appError.status,
    statusMessage: appError.code,
    data: appError.toPublic(),
  })
}
