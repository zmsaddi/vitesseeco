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
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()
  const request = useRequestFetch()

  const me = await request<{ id: string } | null>('/api/auth/me').catch(() => null)
  if (me) return

  // Remember where they were going, so signing in continues the journey
  // rather than dropping them on a dashboard.
  return navigateTo({
    path: localePath('/connexion'),
    query: { next: to.fullPath },
  })
})
