export default defineNuxtPlugin((nuxtApp) => {
  // Fetch user AFTER hydration — only if auth cookie exists
  nuxtApp.hook('app:mounted', async () => {
    if (document.cookie.includes('auth_token')) {
      const auth = useAuthStore()
      await auth.fetchUser()
    }
  })
})
