import { Outlet, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Button from './Button'
import NavLink from './NavLink'

export default function Layout() {
  const { isAuthenticated, principal, login, logout } = useAuthStore()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link to="/" className="flex items-center">
                <span className="text-xl font-bold text-primary-600">Guess the Spot</span>
              </Link>
              
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <NavLink to="/">Home</NavLink>
                <NavLink to="/game">Play</NavLink>
                <NavLink to="/upload">Upload</NavLink>
                <NavLink to="/leaderboard">Leaderboard</NavLink>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/profile"
                    className="text-gray-700 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Profile
                  </Link>
                  <Button
                    onClick={logout}
                    variant="secondary"
                    size="small"
                  >
                    Logout
                  </Button>
                  <div className="text-xs text-gray-500">
                    {principal?.toString().slice(0, 8)}...
                  </div>
                </>
              ) : (
                <Button
                  onClick={login}
                  size="small"
                >
                  Login with Internet Identity
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-sm text-gray-500">
            <p>© 2025 Guess the Spot. Built on Internet Computer</p>
          </div>
        </div>
      </footer>
    </div>
  )
}