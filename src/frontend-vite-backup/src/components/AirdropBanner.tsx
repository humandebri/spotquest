import React, { useState, useEffect } from 'react'
import { Principal } from '@dfinity/principal'
import { useAuthStore } from '../store/authStore'
import Button from './Button'
import Card from './Card'
import ProgressBar from './ProgressBar'

interface AirdropCampaign {
  id: bigint
  name: string
  startTime: bigint
  endTime: bigint
  totalTokens: bigint
  claimedTokens: bigint
  rewards: {
    signup: bigint
    firstPhoto: bigint
    firstPlay: bigint
  }
  isActive: boolean
}

interface AirdropClaim {
  user: Principal
  campaignId: bigint
  signupBonus: bigint
  firstPhotoBonus: bigint
  firstPlayBonus: bigint
  totalClaimed: bigint
  claimTime: bigint
}

export default function AirdropBanner() {
  const { isAuthenticated, principal, actor } = useAuthStore()
  const [campaign, setCampaign] = useState<AirdropCampaign | null>(null)
  const [claim, setClaim] = useState<AirdropClaim | null>(null)
  const [loading, setLoading] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [timeLeft, setTimeLeft] = useState<string>('')
  const [isEarlyBird, setIsEarlyBird] = useState(false)

  useEffect(() => {
    if (isAuthenticated && actor) {
      loadAirdropData()
    }
  }, [isAuthenticated, actor])

  useEffect(() => {
    if (campaign && campaign.isActive) {
      const timer = setInterval(() => {
        updateTimeLeft()
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [campaign])

  const loadAirdropData = async () => {
    if (!actor || !principal) return
    
    setLoading(true)
    try {
      // Get active airdrop
      const activeCampaign = await actor.getActiveAirdrop()
      if (activeCampaign && activeCampaign.length > 0) {
        setCampaign(activeCampaign[0])
      }
      
      // Get user's claim
      const userClaim = await actor.getAirdropClaim(principal)
      if (userClaim && userClaim.length > 0) {
        setClaim(userClaim[0])
      }
      
      // Check early bird status
      const earlyBird = await actor.isEarlyBird(principal)
      setIsEarlyBird(earlyBird)
    } catch (error) {
      console.error('Failed to load airdrop data:', error)
    }
    setLoading(false)
  }

  const updateTimeLeft = () => {
    if (!campaign) return
    
    const now = Date.now() * 1000000 // Convert to nanoseconds
    const endTime = Number(campaign.endTime)
    const remaining = endTime - now
    
    if (remaining <= 0) {
      setTimeLeft('Ended')
      return
    }
    
    const days = Math.floor(remaining / (1000000000 * 60 * 60 * 24))
    const hours = Math.floor((remaining % (1000000000 * 60 * 60 * 24)) / (1000000000 * 60 * 60))
    const minutes = Math.floor((remaining % (1000000000 * 60 * 60)) / (1000000000 * 60))
    const seconds = Math.floor((remaining % (1000000000 * 60)) / 1000000000)
    
    if (days > 0) {
      setTimeLeft(`${days}d ${hours}h ${minutes}m`)
    } else if (hours > 0) {
      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`)
    } else {
      setTimeLeft(`${minutes}m ${seconds}s`)
    }
  }

  const claimSignupBonus = async () => {
    if (!actor) return
    
    setClaiming(true)
    try {
      const result = await actor.claimAirdropSignupBonus()
      if ('ok' in result) {
        await loadAirdropData()
        alert(`Successfully claimed ${Number(result.ok) / 100} SPOT!`)
      } else {
        alert(`Failed to claim: ${result.err}`)
      }
    } catch (error) {
      console.error('Failed to claim airdrop:', error)
      alert('Failed to claim airdrop')
    }
    setClaiming(false)
  }

  if (!isAuthenticated || !campaign || loading) {
    return null
  }

  const progress = (Number(campaign.claimedTokens) / Number(campaign.totalTokens)) * 100
  const canClaimSignup = !claim || Number(claim.signupBonus) === 0
  
  const totalAvailable = Number(campaign.rewards.signup) + 
    Number(campaign.rewards.firstPhoto) + 
    Number(campaign.rewards.firstPlay)
  
  const userClaimed = claim ? Number(claim.totalClaimed) : 0
  const userProgress = claim ? (userClaimed / totalAvailable) * 100 : 0

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold flex items-center gap-2">
            🎁 {campaign.name}
            {isEarlyBird && (
              <span className="text-sm bg-yellow-400 text-gray-900 px-2 py-1 rounded">
                Early Bird #1000
              </span>
            )}
          </h3>
          <p className="text-sm opacity-90">
            Claim your free SPOT tokens!
          </p>
        </div>
        <div className="text-center">
          <p className="text-3xl font-bold">{timeLeft}</p>
          <p className="text-sm opacity-75">Time remaining</p>
        </div>
      </div>
      
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span>Campaign Progress</span>
          <span>{(Number(campaign.claimedTokens) / 100).toFixed(0)} / {(Number(campaign.totalTokens) / 100).toFixed(0)} SPOT</span>
        </div>
        <ProgressBar progress={progress} className="h-3" />
      </div>
      
      <div className="grid md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">Signup Bonus</span>
            <span className="font-bold">{(Number(campaign.rewards.signup) / 100).toFixed(2)} SPOT</span>
          </div>
          {claim && Number(claim.signupBonus) > 0 ? (
            <span className="text-xs text-green-300">✓ Claimed</span>
          ) : (
            <Button
              onClick={claimSignupBonus}
              size="small"
              variant="secondary"
              className="!bg-white/20 hover:!bg-white/30 w-full"
              disabled={claiming}
            >
              {claiming ? 'Claiming...' : 'Claim Now'}
            </Button>
          )}
        </div>
        
        <div className="bg-white/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">First Upload</span>
            <span className="font-bold">{(Number(campaign.rewards.firstPhoto) / 100).toFixed(2)} SPOT</span>
          </div>
          {claim && Number(claim.firstPhotoBonus) > 0 ? (
            <span className="text-xs text-green-300">✓ Claimed</span>
          ) : (
            <span className="text-xs opacity-75">Upload a photo to claim</span>
          )}
        </div>
        
        <div className="bg-white/20 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm">First Play</span>
            <span className="font-bold">{(Number(campaign.rewards.firstPlay) / 100).toFixed(2)} SPOT</span>
          </div>
          {claim && Number(claim.firstPlayBonus) > 0 ? (
            <span className="text-xs text-green-300">✓ Claimed</span>
          ) : (
            <span className="text-xs opacity-75">Play a game to claim</span>
          )}
        </div>
      </div>
      
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span>Your Progress</span>
          <span>{(userClaimed / 100).toFixed(2)} / {(totalAvailable / 100).toFixed(2)} SPOT</span>
        </div>
        <ProgressBar progress={userProgress} className="h-2" />
      </div>
    </Card>
  )
}