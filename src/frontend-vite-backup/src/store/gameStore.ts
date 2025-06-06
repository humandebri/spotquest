import { create } from 'zustand'
import { Principal } from '@dfinity/principal'

export interface GameRound {
  id: number
  photoId: number
  photoUrl?: string
  startTime: bigint
  endTime?: bigint
  participants: Principal[]
  settled: boolean
}

export interface Submission {
  player: Principal
  guessLat: number
  guessLon: number
  guessAzim: number
  submissionTime: bigint
  distance?: number
  azimuthError?: number
  score?: number
  reward?: number
}

interface GameState {
  activeRounds: GameRound[]
  currentRound: GameRound | null
  playerStats: {
    totalRounds: number
    totalScore: number
    totalRewards: number
    averageDistance: number
  } | null
  loading: boolean
  error: string | null
  
  // Actions
  fetchActiveRounds: () => Promise<void>
  createRound: () => Promise<number | null>
  submitGuess: (roundId: number, lat: number, lon: number, azim: number) => Promise<void>
  fetchPlayerStats: (principal: Principal) => Promise<void>
  setCurrentRound: (round: GameRound | null) => void
}

export const useGameStore = create<GameState>((set) => ({
  activeRounds: [],
  currentRound: null,
  playerStats: null,
  loading: false,
  error: null,

  fetchActiveRounds: async () => {
    set({ loading: true, error: null })
    try {
      // TODO: Implement actual canister call
      set({ activeRounds: [], loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch rounds', loading: false })
    }
  },

  createRound: async () => {
    set({ loading: true, error: null })
    try {
      // TODO: Implement actual canister call
      return null
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create round', loading: false })
      return null
    }
  },

  submitGuess: async (roundId: number, lat: number, lon: number, azim: number) => {
    set({ loading: true, error: null })
    try {
      // TODO: Implement actual canister call
      console.log('Submitting guess:', { roundId, lat, lon, azim })
      set({ loading: false })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to submit guess', loading: false })
    }
  },

  fetchPlayerStats: async (principal: Principal) => {
    set({ loading: true, error: null })
    try {
      // TODO: Implement actual canister call
      console.log('Fetching stats for:', principal.toString())
      set({ 
        playerStats: {
          totalRounds: 0,
          totalScore: 0,
          totalRewards: 0,
          averageDistance: 0
        },
        loading: false 
      })
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to fetch stats', loading: false })
    }
  },

  setCurrentRound: (round: GameRound | null) => {
    set({ currentRound: round })
  }
}))