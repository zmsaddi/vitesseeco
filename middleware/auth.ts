export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (!auth.user) {
    await auth.fetchUser()
  }

  if (!auth.user) {
    const localePath = useLocalePath()
    return navigateTo(localePath('/connexion'))
  }
})
