export default defineNuxtPlugin((nuxtApp) => {
  // Fetch user AFTER hydration to avoid mismatch
  nuxtApp.hook('app:mounted', async () => {
    const auth = useAuthStore()
    await auth.fetchUser()
  })
})
