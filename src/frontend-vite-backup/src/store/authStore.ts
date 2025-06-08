import { create } from 'zustand'
import { Principal } from '@dfinity/principal'
import { authService } from '../services/auth'

// Admin principals - replace with actual admin principals
const ADMIN_PRINCIPALS = [
  '4wbqy-noqfb-3dunk-64f7k-4v54w-kzvti-l24ky-jaz3f-73y36-gegjt-cqe', // Admin principal
]

interface AuthState {
  isAuthenticated: boolean
  principal: Principal | null
  isAdmin: boolean
  loading: boolean
  checkAuth: () => Promise<void>
  login: (provider?: 'ii' | 'plug') => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  principal: null,
  isAdmin: false,
  loading: true,

  checkAuth: async () => {
    try {
      set({ loading: true })
      const isAuthenticated = await authService.isAuthenticated()
      
      if (isAuthenticated) {
        const principal = await authService.getPrincipal()
        const isAdmin = ADMIN_PRINCIPALS.includes(principal?.toString() || '')
        set({ 
          isAuthenticated: true, 
          principal,
          isAdmin,
          loading: false 
        })
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          isAdmin: false,
          loading: false 
        })
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      set({ 
        isAuthenticated: false, 
        principal: null,
        isAdmin: false,
        loading: false 
      })
    }
  },

  login: async (provider: 'ii' | 'plug' = 'ii') => {
    set({ loading: true })
    try {
      const principal = await authService.login(provider)
      
      if (principal) {
        const isAdmin = ADMIN_PRINCIPALS.includes(principal.toString())
        set({ 
          isAuthenticated: true, 
          principal,
          isAdmin,
          loading: false 
        })
      } else {
        set({ loading: false })
      }
    } catch (error) {
      console.error('Login failed:', error)
      set({ loading: false })
    }
  },

  logout: async () => {
    set({ loading: true })
    try {
      await authService.logout()
      set({ 
        isAuthenticated: false, 
        principal: null,
        isAdmin: false,
        loading: false 
      })
    } catch (error) {
      console.error('Logout failed:', error)
      set({ loading: false })
    }
  }
}))