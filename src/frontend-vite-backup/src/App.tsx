import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { useEffect } from 'react'
import Layout from './components/Layout'
import Home from './pages/Home'
import Game from './pages/Game'
import Upload from './pages/Upload'
import Camera from './pages/Camera'
import CameraUpload from './pages/CameraUpload'
import Leaderboard from './pages/Leaderboard'
import Profile from './pages/Profile'
import Whitepaper from './pages/Whitepaper'
import { useAuthStore } from './store/authStore'
import { PWAInstallPrompt, PWAUpdatePrompt, ErrorBoundary } from './components'
import { useReferralCode } from './hooks'

function AppContent() {
  const { checkAuth } = useAuthStore()
  
  // Handle referral codes from URL
  useReferralCode()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="game" element={<Game />} />
        <Route path="upload" element={<Upload />} />
        <Route path="camera" element={<Camera />} />
        <Route path="camera-upload" element={<CameraUpload />} />
        <Route path="leaderboard" element={<Leaderboard />} />
        <Route path="profile" element={<Profile />} />
        <Route path="whitepaper" element={<Whitepaper />} />
      </Route>
    </Routes>
  )
}

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <AppContent />
        <PWAInstallPrompt />
        <PWAUpdatePrompt />
      </Router>
    </ErrorBoundary>
  )
}

export default App