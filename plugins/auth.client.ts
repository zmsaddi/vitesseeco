export default defineNuxtPlugin((nuxtApp) => {
  // Fetch user AFTER hydration. The auth cookie is httpOnly and therefore
  // invisible to document.cookie — the session can only be probed by asking
  // the server; /api/auth/me answers 401 for guests and fetchUser swallows it.
  nuxtApp.hook('app:mounted', async () => {
    const auth = useAuthStore()
    await auth.fetchUser()
  })
})
