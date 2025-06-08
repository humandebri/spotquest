import { useState, useEffect } from 'react'
import { useAuthStore } from '../store/authStore'
import { useNavigate } from 'react-router-dom'
import { 
  Shield, 
  Users, 
  Camera, 
  Gamepad2 as GameController2, 
  Settings,
  TrendingUp,
  Loader2
} from 'lucide-react'
import { Card, Button, StatCard } from '../components'
import { adminService } from '../services/admin'

const TABS = [
  { id: 'dashboard', name: 'Dashboard', icon: TrendingUp },
  { id: 'games', name: 'Games', icon: GameController2 },
  { id: 'photos', name: 'Photos', icon: Camera },
  { id: 'users', name: 'Users', icon: Users },
  { id: 'settings', name: 'Settings', icon: Settings },
]

export default function Admin() {
  const navigate = useNavigate()
  const { isAdmin } = useAuthStore()
  const [activeTab, setActiveTab] = useState('dashboard')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeGames: 0,
    totalPhotos: 0,
    totalRewards: 0,
    tokenSupply: 0,
    playFee: 10,
    baseReward: 100,
    uploaderRewardRatio: 0.3,
  })

  // Redirect if not admin
  useEffect(() => {
    if (!isAdmin) {
      navigate('/')
    } else {
      loadDashboardData()
    }
  }, [isAdmin, navigate])

  const loadDashboardData = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await adminService.getDashboardStats()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      )
    }

    switch (activeTab) {
      case 'dashboard':
        return <DashboardTab stats={stats} />
      case 'games':
        return <GamesTab />
      case 'photos':
        return <PhotosTab />
      case 'users':
        return <UsersTab />
      case 'settings':
        return <SettingsTab stats={stats} onUpdate={loadDashboardData} />
      default:
        return null
    }
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center mb-8">
        <Shield className="w-8 h-8 text-primary-500 mr-3" />
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-900/50 border border-red-700 rounded-lg text-red-200">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex space-x-1 mb-8 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-700 text-dark-300 hover:bg-dark-600'
              }`}
            >
              <Icon className="w-4 h-4 mr-2" />
              {tab.name}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  )
}

// Dashboard Tab Component
function DashboardTab({ stats }: { stats: any }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold mb-4">Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users"
            value={stats.totalUsers.toLocaleString()}
            icon={<Users className="w-6 h-6" />}
            trend={{ value: 12.5, isPositive: true }}
          />
          <StatCard
            label="Active Games"
            value={stats.activeGames}
            icon={<GameController2 className="w-6 h-6" />}
            trend={{ value: 5.2, isPositive: true }}
          />
          <StatCard
            label="Total Photos"
            value={stats.totalPhotos.toLocaleString()}
            icon={<Camera className="w-6 h-6" />}
            trend={{ value: 8.7, isPositive: true }}
          />
          <StatCard
            label="Total Rewards"
            value={`${stats.totalRewards.toLocaleString()} SPOT`}
            icon={<TrendingUp className="w-6 h-6" />}
            trend={{ value: 15.3, isPositive: true }}
          />
        </div>
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">System Status</h3>
        <Card className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-dark-400 mb-1">Token Supply</p>
              <p className="text-2xl font-bold">{stats.tokenSupply.toLocaleString()} SPOT</p>
            </div>
            <div>
              <p className="text-dark-400 mb-1">Play Fee</p>
              <p className="text-2xl font-bold">{stats.playFee} SPOT</p>
            </div>
            <div>
              <p className="text-dark-400 mb-1">Base Reward</p>
              <p className="text-2xl font-bold">{stats.baseReward} SPOT</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

// Simple DataTable Component
function DataTable({ data, columns }: { data: any[]; columns: any[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-dark-800 rounded-lg overflow-hidden">
        <thead className="bg-dark-700">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-6 py-3 text-left text-xs font-medium text-dark-300 uppercase tracking-wider">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-dark-600">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-dark-700">
              {columns.map((col) => (
                <td key={col.key} className="px-6 py-4 whitespace-nowrap text-sm text-dark-200">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// Simple Modal Component
function Modal({ isOpen, onClose, title, children }: any) {
  if (!isOpen) return null
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity" onClick={onClose}></div>
        <div className="inline-block align-bottom bg-dark-800 rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-dark-800 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <h3 className="text-lg leading-6 font-medium text-white mb-4">{title}</h3>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

// Games Tab Component
function GamesTab() {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGames()
  }, [])

  const loadGames = async () => {
    try {
      const data = await adminService.getActiveGames()
      setGames(data)
    } catch (err) {
      console.error('Failed to load games:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleEndGame = async (gameId: number) => {
    if (confirm('Are you sure you want to end this game?')) {
      try {
        await adminService.endGameRound(gameId)
        loadGames()
      } catch (err) {
        alert('Failed to end game')
      }
    }
  }

  const columns = [
    { key: 'id', label: 'Game ID' },
    { key: 'photoId', label: 'Photo ID' },
    { key: 'totalPlayers', label: 'Players' },
    { key: 'totalRewards', label: 'Rewards' },
    {
      key: 'actions',
      label: 'Actions',
      render: (game: any) => (
        <Button
          size="small"
          variant="secondary"
          onClick={() => handleEndGame(game.id)}
        >
          End Game
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Active Games</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <DataTable data={games} columns={columns} />
      )}
    </div>
  )
}

// Photos Tab Component
function PhotosTab() {
  const [photos, setPhotos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPhotos()
  }, [])

  const loadPhotos = async () => {
    try {
      const data = await adminService.getAllPhotos()
      setPhotos(data)
    } catch (err) {
      console.error('Failed to load photos:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeletePhoto = async (photoId: number) => {
    if (confirm('Are you sure you want to delete this photo?')) {
      try {
        await adminService.deletePhoto(photoId)
        loadPhotos()
      } catch (err) {
        alert('Failed to delete photo')
      }
    }
  }

  const columns = [
    { key: 'id', label: 'Photo ID' },
    { key: 'owner', label: 'Owner', render: (photo: any) => photo.owner.slice(0, 8) + '...' },
    { key: 'quality', label: 'Quality', render: (photo: any) => `${(photo.quality * 100).toFixed(0)}%` },
    {
      key: 'uploadTime',
      label: 'Uploaded',
      render: (photo: any) => new Date(Number(photo.uploadTime) / 1000000).toLocaleDateString(),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (photo: any) => (
        <Button
          size="small"
          variant="secondary"
          onClick={() => handleDeletePhoto(photo.id)}
          className="text-red-500 hover:text-red-400"
        >
          Delete
        </Button>
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Photos</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <DataTable data={photos} columns={columns} />
      )}
    </div>
  )
}

// Users Tab Component
function UsersTab() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [banModal, setBanModal] = useState<{ open: boolean; user: any }>({ open: false, user: null })
  const [banReason, setBanReason] = useState('')

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    try {
      const data = await adminService.getAllUsers()
      setUsers(data)
    } catch (err) {
      console.error('Failed to load users:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleBanUser = async () => {
    if (!banModal.user || !banReason.trim()) return
    
    try {
      await adminService.banUser(banModal.user.principal, banReason)
      setBanModal({ open: false, user: null })
      setBanReason('')
      loadUsers()
    } catch (err) {
      alert('Failed to ban user')
    }
  }

  const handleUnbanUser = async (principal: string) => {
    if (confirm('Are you sure you want to unban this user?')) {
      try {
        await adminService.unbanUser(principal)
        loadUsers()
      } catch (err) {
        alert('Failed to unban user')
      }
    }
  }

  const columns = [
    { key: 'principal', label: 'Principal', render: (user: any) => user.principal.slice(0, 8) + '...' },
    { key: 'totalUploads', label: 'Uploads' },
    { key: 'totalPlays', label: 'Games' },
    { key: 'uploaderScore', label: 'Upload Score', render: (user: any) => user.uploaderScore.toFixed(2) },
    { key: 'playerScore', label: 'Player Score', render: (user: any) => user.playerScore.toFixed(2) },
    {
      key: 'status',
      label: 'Status',
      render: (user: any) => (
        <span className={`px-2 py-1 rounded text-sm ${
          user.isBanned ? 'bg-red-900/50 text-red-400' : 'bg-green-900/50 text-green-400'
        }`}>
          {user.isBanned ? 'Banned' : 'Active'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      render: (user: any) => (
        user.isBanned ? (
          <Button
            size="small"
            variant="secondary"
            onClick={() => handleUnbanUser(user.principal)}
          >
            Unban
          </Button>
        ) : (
          <Button
            size="small"
            variant="secondary"
            onClick={() => setBanModal({ open: true, user })}
            className="text-red-500 hover:text-red-400"
          >
            Ban
          </Button>
        )
      ),
    },
  ]

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">Users</h2>
      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
      ) : (
        <DataTable data={users} columns={columns} />
      )}

      {/* Ban Modal */}
      <Modal
        isOpen={banModal.open}
        onClose={() => setBanModal({ open: false, user: null })}
        title="Ban User"
      >
        <div className="space-y-4">
          <p className="text-dark-300">
            Ban user: {banModal.user?.principal.slice(0, 12)}...
          </p>
          <div>
            <label className="block text-sm font-medium mb-2">Ban Reason</label>
            <textarea
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
              rows={3}
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
              placeholder="Enter reason for ban..."
            />
          </div>
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => setBanModal({ open: false, user: null })}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleBanUser}
              disabled={!banReason.trim()}
            >
              Ban User
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Settings Tab Component
function SettingsTab({ stats, onUpdate }: { stats: any; onUpdate: () => void }) {
  const [settings, setSettings] = useState({
    playFee: stats.playFee.toString(),
    baseReward: stats.baseReward.toString(),
    uploaderRewardRatio: (stats.uploaderRewardRatio * 100).toString(),
  })
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await adminService.updateSystemSettings({
        playFee: parseInt(settings.playFee),
        baseReward: parseInt(settings.baseReward),
        uploaderRewardRatio: parseFloat(settings.uploaderRewardRatio),
      })
      alert('Settings saved successfully')
      onUpdate()
    } catch (err) {
      alert('Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold mb-6">System Settings</h2>
      <Card className="p-6 max-w-2xl">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium mb-2">Play Fee (SPOT)</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
              value={settings.playFee}
              onChange={(e) => setSettings({ ...settings, playFee: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Base Reward (SPOT)</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
              value={settings.baseReward}
              onChange={(e) => setSettings({ ...settings, baseReward: e.target.value })}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Uploader Reward Ratio (%)</label>
            <input
              type="number"
              className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg focus:outline-none focus:border-primary-500"
              value={settings.uploaderRewardRatio}
              onChange={(e) => setSettings({ ...settings, uploaderRewardRatio: e.target.value })}
              min="0"
              max="100"
            />
          </div>

          <Button
            variant="primary"
            onClick={handleSave}
            disabled={saving}
            className="w-full"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Settings'
            )}
          </Button>
        </div>
      </Card>
    </div>
  )
}