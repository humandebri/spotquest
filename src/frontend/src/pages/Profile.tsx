import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useGameStore } from '../store/gameStore'
import {
  AuthGuard,
  PageContainer,
  Card,
  StatCard,
  LoadingSpinner,
  EmptyState,
  ProgressBar
} from '../components'

interface PhotoNFT {
  id: number
  uploadTime: string
  quality: number
  timesPlayed: number
  totalEarned: number
}

export default function Profile() {
  const { isAuthenticated, principal } = useAuthStore()
  const { playerStats, fetchPlayerStats } = useGameStore()
  const [myPhotos, setMyPhotos] = useState<PhotoNFT[]>([])
  const [balance, setBalance] = useState<number>(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAuthenticated && principal) {
      fetchProfileData()
    }
  }, [isAuthenticated, principal])

  const fetchProfileData = async () => {
    if (!principal) return
    
    setLoading(true)
    try {
      // Fetch player stats
      await fetchPlayerStats(principal)
      
      // TODO: Fetch SPOT balance
      setBalance(1234.56)
      
      // TODO: Fetch user's photos
      setMyPhotos([
        {
          id: 1,
          uploadTime: '2025-06-01T10:30:00Z',
          quality: 0.92,
          timesPlayed: 45,
          totalEarned: 135
        },
        {
          id: 2,
          uploadTime: '2025-05-28T15:45:00Z',
          quality: 0.88,
          timesPlayed: 32,
          totalEarned: 96
        },
        {
          id: 3,
          uploadTime: '2025-05-25T09:15:00Z',
          quality: 0.75,
          timesPlayed: 18,
          totalEarned: 54
        }
      ])
    } catch (error) {
      console.error('Failed to fetch profile data:', error)
    } finally {
      setLoading(false)
    }
  }


  return (
    <AuthGuard>
      <PageContainer title="My Profile">
      {loading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="large" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Profile Info */}
          <div className="lg:col-span-1 space-y-6">
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-4">Profile</h2>
              
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-gray-500">Principal ID</p>
                  <p className="text-sm font-mono text-gray-900 break-all">
                    {principal?.toString()}
                  </p>
                </div>
                
                <div className="border-t pt-4">
                  <p className="text-sm text-gray-500">SPOT Balance</p>
                  <p className="text-2xl font-bold text-green-600">
                    {balance.toFixed(2)} SPOT
                  </p>
                </div>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-4">
              <StatCard
                label="Photos Uploaded"
                value={myPhotos.length}
                icon={
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                  </svg>
                }
              />
              <StatCard
                label="Total Earned"
                value={`${(myPhotos.reduce((sum, p) => sum + p.totalEarned, 0) / 100).toFixed(2)} SPOT`}
                icon={
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M8.433 7.418c.155-.103.346-.196.567-.267v1.698a2.305 2.305 0 01-.567-.267C8.07 8.34 8 8.114 8 8c0-.114.07-.34.433-.582zM11 12.849v-1.698c.22.071.412.164.567.267.364.243.433.468.433.582 0 .114-.07.34-.433.582a2.305 2.305 0 01-.567.267z" />
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-13a1 1 0 10-2 0v.092a4.535 4.535 0 00-1.676.662C6.602 6.234 6 7.009 6 8c0 .99.602 1.765 1.324 2.246.48.32 1.054.545 1.676.662v1.941c-.391-.127-.68-.317-.843-.504a1 1 0 10-1.51 1.31c.562.649 1.413 1.076 2.353 1.253V15a1 1 0 102 0v-.092a4.535 4.535 0 001.676-.662C13.398 13.766 14 12.991 14 12c0-.99-.602-1.765-1.324-2.246A4.535 4.535 0 0011 9.092V7.151c.391.127.68.317.843.504a1 1 0 101.511-1.31c-.563-.649-1.413-1.076-2.354-1.253V5z" clipRule="evenodd" />
                  </svg>
                }
              />
            </div>

            {/* Game Stats */}
            {playerStats && (
              <Card>
                <h3 className="text-lg font-bold text-gray-900 mb-4">Game Stats</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Rounds Played</span>
                    <span className="text-sm font-medium text-gray-900">
                      {playerStats.totalRounds}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Score</span>
                    <span className="text-sm font-medium text-gray-900">
                      {playerStats.totalScore}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Average Distance</span>
                    <span className="text-sm font-medium text-gray-900">
                      {playerStats.averageDistance.toFixed(2)} m
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-500">Total Rewards</span>
                    <span className="text-sm font-medium text-green-600">
                      {(playerStats.totalRewards / 100).toFixed(2)} SPOT
                    </span>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* My Photos */}
          <div className="lg:col-span-2">
            <Card>
              <h2 className="text-xl font-bold text-gray-900 mb-6">My Photos</h2>
            
              {myPhotos.length > 0 ? (
                <div className="space-y-4">
                  {myPhotos.map((photo) => (
                    <Card key={photo.id} className="hover:shadow-lg transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-lg font-medium text-gray-900">
                            Photo #{photo.id}
                          </h4>
                          <p className="text-sm text-gray-500 mt-1">
                            Uploaded: {new Date(photo.uploadTime).toLocaleDateString()}
                          </p>
                          
                          <div className="grid grid-cols-3 gap-4 mt-3">
                            <div>
                              <p className="text-xs text-gray-500">Quality Score</p>
                              <ProgressBar
                                progress={photo.quality * 100}
                                color={
                                  photo.quality >= 0.9 ? 'success' :
                                  photo.quality >= 0.7 ? 'warning' :
                                  'danger'
                                }
                                size="small"
                                className="mt-1"
                              />
                            </div>
                            
                            <div>
                              <p className="text-xs text-gray-500">Times Played</p>
                              <p className="text-sm font-medium text-gray-900 mt-1">
                                {photo.timesPlayed}
                              </p>
                            </div>
                            
                            <div>
                              <p className="text-xs text-gray-500">Earned</p>
                              <p className="text-sm font-medium text-green-600 mt-1">
                                {(photo.totalEarned / 100).toFixed(2)} SPOT
                              </p>
                            </div>
                          </div>
                        </div>
                        
                        <div className="ml-4">
                          <img
                            src={`/placeholder-photo-${photo.id}.jpg`}
                            alt={`Photo ${photo.id}`}
                            className="w-24 h-24 object-cover rounded-md"
                          />
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  }
                  title="No photos yet"
                  description="Upload your first photo to start earning SPOT tokens"
                  action={{
                    label: 'Upload Photo',
                    onClick: () => window.location.href = '/upload'
                  }}
                />
              )}
            </Card>
          </div>
        </div>
      )}
      </PageContainer>
    </AuthGuard>
  )
}