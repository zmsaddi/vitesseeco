export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  // Try to fetch current user on app load (if auth cookie exists)
  await auth.fetchUser()
})
