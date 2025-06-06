import { useState } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import Button from './Button'
import NavLink from './NavLink'
import MobileMenu from './MobileMenu'
import LoginModal from './LoginModal'

export default function Layout() {
  const { isAuthenticated, principal, logout } = useAuthStore()
  const [showLoginModal, setShowLoginModal] = useState(false)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center">
                <svg className="w-8 h-8 mr-2 text-primary-600" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                </svg>
                <span className="text-xl font-bold text-primary-600">Guess the Spot</span>
              </Link>
              
              <div className="hidden sm:ml-8 sm:flex sm:space-x-8">
                <NavLink to="/">Home</NavLink>
                <NavLink to="/game">Play</NavLink>
                <NavLink to="/upload">Upload</NavLink>
                <NavLink to="/leaderboard">Leaderboard</NavLink>
              </div>
            </div>

            <div className="flex items-center">
              <div className="hidden sm:flex sm:items-center sm:space-x-4">
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
                    onClick={() => setShowLoginModal(true)}
                    size="small"
                  >
                    Connect Wallet
                  </Button>
                )}
              </div>
              <MobileMenu 
                isAuthenticated={isAuthenticated}
                onLogin={() => setShowLoginModal(true)}
                onLogout={logout}
              />
            </div>
          </div>
        </div>
      </nav>

      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
      />

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center space-y-4">
            <div className="flex space-x-6 text-sm">
              <Link to="/whitepaper" className="text-gray-500 hover:text-primary-600 transition-colors">
                Whitepaper
              </Link>
              <a 
                href="https://github.com/anthropics/guess-the-spot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-primary-600 transition-colors"
              >
                GitHub
              </a>
              <a 
                href="https://discord.gg/guess-the-spot" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-gray-500 hover:text-primary-600 transition-colors"
              >
                Discord
              </a>
            </div>
            <p className="text-sm text-gray-500">© 2025 Guess the Spot. Built on Internet Computer</p>
          </div>
        </div>
      </footer>
    </div>
  )
}