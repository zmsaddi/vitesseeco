import { defineStore } from 'pinia'

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  phone?: string
  address?: string
  city?: string
  postalCode?: string
  country?: string
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    loading: false,
    error: null as string | null,
  }),

  getters: {
    isLoggedIn: (state) => !!state.user,
    fullName: (state) => state.user ? `${state.user.firstName} ${state.user.lastName}` : '',
  },

  actions: {
    async fetchUser() {
      try {
        const { user } = await $fetch('/api/auth/me')
        this.user = user as any
      } catch {
        this.user = null
      }
    },

    async login(email: string, password: string) {
      this.loading = true
      this.error = null
      try {
        const { user } = await $fetch('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        })
        this.user = user
        return true
      } catch (e: any) {
        this.error = e.data?.message || 'Login failed'
        return false
      } finally {
        this.loading = false
      }
    },

    async register(data: { email: string; password: string; firstName: string; lastName: string; phone?: string }) {
      this.loading = true
      this.error = null
      try {
        const { user } = await $fetch('/api/auth/register', {
          method: 'POST',
          body: data,
        })
        this.user = user
        return true
      } catch (e: any) {
        this.error = e.data?.message || 'Registration failed'
        return false
      } finally {
        this.loading = false
      }
    },

    async logout() {
      try {
        await $fetch('/api/auth/logout', { method: 'POST' })
      } catch {
        // Ignore errors — clear local state regardless
      }
      this.user = null
    },
  },
})
