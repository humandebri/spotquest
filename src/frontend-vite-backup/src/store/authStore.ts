import { create } from 'zustand'
import { Principal } from '@dfinity/principal'
import { authService } from '../services/auth'

interface AuthState {
  isAuthenticated: boolean
  principal: Principal | null
  loading: boolean
  checkAuth: () => Promise<void>
  login: (provider?: 'ii' | 'plug') => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: false,
  principal: null,
  loading: true,

  checkAuth: async () => {
    try {
      set({ loading: true })
      const isAuthenticated = await authService.isAuthenticated()
      
      if (isAuthenticated) {
        const principal = await authService.getPrincipal()
        set({ 
          isAuthenticated: true, 
          principal,
          loading: false 
        })
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          loading: false 
        })
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      set({ 
        isAuthenticated: false, 
        principal: null,
        loading: false 
      })
    }
  },

  login: async (provider: 'ii' | 'plug' = 'ii') => {
    set({ loading: true })
    try {
      const principal = await authService.login(provider)
      
      if (principal) {
        set({ 
          isAuthenticated: true, 
          principal,
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
        loading: false 
      })
    } catch (error) {
      console.error('Logout failed:', error)
      set({ loading: false })
    }
  }
}))