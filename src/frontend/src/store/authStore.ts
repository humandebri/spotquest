import { create } from 'zustand'
import { AuthClient } from '@dfinity/auth-client'
import { Principal } from '@dfinity/principal'

interface AuthState {
  isAuthenticated: boolean
  principal: Principal | null
  authClient: AuthClient | null
  loading: boolean
  checkAuth: () => Promise<void>
  login: () => Promise<void>
  logout: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  principal: null,
  authClient: null,
  loading: true,

  checkAuth: async () => {
    try {
      const authClient = await AuthClient.create()
      const isAuthenticated = await authClient.isAuthenticated()
      
      if (isAuthenticated) {
        const identity = authClient.getIdentity()
        const principal = identity.getPrincipal()
        set({ 
          isAuthenticated: true, 
          principal,
          authClient,
          loading: false 
        })
      } else {
        set({ 
          isAuthenticated: false, 
          principal: null,
          authClient,
          loading: false 
        })
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      set({ loading: false })
    }
  },

  login: async () => {
    const authClient = get().authClient || await AuthClient.create()
    
    await authClient.login({
      identityProvider: process.env.DFX_NETWORK === "ic"
        ? "https://identity.ic0.app"
        : `http://localhost:8000?canisterId=${process.env.INTERNET_IDENTITY_CANISTER_ID}`,
      onSuccess: () => {
        const identity = authClient.getIdentity()
        const principal = identity.getPrincipal()
        set({ 
          isAuthenticated: true, 
          principal,
          authClient 
        })
      },
      onError: (error) => {
        console.error('Login failed:', error)
      }
    })
  },

  logout: async () => {
    const authClient = get().authClient
    if (authClient) {
      await authClient.logout()
      set({ 
        isAuthenticated: false, 
        principal: null 
      })
    }
  }
}))