import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'

export function useReferralCode() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { isAuthenticated, actor } = useAuthStore()
  
  useEffect(() => {
    const referralCode = searchParams.get('ref')
    
    if (referralCode && isAuthenticated && actor) {
      // Store referral code in localStorage
      localStorage.setItem('pendingReferralCode', referralCode)
      
      // Register with referral
      handleReferralRegistration(referralCode)
    }
  }, [searchParams, isAuthenticated, actor])
  
  const handleReferralRegistration = async (code: string) => {
    if (!actor) return
    
    try {
      const result = await actor.registerWithReferral(code)
      if ('ok' in result) {
        console.log('Successfully registered with referral code:', code)
        // Clear the referral code from URL and localStorage
        searchParams.delete('ref')
        setSearchParams(searchParams)
        localStorage.removeItem('pendingReferralCode')
      } else {
        console.error('Failed to register with referral:', result.err)
      }
    } catch (error) {
      console.error('Error registering with referral:', error)
    }
  }
  
  // Check for pending referral code on login
  useEffect(() => {
    if (isAuthenticated && actor) {
      const pendingCode = localStorage.getItem('pendingReferralCode')
      if (pendingCode) {
        handleReferralRegistration(pendingCode)
      }
    }
  }, [isAuthenticated, actor])
}