import { Actor, HttpAgent, Identity } from '@dfinity/agent';
import { CustomPrincipal as Principal } from '../utils/principal';
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

export interface SessionInfo {
  id: string;
  players: any[];
  status: 'Active' | 'Completed' | 'Abandoned';
  createdAt: bigint;
  roundCount: bigint;
  currentRound: [] | [bigint];
}

export interface SessionResult {
  sessionId: string;
  userId: any;
  totalScore: bigint;
  totalScoreNorm: bigint;
  completedRounds: bigint;
  totalRounds: bigint;
  playerReward: bigint;
  uploaderRewards: Array<[any, bigint]>;
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
      const host = process.env.EXPO_PUBLIC_IC_HOST || 'https://ic0.app';
      console.log('🎮 Creating HttpAgent with host:', host);
      
      const agentOptions: any = {
        identity,
        host,
        // 署名検証を有効化（正しいプリンシパルを使用）
        verifyQuerySignatures: true,
        // API v3を有効化して高速化
        useQueryNonces: true,
        retryTimes: 3,
        // Fetch options for timeout and performance
        fetchOptions: {
          reactNative: {
            // React Native用の最適化
            __nativeResponseType: 'base64',
          },
        },
      };
      
      this.agent = new HttpAgent(agentOptions);
      
      // メインネットの統合canister IDを使用
      const canisterId = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';
      
      // Log agent configuration
      console.log('🎮 HttpAgent created:', {
        host: host,
        identity: identity.getPrincipal().toString(),
        isDevMode,
      });
      
      // Dev modeの場合、追加のデバッグログ
      if (isDevMode) {
        console.log('🎮 DEV: Agent initialized in dev mode');
        console.log('🎮 DEV: Agent configuration:', {
          host,
          canisterId,
          verifyQuerySignatures: true,
        });
      }

      // fetchRootKeyはローカルレプリカでのみ実行（mainnetでは不要）
      // mainnetを使用しているため、fetchRootKeyは実行しない
      // if (process.env.NODE_ENV === 'development') {
      //   await this.agent.fetchRootKey();
      // }
      console.log('🎮 Using canister ID:', canisterId);
      
      // Test Principal creation with custom implementation
      try {
        const testPrincipal = Principal.fromText(canisterId);
        console.log('🎮 Custom Principal.fromText succeeded:', testPrincipal.toString());
      } catch (principalError: any) {
        console.error('🎮 Custom Principal.fromText failed:', principalError);
        console.error('🎮 Principal error details:', {
          message: principalError.message,
          stack: principalError.stack,
        });
        throw new Error('Failed to create Principal from canister ID');
      }

      if (!canisterId) {
        throw new Error('Unified canister ID not found');
      }

    // IDL factory for unified canister
    console.log('🎮 Creating IDL factory...');
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

      const SessionStatus = IDL.Variant({
        Active: IDL.Null,
        Completed: IDL.Null,
        Abandoned: IDL.Null,
      });

      const SessionInfo = IDL.Record({
        id: IDL.Text,
        players: IDL.Vec(IDL.Principal),
        status: SessionStatus,
        createdAt: IDL.Int,
        roundCount: IDL.Nat,
        currentRound: IDL.Opt(IDL.Nat),
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

      const RoundResult = IDL.Record({
        displayScore: IDL.Nat,
        normalizedScore: IDL.Nat,
        distance: IDL.Float64,
        actualLocation: IDL.Record({
          lat: IDL.Float64,
          lon: IDL.Float64,
        }),
        guessLocation: IDL.Record({
          lat: IDL.Float64,
          lon: IDL.Float64,
        }),
        photoId: IDL.Nat,
      });

      const Result_RoundState = IDL.Variant({
        ok: RoundState,
        err: IDL.Text,
      });

      const Result_RoundResult = IDL.Variant({
        ok: RoundResult,
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

      const Result_Sessions = IDL.Variant({
        ok: IDL.Vec(SessionInfo),
        err: IDL.Text,
      });

      return IDL.Service({
        // Game Engine functions
        createSession: IDL.Func([], [Result_Text], []),
        getNextRound: IDL.Func([IDL.Text, IDL.Opt(IDL.Text)], [Result_RoundState], []),
        submitGuess: IDL.Func(
          [IDL.Text, IDL.Float64, IDL.Float64, IDL.Opt(IDL.Float64), IDL.Float64], 
          [Result_RoundResult], 
          []
        ),
        purchaseHint: IDL.Func([IDL.Text, HintType], [Result_HintData], []),
        finalizeSession: IDL.Func([IDL.Text], [Result_SessionResult], []),
        
        // Session management functions
        getUserSessions: IDL.Func([IDL.Principal], [Result_Sessions], ['query']),
        getSession: IDL.Func([IDL.Text], [IDL.Variant({
          ok: IDL.Record({
            id: IDL.Text,
            userId: IDL.Principal,
            rounds: IDL.Vec(RoundState),
            currentRound: IDL.Nat,
            totalScore: IDL.Nat,
            totalScoreNorm: IDL.Nat,
            retryCount: IDL.Nat,
            startTime: IDL.Int,
            endTime: IDL.Opt(IDL.Int),
            lastActivity: IDL.Int,
          }),
          err: IDL.Text,
        })], ['query']),
        
        // Token functions
        icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
        icrc1_transfer: IDL.Func([TransferArgs], [TransferResult], []),
        icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
        icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
        
        // Debug functions
        debugCalculatePlayerReward: IDL.Func([IDL.Text], [IDL.Record({
          sessionFound: IDL.Bool,
          roundCount: IDL.Nat,
          totalScore: IDL.Nat,
          roundDetails: IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Nat)),
          totalReward: IDL.Nat,
        })], ['query']),
        
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
          winRate: IDL.Float64,
          suspiciousActivityFlags: IDL.Opt(IDL.Text),
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
      console.log('🎮 About to create Actor...');
      try {
        // Try using canisterId as string first
        this.actor = Actor.createActor(idlFactory, {
          agent: this.agent,
          canisterId: canisterId,
        });
        console.log('🎮 Actor created successfully with string canisterId');
      } catch (actorError: any) {
        console.error('🎮 Actor creation with string failed:', actorError.message);
        
        // Try with custom Principal if string didn't work
        try {
          const principalCanisterId = Principal.fromText(canisterId);
          this.actor = Actor.createActor(idlFactory, {
            agent: this.agent,
            canisterId: principalCanisterId as any,
          });
          console.log('🎮 Actor created successfully with custom Principal');
        } catch (principalError: any) {
          console.error('🎮 Actor creation with custom Principal failed:', principalError);
          throw principalError;
        }
      }
      
      if (isDevMode) {
        console.log('🎮 DEV: Actor created in dev mode - mock responses will be used for network errors');
      }
    } catch (error: any) {
      console.error('Failed to initialize game service actor:', error);
      console.error('Initialization error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  }


  async createSessionWithCleanup(): Promise<{ ok?: string; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    if (!this.identity) {
      return { err: 'No identity available' };
    }
    
    try {
      const principal = this.identity.getPrincipal();
      console.log('🎮 Creating session with cleanup for:', principal.toString());
      
      // 1. Get existing user sessions
      const sessionsResult = await this.getUserSessions(principal);
      
      if (sessionsResult.err) {
        // Check if it's a network error or just no sessions
        if (sessionsResult.err.includes('not found') || sessionsResult.err.includes('no sessions')) {
          console.log('🎮 No existing sessions found, proceeding with new session');
        } else {
          console.warn('🎮 Could not get existing sessions:', sessionsResult.err);
          // For non-critical errors, continue with new session creation
        }
      } else if (sessionsResult.ok) {
        // 2. Filter active sessions
        const activeSessions = sessionsResult.ok.filter(session => session.status === 'Active');
        console.log('🎮 Found', activeSessions.length, 'active sessions to cleanup');
        
        // 3. Finalize all active sessions
        const cleanupPromises = activeSessions.map(async (session) => {
          console.log('🎮 Finalizing session:', session.id);
          try {
            const finalizeResult = await this.finalizeSession(session.id);
            if (finalizeResult.err) {
              console.warn('🎮 Failed to finalize session', session.id, ':', finalizeResult.err);
            } else {
              console.log('🎮 Successfully finalized session:', session.id);
            }
          } catch (error: any) {
            console.warn('🎮 Error finalizing session', session.id, ':', error.message);
          }
        });
        
        // Wait for all cleanup operations to complete
        await Promise.allSettled(cleanupPromises);
      }
      
      // 4. Create new session (should now succeed)
      console.log('🎮 Creating new session after cleanup...');
      const result = await this.createSession();
      console.log('🎮 createSessionWithCleanup result:', result);
      return result;
      
    } catch (error: any) {
      console.error('Failed to create session with cleanup:', error);
      return { err: error.message || 'Failed to create session with cleanup' };
    }
  }

  async createSession(): Promise<{ ok?: string; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('🎮 Calling createSession...');
      console.log('🎮 Actor methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.actor)));
      console.log('🎮 Identity principal:', this.identity?.getPrincipal().toString());
      
      const result = await this.actor.createSession();
      console.log('🎮 createSession result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to create session:', error);
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
      return { err: error.message || 'Failed to create session' };
    }
  }

  async getNextRound(sessionId: string, regionFilter?: string): Promise<any> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.getNextRound(sessionId, regionFilter ? [regionFilter] : []);
      console.log('🎮 getNextRound called with regionFilter:', regionFilter);
      return result;
    } catch (error: any) {
      console.error('Failed to get next round:', error);
      return { err: error.message || 'Failed to get next round' };
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
      return { err: error.message || 'Failed to submit guess' };
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

  async getTokenBalance(principal: any): Promise<bigint> {
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
      console.error('Failed to get token balance:', error);
      return BigInt(0);
    }
  }

  async debugCalculatePlayerReward(sessionId: string): Promise<any> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.debugCalculatePlayerReward(sessionId);
      return result;
    } catch (error) {
      console.error('Failed to debug calculate player reward:', error);
      return null;
    }
  }

  async getPlayerStats(principal: any): Promise<any> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const stats = await this.actor.getPlayerStats(principal);
      return stats;
    } catch (error: any) {
      console.error('Failed to get player stats:', error);
      return null;
    }
  }

  async getUserSessions(principal: any): Promise<{ ok?: SessionInfo[]; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.getUserSessions(principal);
      return result;
    } catch (error: any) {
      console.error('Failed to get user sessions:', error);
      return { err: 'Failed to get user sessions' };
    }
  }

  async getSession(sessionId: string): Promise<any> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      // Note: This function needs to be added to the backend if not already present
      const result = await this.actor.getSession(sessionId);
      return result;
    } catch (error: any) {
      console.error('Failed to get session:', error);
      return null;
    }
  }

  // Admin function for dev mode minting
  async adminMint(to: any, amount: bigint): Promise<{ ok?: bigint; err?: string }> {
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