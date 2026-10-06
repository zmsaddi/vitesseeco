/**
 * Route guard for the account area.
 *
 * This is a convenience, not a control. It decides what to render; every route
 * behind it also enforces access on the server, because a guard that runs in
 * the browser can be skipped by anyone who cares to.
 *
 * The probe uses `useRequestFetch`, and that distinction is the whole point of
 * this file. During server rendering the global `$fetch` carries no cookies, so
 * the session endpoint answers "guest" for a signed-in owner and this guard
 * sends them to the login page — on every direct load, every refresh, every
 * bookmark and every new tab. It would have made the admin panel unreachable in
 * production while looking perfect locally, because dev renders as an SPA and
 * the probe only ever runs in a browser there.
 */
export default defineNuxtRouteMiddleware(async (to, from) => {
  // A new query or hash on the page already shown is not a new page to guard.
  // Probing the session then cost a round trip on every such step — and the
  // invoice page adds one the moment it hands the device to a customer, when
  // the delay is a window in which the back gesture can still leave the page.
  if (import.meta.client && to.path === from.path) return

  const localePath = useLocalePath()
  const request = useRequestFetch()

  let me: { id: string } | null
  try {
    me = await request<{ id: string } | null>('/api/auth/me')
  } catch (error: unknown) {
    // Failing to ask who this is is not being told they are a guest. Every
    // failure used to read as "signed out": a database blip answered 503, and
    // each signed-in customer was sent to the login form — session intact — to
    // sign in again into the same outage. The error page says what happened
    // instead, with the status the server gave; no answer at all (the network)
    // is an outage too. Fatal, because a navigation inside the browser would
    // otherwise only be cancelled, leaving the customer on the page they were
    // leaving with nothing said.
    const statusCode = (error as { statusCode?: number })?.statusCode ?? 503
    return abortNavigation(createError({ statusCode, statusMessage: 'Session check failed', fatal: true }))
  }
  if (me) return

  // Remember where they were going, so signing in continues the journey
  // rather than dropping them on a dashboard.
  return navigateTo({
    path: localePath('/connexion'),
    query: { next: to.fullPath },
  })
})
