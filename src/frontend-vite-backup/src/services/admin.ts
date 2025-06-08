// Temporary mock admin service for development/demo
class AdminService {

  async getDashboardStats() {
    // Return mock data for now
    return {
      totalUsers: 152,
      activeGames: 3,
      totalPhotos: 47,
      totalRewards: 2580,
      tokenSupply: 10000,
      playFee: 10,
      baseReward: 100,
      uploaderRewardRatio: 0.3,
    }
  }

  async getActiveGames() {
    // Return mock data for now
    return [
      {
        id: 1,
        photoId: 123,
        totalPlayers: 12,
        totalRewards: 1200,
        startTime: Date.now() - 3600000, // 1 hour ago
      },
      {
        id: 2,
        photoId: 124,
        totalPlayers: 8,
        totalRewards: 800,
        startTime: Date.now() - 1800000, // 30 minutes ago
      },
    ]
  }

  async endGameRound(gameId: number) {
    console.log('Ending game round:', gameId)
    return true
  }

  async getAllPhotos() {
    // Return mock data for now
    return [
      {
        id: 123,
        owner: 'lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe',
        quality: 0.85,
        uploadTime: Date.now() * 1000000, // Convert to nanoseconds
      },
      {
        id: 124,
        owner: 'abc12-34def-56ghi-78jkl-90mno-pqrst-uvwxy-z1234-56789-abcde-fgh',
        quality: 0.92,
        uploadTime: (Date.now() - 86400000) * 1000000, // Yesterday
      },
    ]
  }

  async deletePhoto(photoId: number) {
    console.log('Deleting photo:', photoId)
    return true
  }

  async getAllUsers() {
    // Return mock data for now
    return [
      {
        principal: 'lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe',
        totalUploads: 5,
        totalPlays: 23,
        uploaderScore: 0.95,
        playerScore: 0.78,
        isBanned: false,
      },
      {
        principal: 'abc12-34def-56ghi-78jkl-90mno-pqrst-uvwxy-z1234-56789-abcde-fgh',
        totalUploads: 12,
        totalPlays: 67,
        uploaderScore: 0.88,
        playerScore: 0.92,
        isBanned: false,
      },
    ]
  }

  async banUser(principalStr: string, reason: string) {
    console.log('Banning user:', principalStr, 'Reason:', reason)
    return true
  }

  async unbanUser(principalStr: string) {
    console.log('Unbanning user:', principalStr)
    return true
  }

  async updateSystemSettings(settings: {
    playFee: number
    baseReward: number
    uploaderRewardRatio: number
  }) {
    console.log('Updating system settings:', settings)
    return true
  }
}

export const adminService = new AdminService()