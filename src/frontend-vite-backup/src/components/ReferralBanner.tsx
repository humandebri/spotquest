import React, { useState, useEffect } from 'react'
import { Actor } from '@dfinity/agent'
import { Principal } from '@dfinity/principal'
import { _SERVICE } from '../../../declarations/unified/unified.did'
import { useAuthStore } from '../store/authStore'
import Button from './Button'
import Card from './Card'
// import { toast } from 'react-toastify'

interface ReferralStats {
  referrer: [] | [Principal]
  referredUsers: Principal[]
  totalEarned: bigint
  tier: bigint
}

interface ReferralTier {
  name: string
  required: number
  bonus: number
  color: string
}

const REFERRAL_TIERS: ReferralTier[] = [
  { name: 'Bronze', required: 0, bonus: 1.0, color: '#CD7F32' },
  { name: 'Silver', required: 10, bonus: 1.2, color: '#C0C0C0' },
  { name: 'Gold', required: 50, bonus: 1.5, color: '#FFD700' },
  { name: 'Diamond', required: 100, bonus: 2.0, color: '#B9F2FF' },
]

export default function ReferralBanner() {
  const { isAuthenticated, principal, actor } = useAuthStore()
  const [referralCode, setReferralCode] = useState<string>('')
  const [stats, setStats] = useState<ReferralStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [showLeaderboard, setShowLeaderboard] = useState(false)
  const [leaderboard, setLeaderboard] = useState<[Principal, ReferralStats][]>([])

  useEffect(() => {
    if (isAuthenticated && actor) {
      loadReferralData()
    }
  }, [isAuthenticated, actor])

  const loadReferralData = async () => {
    if (!actor || !principal) return
    
    try {
      // Get referral code
      const code = await actor.getReferralCode(principal)
      if (code && code.length > 0) {
        setReferralCode(code[0])
      } else {
        // Generate new code if doesn't exist
        const result = await actor.generateReferralCode()
        if ('ok' in result) {
          setReferralCode(result.ok)
        }
      }
      
      // Get stats
      const statsResult = await actor.getReferralStats(principal)
      if (statsResult && statsResult.length > 0) {
        setStats(statsResult[0])
      }
    } catch (error) {
      console.error('Failed to load referral data:', error)
    }
  }

  const loadLeaderboard = async () => {
    if (!actor) return
    
    setLoading(true)
    try {
      const result = await actor.getReferralLeaderboard(10n)
      setLeaderboard(result)
      setShowLeaderboard(true)
    } catch (error) {
      console.error('Failed to load leaderboard:', error)
    }
    setLoading(false)
  }

  const copyToClipboard = async () => {
    const referralLink = `https://guessthespot.io?ref=${referralCode}`
    try {
      await navigator.clipboard.writeText(referralLink)
      // toast.success('Referral link copied!')
      alert('Referral link copied!')
    } catch (error) {
      // toast.error('Failed to copy link')
      alert('Failed to copy link')
    }
  }

  const shareToTwitter = () => {
    const text = `Join me on Guess the Spot! 🎯📍
    
I've earned ${stats ? Number(stats.totalEarned) / 100 : 0} SPOT tokens by referring friends.
    
Use my referral code: ${referralCode}
#GuessTheSpot #Web3Gaming #ICP`
    
    window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`)
  }

  if (!isAuthenticated) {
    return null
  }

  const currentTier = stats ? REFERRAL_TIERS[Number(stats.tier)] : REFERRAL_TIERS[0]
  const nextTier = stats && Number(stats.tier) < REFERRAL_TIERS.length - 1 
    ? REFERRAL_TIERS[Number(stats.tier) + 1] 
    : null

  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-2xl font-bold">Invite Friends & Earn SPOT!</h3>
            <p className="text-sm opacity-90">
              Get 1 SPOT for each friend + 5% of their earnings forever
            </p>
          </div>
          <div className="text-center">
            <p className="text-4xl font-bold">
              {stats ? (Number(stats.totalEarned) / 100).toFixed(2) : '0.00'}
            </p>
            <p className="text-sm">SPOT earned</p>
          </div>
        </div>
        
        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-xs mb-2">Your Tier</p>
            <div className="flex items-center gap-2">
              <div 
                className="w-8 h-8 rounded-full"
                style={{ backgroundColor: currentTier.color }}
              />
              <div>
                <p className="font-bold">{currentTier.name}</p>
                <p className="text-xs opacity-75">
                  {currentTier.bonus}x bonus rewards
                </p>
              </div>
            </div>
            {nextTier && (
              <p className="text-xs mt-2 opacity-75">
                {nextTier.required - (stats ? stats.referredUsers.length : 0)} more referrals to {nextTier.name}
              </p>
            )}
          </div>
          
          <div className="bg-white/20 rounded-lg p-4">
            <p className="text-xs mb-2">Your Network</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <p className="text-2xl font-bold">
                  {stats ? stats.referredUsers.length : 0}
                </p>
                <p className="text-xs opacity-75">Friends</p>
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats ? (Number(stats.totalEarned) / 100 * 0.05).toFixed(2) : '0.00'}
                </p>
                <p className="text-xs opacity-75">Avg. Earnings</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white/20 rounded-lg p-4">
          <p className="text-xs mb-2">Your referral link:</p>
          <div className="flex items-center gap-2">
            <input
              value={`https://guessthespot.io?ref=${referralCode}`}
              readOnly
              className="flex-1 bg-white/10 rounded px-3 py-2 text-sm"
            />
            <Button
              onClick={copyToClipboard}
              size="small"
              variant="secondary"
              className="!bg-white/20 hover:!bg-white/30"
            >
              Copy
            </Button>
            <Button
              onClick={shareToTwitter}
              size="small"
              variant="secondary"
              className="!bg-white/20 hover:!bg-white/30"
            >
              Share
            </Button>
          </div>
        </div>
        
        <div className="flex justify-center mt-4">
          <Button
            onClick={loadLeaderboard}
            variant="ghost"
            className="text-white hover:bg-white/20"
          >
            View Leaderboard
          </Button>
        </div>
      </Card>
      
      {showLeaderboard && (
        <Card>
          <h4 className="text-lg font-bold mb-4">Referral Leaderboard</h4>
          <div className="space-y-2">
            {leaderboard.map(([user, data], index) => {
              const tier = REFERRAL_TIERS[Number(data.tier)]
              return (
                <div
                  key={user.toString()}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-gray-800"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-gray-500">
                      #{index + 1}
                    </span>
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{ backgroundColor: tier.color }}
                    />
                    <div>
                      <p className="text-sm font-medium">
                        {user.toString().slice(0, 8)}...
                      </p>
                      <p className="text-xs text-gray-500">
                        {data.referredUsers.length} referrals
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">
                      {(Number(data.totalEarned) / 100).toFixed(2)} SPOT
                    </p>
                    <p className="text-xs text-gray-500">{tier.name} Tier</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}