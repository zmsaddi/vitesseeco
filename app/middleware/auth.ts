/**
 * Route guard for the account area.
 *
 * This is a convenience, not a control. It decides what to render; every route
 * behind it also enforces access on the server, because a guard that runs in
 * the browser can be skipped by anyone who cares to.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  const localePath = useLocalePath()

  const me = await $fetch<{ id: string } | null>('/api/auth/me').catch(() => null)
  if (me) return

  // Remember where they were going, so signing in continues the journey
  // rather than dropping them on a dashboard.
  return navigateTo({
    path: localePath('/connexion'),
    query: { next: to.fullPath },
  })
})
