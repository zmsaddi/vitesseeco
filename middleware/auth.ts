export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // On server, check cookie directly (store is empty during SSR)
  if (import.meta.server) {
    const token = useCookie('auth_token')
    if (!token.value) {
      const localePath = useLocalePath()
      return navigateTo(localePath('/connexion'))
    }
    // Cookie exists, let the page load — client will hydrate auth store
    return
  }

  // On client, use auth store
  if (!auth.user) {
    await auth.fetchUser()
  }

  if (!auth.user) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/connexion'))
  }
})
