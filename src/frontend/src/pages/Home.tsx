import { Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Button, Card } from '../components'

export default function Home() {
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="relative bg-white overflow-hidden">
      <div className="max-w-7xl mx-auto">
        <div className="relative z-10 pb-8 bg-white sm:pb-16 md:pb-20 lg:max-w-2xl lg:w-full lg:pb-28 xl:pb-32">
          <main className="mt-10 mx-auto max-w-7xl px-4 sm:mt-12 sm:px-6 md:mt-16 lg:mt-20 lg:px-8 xl:mt-28">
            <div className="sm:text-center lg:text-left">
              <h1 className="text-4xl tracking-tight font-extrabold text-gray-900 sm:text-5xl md:text-6xl">
                <span className="block xl:inline">Guess the location</span>{' '}
                <span className="block text-primary-600 xl:inline">earn SPOT tokens</span>
              </h1>
              <p className="mt-3 text-base text-gray-500 sm:mt-5 sm:text-lg sm:max-w-xl sm:mx-auto md:mt-5 md:text-xl lg:mx-0">
                Test your geography skills by guessing photo locations. Upload your own photos to create challenges for others. 
                All powered by the Internet Computer blockchain.
              </p>
              <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
                {isAuthenticated ? (
                  <>
                    <Link to="/game" className="mr-3">
                      <Button size="large">
                        Start Playing
                      </Button>
                    </Link>
                    <Link to="/upload">
                      <Button variant="secondary" size="large">
                        Upload Photo
                      </Button>
                    </Link>
                  </>
                ) : (
                  <Button
                    onClick={() => useAuthStore.getState().login()}
                    size="large"
                  >
                    Login to Start
                  </Button>
                )}
              </div>
            </div>
          </main>
        </div>
      </div>
      
      {/* Feature Section */}
      <div className="py-12 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="lg:text-center">
            <h2 className="text-base text-primary-600 font-semibold tracking-wide uppercase">How it works</h2>
            <p className="mt-2 text-3xl leading-8 font-extrabold tracking-tight text-gray-900 sm:text-4xl">
              Play, Upload, Earn
            </p>
          </div>

          <div className="mt-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <Card className="relative overflow-visible">
                <div className="absolute -top-6 left-6 flex items-center justify-center h-12 w-12 rounded-full bg-primary-500 text-white shadow-lg">
                  <span className="text-xl font-bold">1</span>
                </div>
                <div className="pt-8">
                  <h3 className="text-lg font-medium text-gray-900">Play Rounds</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Look at photos and guess their location on the map. The closer you get, the higher your score!
                  </p>
                </div>
              </Card>

              <Card className="relative overflow-visible">
                <div className="absolute -top-6 left-6 flex items-center justify-center h-12 w-12 rounded-full bg-primary-500 text-white shadow-lg">
                  <span className="text-xl font-bold">2</span>
                </div>
                <div className="pt-8">
                  <h3 className="text-lg font-medium text-gray-900">Upload Photos</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Share your travel photos with GPS data. Each time someone plays your photo, you earn rewards.
                  </p>
                </div>
              </Card>

              <Card className="relative overflow-visible">
                <div className="absolute -top-6 left-6 flex items-center justify-center h-12 w-12 rounded-full bg-primary-500 text-white shadow-lg">
                  <span className="text-xl font-bold">3</span>
                </div>
                <div className="pt-8">
                  <h3 className="text-lg font-medium text-gray-900">Earn SPOT</h3>
                  <p className="mt-2 text-base text-gray-500">
                    Get SPOT tokens for accurate guesses and popular photo uploads. All stored on-chain!
                  </p>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}