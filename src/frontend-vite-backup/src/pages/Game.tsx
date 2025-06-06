import { useState, useEffect } from 'react'
import { useGameStore } from '../store/gameStore'
import { 
  AuthGuard, 
  MapView, 
  AzimuthSelector, 
  Button, 
  Alert, 
  Card, 
  PhotoCard,
  EmptyState,
  PageContainer 
} from '../components'

export default function Game() {
  const { currentRound, activeRounds, fetchActiveRounds, createRound, submitGuess } = useGameStore()
  
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null)
  const [azimuth, setAzimuth] = useState<number>(0)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const handleLocationSelect = (lat: number, lng: number) => {
    if (!currentRound || showResult) return;
    setSelectedLocation({ lat, lng });
  }

  useEffect(() => {
    fetchActiveRounds()
  }, [fetchActiveRounds])

  const handleCreateRound = async () => {
    const roundId = await createRound()
    if (roundId !== null) {
      // Round created successfully
      setSelectedLocation(null)
      setAzimuth(0)
      setShowResult(false)
      setSelectedLocation(null)
    }
  }

  const handleSubmitGuess = async () => {
    if (!currentRound || !selectedLocation) return

    setIsSubmitting(true)
    try {
      await submitGuess(
        currentRound.id,
        selectedLocation.lat,
        selectedLocation.lng,
        azimuth
      )
      setShowResult(true)
    } catch (error) {
      console.error('Failed to submit guess:', error)
    } finally {
      setIsSubmitting(false)
    }
  }


  return (
    <AuthGuard>
      <PageContainer title="Play Game" subtitle="Guess the location from the photo">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Photo and Controls */}
        <div className="lg:col-span-1 space-y-6">
          {currentRound ? (
            <>
              <PhotoCard
                photoUrl={currentRound.photoUrl || '/placeholder-photo.jpg'}
                title={`Round #${currentRound.id}`}
                subtitle="Click on the map to place your guess"
              />

              <AzimuthSelector
                value={azimuth}
                onChange={setAzimuth}
                disabled={showResult}
              />

              <Button
                onClick={handleSubmitGuess}
                disabled={!selectedLocation || showResult}
                loading={isSubmitting}
                fullWidth
                variant={showResult ? 'secondary' : 'primary'}
              >
                {showResult ? 'Round Complete' : 'Submit Guess'}
              </Button>

              {showResult && (
                <Alert type="success" title="Round Complete!">
                  Check the leaderboard to see your score.
                </Alert>
              )}
            </>
          ) : (
            <Card padding="large">
              <EmptyState
                icon={
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                }
                title="No Active Round"
                description="Start a new round to begin playing"
                action={{
                  label: 'Start New Round',
                  onClick: handleCreateRound
                }}
              />
            </Card>
          )}

          <Card>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Active Rounds</h3>
            {activeRounds.length > 0 ? (
              <ul className="space-y-2">
                {activeRounds.map((round) => (
                  <li
                    key={round.id}
                    className="flex justify-between items-center p-2 hover:bg-gray-50 rounded cursor-pointer"
                    onClick={() => useGameStore.getState().setCurrentRound(round)}
                  >
                    <span className="text-sm font-medium">Round #{round.id}</span>
                    <span className="text-xs text-gray-500">
                      {round.participants.length} players
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No active rounds</p>
            )}
          </Card>
        </div>

        {/* Map */}
        <div className="lg:col-span-2">
          <Card padding="none" className="overflow-hidden h-[600px]">
            <MapView
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              interactive={!showResult}
            />
          </Card>
          {selectedLocation && !showResult && (
            <Alert type="info" className="mt-4">
              Selected: {selectedLocation.lat.toFixed(4)}°, {selectedLocation.lng.toFixed(4)}°
            </Alert>
          )}
        </div>
      </div>
      </PageContainer>
    </AuthGuard>
  )
}