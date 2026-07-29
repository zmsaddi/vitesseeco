export default defineNuxtPlugin((nuxtApp) => {
  // Fetch user AFTER hydration. auth_token is httpOnly and invisible to
  // document.cookie, so the has_session flag set alongside it is what tells us
  // a session is worth probing — without it every guest page load would spend
  // a request on a 401. A stale flag (session expired server-side) costs one
  // 401 and then clears itself.
  nuxtApp.hook('app:mounted', async () => {
    if (!document.cookie.split('; ').some(c => c.startsWith('has_session='))) return
    const auth = useAuthStore()
    await auth.fetchUser()
    if (!auth.isLoggedIn) {
      document.cookie = 'has_session=; Max-Age=0; path=/'
    }
  })
})
