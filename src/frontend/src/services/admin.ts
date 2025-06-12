import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

// 管理用のIDL定義（実際のIDLに合わせて更新が必要）
const adminIdlFactory = ({ IDL }: any) => {
  // ユーザー管理
  const UserReputation = IDL.Record({
    user: IDL.Principal,
    uploaderScore: IDL.Float64,
    playerScore: IDL.Float64,
    totalUploads: IDL.Nat,
    totalPlays: IDL.Nat,
    isBanned: IDL.Bool,
    banReason: IDL.Opt(IDL.Text),
    lastUpdated: IDL.Int,
  });

  // ゲーム管理
  const GameRound = IDL.Record({
    id: IDL.Nat,
    photoId: IDL.Nat,
    startTime: IDL.Int,
    endTime: IDL.Opt(IDL.Int),
    correctLat: IDL.Float64,
    correctLon: IDL.Float64,
    totalPlayers: IDL.Nat,
    totalRewards: IDL.Nat,
  });

  // 写真管理
  const PhotoMeta = IDL.Record({
    id: IDL.Nat,
    owner: IDL.Principal,
    lat: IDL.Float64,
    lon: IDL.Float64,
    azim: IDL.Float64,
    timestamp: IDL.Int,
    quality: IDL.Float64,
    uploadTime: IDL.Int,
    chunkCount: IDL.Nat,
    totalSize: IDL.Nat,
    perceptualHash: IDL.Opt(IDL.Text),
  });

  const PhotoReputation = IDL.Record({
    photoId: IDL.Nat,
    owner: IDL.Principal,
    qualityScore: IDL.Float64,
    totalGuesses: IDL.Nat,
    correctGuesses: IDL.Nat,
    reportCount: IDL.Nat,
    lastUpdated: IDL.Int,
    isBanned: IDL.Bool,
  });

  // システム統計
  const SystemStats = IDL.Record({
    totalUsers: IDL.Nat,
    activeGames: IDL.Nat,
    totalPhotos: IDL.Nat,
    totalRewards: IDL.Nat,
    tokenSupply: IDL.Nat,
    playFee: IDL.Nat,
    baseReward: IDL.Nat,
    uploaderRewardRatio: IDL.Float64,
  });

  return IDL.Service({
    // 管理者確認
    getOwner: IDL.Func([], [IDL.Principal], ['query']),
    setOwner: IDL.Func([IDL.Principal], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),

    // 統計情報
    getSystemStats: IDL.Func([], [SystemStats], ['query']),
    
    // ユーザー管理
    getAllUsers: IDL.Func([], [IDL.Vec(UserReputation)], ['query']),
    getUserReputation: IDL.Func([IDL.Principal], [IDL.Opt(UserReputation)], ['query']),
    banUser: IDL.Func([IDL.Principal, IDL.Text], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    unbanUser: IDL.Func([IDL.Principal], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    
    // ゲーム管理
    getActiveRounds: IDL.Func([], [IDL.Vec(GameRound)], ['query']),
    getCompletedRounds: IDL.Func([IDL.Nat], [IDL.Vec(GameRound)], ['query']),
    endGameRound: IDL.Func([IDL.Nat], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    
    // 写真管理
    getAllPhotos: IDL.Func([], [IDL.Vec(PhotoMeta)], ['query']),
    getPhotoReputation: IDL.Func([IDL.Nat], [IDL.Opt(PhotoReputation)], ['query']),
    deletePhoto: IDL.Func([IDL.Nat], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    
    // システム設定
    setPlayFee: IDL.Func([IDL.Nat], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    setBaseReward: IDL.Func([IDL.Nat], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
    setUploaderRewardRatio: IDL.Func([IDL.Float64], [IDL.Variant({ ok: IDL.Text, err: IDL.Text })], []),
  });
};

class AdminService {
  private actor: any;
  private agent: HttpAgent | null = null;
  private identity: Identity | null = null;

  // Initialize with identity from expo-ii-integration
  async init(identity: Identity) {
    try {
      if (!identity) {
        throw new Error('No identity provided');
      }

      // Reuse existing actor if identity hasn't changed
      if (this.identity === identity && this.actor) {
        return;
      }

      this.identity = identity;
      this.agent = new HttpAgent({
        identity,
        host: process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app',
        // dev環境では証明書検証をスキップ（falseに設定）
        verifyQuerySignatures: false,
      });

      // fetchRootKeyはローカルレプリカでのみ実行（mainnetでは不要）
      // mainnetを使用しているため、fetchRootKeyは実行しない
      // if (process.env.NODE_ENV === 'development') {
      //   await this.agent.fetchRootKey();
      // }

      const canisterId = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID;
      if (!canisterId) {
        throw new Error('Unified canister ID not found');
      }

      this.actor = Actor.createActor(adminIdlFactory, {
        agent: this.agent,
        canisterId,
      });
    } catch (error) {
      console.error('Failed to initialize admin service:', error);
      throw error;
    }
  }

  // 統計情報の取得
  async getDashboardStats(identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const stats = await this.actor.getSystemStats();
      return {
        totalUsers: Number(stats.totalUsers),
        activeGames: Number(stats.activeGames),
        totalPhotos: Number(stats.totalPhotos),
        totalRewards: Number(stats.totalRewards),
        tokenSupply: Number(stats.tokenSupply),
        playFee: Number(stats.playFee),
        baseReward: Number(stats.baseReward),
        uploaderRewardRatio: Number(stats.uploaderRewardRatio),
      };
    } catch (error) {
      console.error('Failed to get dashboard stats:', error);
      // ダミーデータを返す（開発用）
      return {
        totalUsers: 0,
        activeGames: 0,
        totalPhotos: 0,
        totalRewards: 0,
        tokenSupply: 0,
        playFee: 10,
        baseReward: 100,
        uploaderRewardRatio: 0.3,
      };
    }
  }

  // ユーザー管理
  async getAllUsers(identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const users = await this.actor.getAllUsers();
      return users.map((user: any) => ({
        principal: user.user.toString(),
        uploaderScore: Number(user.uploaderScore),
        playerScore: Number(user.playerScore),
        totalUploads: Number(user.totalUploads),
        totalPlays: Number(user.totalPlays),
        isBanned: user.isBanned,
        banReason: user.banReason.length > 0 ? user.banReason[0] : null,
      }));
    } catch (error) {
      console.error('Failed to get users:', error);
      return [];
    }
  }

  async banUser(principal: string, reason: string, identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const result = await this.actor.banUser(Principal.fromText(principal), reason);
      if ('err' in result) {
        throw new Error(result.err);
      }
      return result.ok;
    } catch (error) {
      console.error('Failed to ban user:', error);
      throw error;
    }
  }

  async unbanUser(principal: string, identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const result = await this.actor.unbanUser(Principal.fromText(principal));
      if ('err' in result) {
        throw new Error(result.err);
      }
      return result.ok;
    } catch (error) {
      console.error('Failed to unban user:', error);
      throw error;
    }
  }

  // ゲーム管理
  async getActiveGames(identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const games = await this.actor.getActiveRounds();
      return games.map((game: any) => ({
        id: Number(game.id),
        photoId: Number(game.photoId),
        startTime: Number(game.startTime),
        endTime: game.endTime.length > 0 ? Number(game.endTime[0]) : null,
        totalPlayers: Number(game.totalPlayers),
        totalRewards: Number(game.totalRewards),
      }));
    } catch (error) {
      console.error('Failed to get active games:', error);
      return [];
    }
  }

  async endGameRound(gameId: number, identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const result = await this.actor.endGameRound(gameId);
      if ('err' in result) {
        throw new Error(result.err);
      }
      return result.ok;
    } catch (error) {
      console.error('Failed to end game round:', error);
      throw error;
    }
  }

  // 写真管理
  async getAllPhotos(identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const photos = await this.actor.getAllPhotos();
      return photos.map((photo: any) => ({
        id: Number(photo.id),
        owner: photo.owner.toString(),
        lat: Number(photo.lat),
        lon: Number(photo.lon),
        azim: Number(photo.azim),
        quality: Number(photo.quality),
        uploadTime: Number(photo.uploadTime),
      }));
    } catch (error) {
      console.error('Failed to get photos:', error);
      return [];
    }
  }

  async deletePhoto(photoId: number, identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      const result = await this.actor.deletePhoto(photoId);
      if ('err' in result) {
        throw new Error(result.err);
      }
      return result.ok;
    } catch (error) {
      console.error('Failed to delete photo:', error);
      throw error;
    }
  }

  // システム設定
  async updateSystemSettings(settings: {
    playFee?: number;
    baseReward?: number;
    uploaderRewardRatio?: number;
  }, identity?: Identity) {
    try {
      if (!this.actor && identity) await this.init(identity);
      
      const results = await Promise.all([
        settings.playFee !== undefined ? this.actor.setPlayFee(settings.playFee) : null,
        settings.baseReward !== undefined ? this.actor.setBaseReward(settings.baseReward) : null,
        settings.uploaderRewardRatio !== undefined 
          ? this.actor.setUploaderRewardRatio(settings.uploaderRewardRatio / 100)
          : null,
      ]);

      // エラーチェック
      for (const result of results) {
        if (result && 'err' in result) {
          throw new Error(result.err);
        }
      }

      return 'Settings updated successfully';
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  }
}

export const adminService = new AdminService();