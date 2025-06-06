import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import {
  PageContainer,
  Tabs,
  DataTable,
  Card,
  StatCard
} from '../components'
import type { Column, Tab } from '../components'

interface LeaderboardEntry {
  rank: number
  player: string
  totalScore: number
  totalRounds: number
  averageScore: number
  totalRewards: number
}

interface PhotoStats {
  photoId: number
  owner: string
  timesPlayed: number
  totalRewardsEarned: number
  quality: number
}


export default function Leaderboard() {
  const { principal } = useAuthStore()
  const [activeTab, setActiveTab] = useState('players')
  const [playerLeaderboard, setPlayerLeaderboard] = useState<LeaderboardEntry[]>([])
  const [photoLeaderboard, setPhotoLeaderboard] = useState<PhotoStats[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeaderboardData()
  }, [activeTab])

  const fetchLeaderboardData = async () => {
    setLoading(true)
    try {
      // TODO: Implement actual canister calls
      if (activeTab === 'players') {
        // Mock data for now
        setPlayerLeaderboard([
          {
            rank: 1,
            player: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
            totalScore: 2840,
            totalRounds: 32,
            averageScore: 88.75,
            totalRewards: 568
          },
          {
            rank: 2,
            player: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
            totalScore: 2650,
            totalRounds: 28,
            averageScore: 94.64,
            totalRewards: 530
          },
          {
            rank: 3,
            player: 'rno2w-sqaaa-aaaaa-aaacq-cai',
            totalScore: 2380,
            totalRounds: 35,
            averageScore: 68.00,
            totalRewards: 476
          }
        ])
      } else {
        // Mock photo stats
        setPhotoLeaderboard([
          {
            photoId: 1,
            owner: 'ryjl3-tyaaa-aaaaa-aaaba-cai',
            timesPlayed: 145,
            totalRewardsEarned: 435,
            quality: 0.92
          },
          {
            photoId: 2,
            owner: 'rdmx6-jaaaa-aaaaa-aaadq-cai',
            timesPlayed: 132,
            totalRewardsEarned: 396,
            quality: 0.88
          },
          {
            photoId: 3,
            owner: 'rno2w-sqaaa-aaaaa-aaacq-cai',
            timesPlayed: 98,
            totalRewardsEarned: 294,
            quality: 0.85
          }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch leaderboard:', error)
    } finally {
      setLoading(false)
    }
  }

  const tabs: Tab[] = [
    { id: 'players', label: 'Top Players', badge: playerLeaderboard.length },
    { id: 'photos', label: 'Top Photos', badge: photoLeaderboard.length }
  ]

  const formatPrincipal = (principalId: string) => {
    if (principalId === principal?.toString()) {
      return 'You'
    }
    return `${principalId.slice(0, 5)}...${principalId.slice(-3)}`
  }

  const playerColumns: Column<LeaderboardEntry>[] = [
    {
      key: 'rank',
      header: 'Rank',
      render: (value) => (
        <div className={`text-sm font-medium ${value <= 3 ? 'text-primary-600' : 'text-gray-900'}`}>
          #{value}
        </div>
      )
    },
    {
      key: 'player',
      header: 'Player',
      render: (value) => formatPrincipal(value)
    },
    {
      key: 'totalScore',
      header: 'Total Score'
    },
    {
      key: 'totalRounds',
      header: 'Rounds Played'
    },
    {
      key: 'averageScore',
      header: 'Avg Score',
      render: (value) => value.toFixed(2)
    },
    {
      key: 'totalRewards',
      header: 'SPOT Earned',
      render: (value) => (
        <span className="font-medium text-green-600">
          {(value / 100).toFixed(2)} SPOT
        </span>
      )
    }
  ]

  const photoColumns: Column<PhotoStats>[] = [
    {
      key: 'photoId',
      header: 'Photo ID',
      render: (value) => `#${value}`
    },
    {
      key: 'owner',
      header: 'Owner',
      render: (value) => formatPrincipal(value)
    },
    {
      key: 'timesPlayed',
      header: 'Times Played'
    },
    {
      key: 'quality',
      header: 'Quality Score',
      render: (value) => {
        const percentage = value * 100;
        const colorClass = value >= 0.9 ? 'text-green-600' : value >= 0.7 ? 'text-yellow-600' : 'text-red-600';
        const bgClass = value >= 0.9 ? 'bg-green-600' : value >= 0.7 ? 'bg-yellow-600' : 'bg-red-600';
        
        return (
          <div className="flex items-center">
            <div className={`text-sm font-medium ${colorClass}`}>
              {percentage.toFixed(0)}%
            </div>
            <div className="ml-2 w-16 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${bgClass}`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        )
      }
    },
    {
      key: 'totalRewardsEarned',
      header: 'SPOT Earned',
      render: (value) => (
        <span className="font-medium text-green-600">
          {(value / 100).toFixed(2)} SPOT
        </span>
      )
    }
  ]

  return (
    <PageContainer title="Leaderboard">
      <Card padding="none">
        <div className="px-6 py-4 border-b border-gray-200">
          <Tabs
            tabs={tabs}
            activeTab={activeTab}
            onChange={setActiveTab}
          />
        </div>

        <div className="p-6">
          {activeTab === 'players' && (
            <DataTable
              columns={playerColumns}
              data={playerLeaderboard}
              loading={loading}
              keyExtractor={(item) => item.player}
              emptyMessage="No player data available"
            />
          )}

          {activeTab === 'photos' && (
            <DataTable
              columns={photoColumns}
              data={photoLeaderboard}
              loading={loading}
              keyExtractor={(item) => item.photoId}
              emptyMessage="No photo data available"
            />
          )}
        </div>

      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <StatCard
          label="Total Players"
          value="1,234"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
            </svg>
          }
        />
        <StatCard
          label="Total Rounds"
          value="45,678"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
            </svg>
          }
        />
        <StatCard
          label="SPOT Distributed"
          value="123,456"
          icon={
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
            </svg>
          }
        />
      </div>
    </PageContainer>
  )
}