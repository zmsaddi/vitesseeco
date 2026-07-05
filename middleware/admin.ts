/**
 * Admin route guard — UX only. The real security boundary is requireAdmin()
 * inside every /api/admin/* endpoint; this middleware just redirects
 * non-admins away from the panel before it renders.
 */
export default defineNuxtRouteMiddleware(async () => {
  // On server, only verify a session cookie exists (same pattern as auth.ts);
  // the admin probe runs client-side after hydration.
  if (import.meta.server) {
    const token = useCookie('auth_token')
    if (!token.value) return navigateTo('/connexion')
    return
  }

  try {
    await $fetch('/api/admin/me')
  } catch (e: any) {
    const status = e?.status || e?.statusCode
    return navigateTo(status === 401 ? '/connexion' : '/')
  }
})
