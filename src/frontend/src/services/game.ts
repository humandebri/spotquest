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
  private identity: Identity | null = null;
  private initialized = false;
  
  constructor() {
    // Constructor no longer initializes actor
  }

  async init(identity: Identity) {
    if (!identity) {
      throw new Error('No identity provided');
    }

    // Reuse existing actor if identity hasn't changed
    if (this.identity === identity && this.actor) {
      return;
    }

    this.identity = identity;
    await this.initializeActor(identity);
    this.initialized = true;
  }

  private async initializeActor(identity: Identity) {
    
    // メインネット環境のみを使用
    const agent = new HttpAgent({
      identity,
      host: process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app',
      // dev環境では証明書検証をスキップ（falseに設定）
      verifyQuerySignatures: false,
    });

    // fetchRootKeyはローカルレプリカでのみ実行（mainnetでは不要）
    // mainnetを使用しているため、fetchRootKeyは実行しない
    // if (process.env.NODE_ENV === 'development') {
    //   await agent.fetchRootKey();
    // }

    // メインネットの統合canister IDを使用
    const canisterId = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

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
          winRate: IDL.Float64,
          currentStreak: IDL.Nat,
          longestStreak: IDL.Nat,
          reputation: IDL.Float64,
          totalGuesses: IDL.Nat,
        })], ['query']),
        
        // Admin functions (for dev mode)
        adminMint: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Variant({
          ok: IDL.Nat,
          err: IDL.Text,
        })], []),
        
        // Debug functions
        debugGetTokenInfo: IDL.Func([], [IDL.Record({
          totalSupply: IDL.Nat,
          balanceCount: IDL.Nat,
          firstFiveBalances: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
        })], ['query']),
      });
    };

    this.actor = Actor.createActor(idlFactory, {
      agent,
      canisterId,
    });
  }

  async createSession(): Promise<{ ok?: string; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    // Always use real backend data, no mock data
    
    try {
      const result = await this.actor.createSession();
      return result;
    } catch (error) {
      console.error('Failed to create session:', error);
      return { err: 'Failed to create session' };
    }
  }

  async getNextRound(sessionId: string): Promise<any> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    // Always use real backend data, no mock data
    
    try {
      const result = await this.actor.getNextRound(sessionId);
      return result;
    } catch (error) {
      console.error('Failed to get next round:', error);
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
    } catch (error) {
      console.error('Failed to submit guess:', error);
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
    
    // Always use real backend data, no mock data
    
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
          error.message && error.message.includes('certificate')) {
        console.warn('Dev mode: Certificate verification failed. Consider using Internet Identity for production access.');
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
          error.message && error.message.includes('certificate')) {
        console.warn('Dev mode: Certificate verification failed. Consider using Internet Identity for production access.');
      } else {
        console.error('Failed to get player stats:', error);
      }
      return null;
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