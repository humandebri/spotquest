import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';
import { IDL } from '@dfinity/candid';

// Import IDL from unified canister (we'll create this)
// import { idlFactory } from '../../../../declarations/unified';

// GameEngineV2 types
export interface HintType {
  BasicRadius?: null;
  PremiumRadius?: null;
  DirectionHint?: null;
}

export interface HintContent {
  RadiusHint?: { centerLat: number; centerLon: number; radius: number };
  DirectionHint?: string;
}

export interface HintData {
  hintType: HintType;
  data: HintContent;
}

export interface SessionResult {
  sessionId: string;
  userId: Principal;
  totalScore: bigint;
  totalScoreNorm: bigint;
  completedRounds: bigint;
  totalRounds: bigint;
  playerReward: bigint;
  uploaderRewards: Array<[Principal, bigint]>;
  duration: bigint;
  rank: [] | [bigint];
}

class GameService {
  private actor: any;
  private agent: HttpAgent | null = null;
  private identity: Identity | null = null;
  private initialized = false;
  
  constructor() {
    // Constructor no longer initializes actor
  }

  async init(identity: Identity) {
    if (!identity) {
      throw new Error('No identity provided');
    }

    // Debug logging
    console.log('🎮 GameService.init called with identity:', {
      type: identity.constructor.name,
      principal: identity.getPrincipal().toString()
    });

    // Reuse existing actor if identity hasn't changed (but not for dev mode)
    const isDevMode = identity.constructor.name === 'Ed25519KeyIdentity';
    if (this.identity === identity && this.actor && !isDevMode) {
      console.log('🎮 Reusing existing actor');
      return;
    }
    
    // Dev modeでは常に新しいactorを作成（証明書エラー回避のため）
    if (isDevMode && this.actor) {
      console.log('🎮 DEV: Recreating actor with certificate bypass');
    }

    this.identity = identity;
    await this.initializeActor(identity);
    this.initialized = true;
  }

  private async initializeActor(identity: Identity) {
    try {
      // Dev modeの場合、特別な設定を使用
      const isDevMode = identity.constructor.name === 'Ed25519KeyIdentity';
      
      // Create HttpAgent with special configuration for dev mode
      const agentOptions: any = {
        identity,
        host: process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app',
        // dev環境では証明書検証をスキップ
        verifyQuerySignatures: false,
      };
      
      this.agent = new HttpAgent(agentOptions);
      
      // Dev modeの場合、earlyPatches.tsが証明書検証を処理
      if (isDevMode) {
        console.log('🎮 DEV: Using HttpAgent in dev mode (certificate verification handled by earlyPatches.ts)');
      }

      // fetchRootKeyはローカルレプリカでのみ実行（mainnetでは不要）
      // mainnetを使用しているため、fetchRootKeyは実行しない
      // if (process.env.NODE_ENV === 'development') {
      //   await this.agent.fetchRootKey();
      // }

      // メインネットの統合canister IDを使用
      const canisterId = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

      if (!canisterId) {
        throw new Error('Unified canister ID not found');
      }

    // IDL factory for unified canister
    const idlFactory = () => {
      // Define types
      const HintType = IDL.Variant({
        BasicRadius: IDL.Null,
        PremiumRadius: IDL.Null,
        DirectionHint: IDL.Null,
      });

      const HintContent = IDL.Variant({
        RadiusHint: IDL.Record({
          centerLat: IDL.Float64,
          centerLon: IDL.Float64,
          radius: IDL.Float64,
        }),
        DirectionHint: IDL.Text,
      });

      const HintData = IDL.Record({
        hintType: HintType,
        data: HintContent,
      });

      const RoundStatus = IDL.Variant({
        Active: IDL.Null,
        Completed: IDL.Null,
        Abandoned: IDL.Null,
      });

      const GuessData = IDL.Record({
        lat: IDL.Float64,
        lon: IDL.Float64,
        azimuth: IDL.Opt(IDL.Float64),
        confidenceRadius: IDL.Float64,
        submittedAt: IDL.Int,
      });

      const RoundState = IDL.Record({
        photoId: IDL.Nat,
        status: RoundStatus,
        score: IDL.Nat,
        scoreNorm: IDL.Nat,
        guessData: IDL.Opt(GuessData),
        retryAvailable: IDL.Bool,
        hintsPurchased: IDL.Vec(HintType),
        startTime: IDL.Int,
        endTime: IDL.Opt(IDL.Int),
      });

      const SessionResult = IDL.Record({
        sessionId: IDL.Text,
        userId: IDL.Principal,
        totalScore: IDL.Nat,
        totalScoreNorm: IDL.Nat,
        completedRounds: IDL.Nat,
        totalRounds: IDL.Nat,
        playerReward: IDL.Nat,
        uploaderRewards: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
        duration: IDL.Nat,
        rank: IDL.Opt(IDL.Nat),
      });

      const Account = IDL.Record({ 
        owner: IDL.Principal, 
        subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) 
      });
      
      const TransferArgs = IDL.Record({
        to: Account,
        fee: IDL.Opt(IDL.Nat),
        memo: IDL.Opt(IDL.Vec(IDL.Nat8)),
        from_subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
        created_at_time: IDL.Opt(IDL.Nat64),
        amount: IDL.Nat,
      });
      
      const TransferError = IDL.Variant({
        BadFee: IDL.Record({ expected_fee: IDL.Nat }),
        BadBurn: IDL.Record({ min_burn_amount: IDL.Nat }),
        InsufficientFunds: IDL.Record({ balance: IDL.Nat }),
        TooOld: IDL.Null,
        CreatedInFuture: IDL.Record({ ledger_time: IDL.Nat64 }),
        Duplicate: IDL.Record({ duplicate_of: IDL.Nat }),
        TemporarilyUnavailable: IDL.Null,
        GenericError: IDL.Record({ error_code: IDL.Nat, message: IDL.Text }),
      });
      
      const TransferResult = IDL.Variant({
        Ok: IDL.Nat,
        Err: TransferError,
      });

      const Result_Text = IDL.Variant({
        ok: IDL.Text,
        err: IDL.Text,
      });

      const Result_RoundState = IDL.Variant({
        ok: RoundState,
        err: IDL.Text,
      });

      const Result_HintData = IDL.Variant({
        ok: HintData,
        err: IDL.Text,
      });

      const Result_SessionResult = IDL.Variant({
        ok: SessionResult,
        err: IDL.Text,
      });

      return IDL.Service({
        // Game Engine functions
        createSession: IDL.Func([], [Result_Text], []),
        getNextRound: IDL.Func([IDL.Text], [Result_RoundState], []),
        submitGuess: IDL.Func(
          [IDL.Text, IDL.Float64, IDL.Float64, IDL.Opt(IDL.Float64), IDL.Float64], 
          [Result_RoundState], 
          []
        ),
        purchaseHint: IDL.Func([IDL.Text, HintType], [Result_HintData], []),
        finalizeSession: IDL.Func([IDL.Text], [Result_SessionResult], []),
        
        // Token functions
        icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
        icrc1_transfer: IDL.Func([TransferArgs], [TransferResult], []),
        icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
        icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
        
        // Player stats
        getPlayerStats: IDL.Func([IDL.Principal], [IDL.Record({
          totalGamesPlayed: IDL.Nat,
          totalPhotosUploaded: IDL.Nat,
          totalRewardsEarned: IDL.Nat,
          bestScore: IDL.Nat,
          averageScore: IDL.Nat,
          averageScore30Days: IDL.Opt(IDL.Nat),
          rank: IDL.Opt(IDL.Nat),
          currentStreak: IDL.Nat,
          longestStreak: IDL.Nat,
          reputation: IDL.Float64,
          totalGuesses: IDL.Nat,
        })], ['query']),
        
        // Ranking functions
        getPlayerRank: IDL.Func([IDL.Principal], [IDL.Opt(IDL.Nat)], ['query']),
        getLeaderboard: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat))], ['query']),
        
        // Admin functions (for dev mode)
        adminMint: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Variant({
          ok: IDL.Nat,
          err: IDL.Text,
        })], []),
        getOwner: IDL.Func([], [IDL.Principal], ['query']),
        
        // Debug functions
        debugGetTokenInfo: IDL.Func([], [IDL.Record({
          totalSupply: IDL.Nat,
          balanceCount: IDL.Nat,
          firstFiveBalances: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
        })], ['query']),
      });
    };

      // Actor作成
      this.actor = Actor.createActor(idlFactory, {
        agent: this.agent,
        canisterId,
      });
      
      if (isDevMode) {
        console.log('🎮 DEV: Actor created in dev mode - mock responses will be used for network errors');
      }
    } catch (error) {
      console.error('Failed to initialize game service actor:', error);
      throw error;
    }
  }

  async createSession(): Promise<{ ok?: string; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('🎮 Calling createSession...');
      const result = await this.actor.createSession();
      console.log('🎮 createSession result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to create session:', error);
      // In dev mode, return mock session ID if the error is network-related
      if (this.identity?.constructor.name === 'Ed25519KeyIdentity' && 
          (error.message.includes('unreachable') || error.message.includes('certificate'))) {
        console.log('🎮 DEV: Returning mock session for dev mode');
        return { ok: `dev-session-${Date.now()}` };
      }
      return { err: error.message || 'Failed to create session' };
    }
  }

  async getNextRound(sessionId: string): Promise<any> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.getNextRound(sessionId);
      return result;
    } catch (error: any) {
      console.error('Failed to get next round:', error);
      // In dev mode, return mock round data
      if (this.identity?.constructor.name === 'Ed25519KeyIdentity' && 
          (error.message.includes('unreachable') || error.message.includes('certificate'))) {
        console.log('🎮 DEV: Returning mock round for dev mode');
        return {
          ok: {
            photoId: BigInt(Math.floor(Math.random() * 1000) + 1),
            status: { Active: null },
            score: BigInt(0),
            scoreNorm: BigInt(0),
            guessData: [],
            retryAvailable: false,
            hintsPurchased: [],
            startTime: BigInt(Date.now() * 1000000),
            endTime: [],
          }
        };
      }
      return { err: 'Failed to get next round' };
    }
  }

  async submitGuess(
    sessionId: string,
    guessLat: number,
    guessLon: number,
    guessAzimuth: number | null,
    confidenceRadius: number
  ): Promise<any> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    try {
      const result = await this.actor.submitGuess(
        sessionId,
        guessLat,
        guessLon,
        guessAzimuth ? [guessAzimuth] : [],
        confidenceRadius
      );
      return result;
    } catch (error: any) {
      console.error('Failed to submit guess:', error);
      // In dev mode, return mock submission result
      if (this.identity?.constructor.name === 'Ed25519KeyIdentity' && 
          (error.message.includes('unreachable') || error.message.includes('certificate'))) {
        console.log('🎮 DEV: Returning mock submission for dev mode');
        return {
          ok: {
            photoId: BigInt(Math.floor(Math.random() * 1000) + 1),
            status: { Completed: null },
            score: BigInt(Math.floor(Math.random() * 5000)),
            scoreNorm: BigInt(Math.floor(Math.random() * 100)),
            guessData: [{
              lat: guessLat,
              lon: guessLon,
              azimuth: guessAzimuth ? [guessAzimuth] : [],
              confidenceRadius,
              submittedAt: BigInt(Date.now() * 1000000),
            }],
            retryAvailable: false,
            hintsPurchased: [],
            startTime: BigInt(Date.now() * 1000000 - 60000000000),
            endTime: [BigInt(Date.now() * 1000000)],
          }
        };
      }
      return { err: 'Failed to submit guess' };
    }
  }

  async purchaseHint(sessionId: string, hintType: HintType): Promise<{ ok?: HintData; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    try {
      const result = await this.actor.purchaseHint(sessionId, hintType);
      return result;
    } catch (error) {
      console.error('Failed to purchase hint:', error);
      return { err: 'Failed to purchase hint' };
    }
  }

  async finalizeSession(sessionId: string): Promise<{ ok?: SessionResult; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.finalizeSession(sessionId);
      return result;
    } catch (error) {
      console.error('Failed to finalize session:', error);
      return { err: 'Failed to finalize session' };
    }
  }

  async getTokenBalance(principal: Principal): Promise<bigint> {
    if (!this.initialized || !this.actor) {
      return BigInt(0);
    }
    
    try {
      const balance = await this.actor.icrc1_balance_of({ 
        owner: principal,
        subaccount: []
      });
      return balance;
    } catch (error: any) {
      if (this.identity?.constructor.name === 'Ed25519KeyIdentity' && 
          (error.message.includes('unreachable') || error.message.includes('certificate'))) {
        console.log('🎮 DEV: Returning mock balance for dev mode');
        return BigInt(10000); // 100.00 SPOT
      } else {
        console.error('Failed to get token balance:', error);
      }
      return BigInt(0);
    }
  }

  async getPlayerStats(principal: Principal): Promise<any> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const stats = await this.actor.getPlayerStats(principal);
      return stats;
    } catch (error: any) {
      if (this.identity?.constructor.name === 'Ed25519KeyIdentity' && 
          (error.message.includes('unreachable') || error.message.includes('certificate'))) {
        console.log('🎮 DEV: Returning mock stats for dev mode');
        return {
          totalGamesPlayed: BigInt(5),
          totalPhotosUploaded: BigInt(3),
          totalRewardsEarned: BigInt(1500),
          bestScore: BigInt(4500),
          averageScore: BigInt(3200),
          averageScore30Days: [BigInt(3500)],
          rank: [BigInt(42)],
          currentStreak: BigInt(2),
          longestStreak: BigInt(5),
          reputation: 4.5,
          totalGuesses: BigInt(5),
        };
      } else {
        console.error('Failed to get player stats:', error);
      }
      return null;
    }
  }

  // Admin function for dev mode minting
  async adminMint(to: Principal, amount: bigint): Promise<{ ok?: bigint; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('🔧 DEV: Calling adminMint for', to.toString(), 'amount:', amount);
      const result = await this.actor.adminMint(to, amount);
      console.log('🔧 DEV: adminMint result:', result);
      return result;
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      return { err: `Failed to mint tokens: ${error}` };
    }
  }

  // Hint cost constants (matching backend)
  getHintCost(hintType: string): number {
    switch (hintType) {
      case 'BasicRadius':
        return 100; // 1.00 SPOT
      case 'PremiumRadius':
        return 300; // 3.00 SPOT
      case 'DirectionHint':
        return 100; // 1.00 SPOT
      default:
        return 0;
    }
  }
}

export const gameService = new GameService();