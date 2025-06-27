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
  
  get isInitialized(): boolean {
    return this.initialized && !!this.actor && !!this.identity;
  }
  
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
    if (this.identity && this.identity === identity && this.actor && !isDevMode && this.initialized) {
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
      
      // Dev modeの場合、追加の設定
      if (isDevMode) {
        console.log('🎮 Dev mode detected - certificate verification will be handled by early patches');
      }
      
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
      
      const SessionSummary = IDL.Record({
        id: IDL.Text,
        status: SessionStatus,
        createdAt: IDL.Int,
        roundCount: IDL.Nat,
        currentRound: IDL.Opt(IDL.Nat),
        totalScore: IDL.Nat,
        duration: IDL.Opt(IDL.Nat),
        playerReward: IDL.Opt(IDL.Nat),
        eloRatingChange: IDL.Opt(IDL.Int),
        initialEloRating: IDL.Opt(IDL.Int),
        finalEloRating: IDL.Opt(IDL.Int),
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

      const MetadataValue = IDL.Variant({
        Nat: IDL.Nat,
        Int: IDL.Int,
        Text: IDL.Text,
        Blob: IDL.Vec(IDL.Nat8),
      });

      const Metadata = IDL.Record({
        key: IDL.Text,
        value: MetadataValue,
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
        // Elo rating changes
        playerRatingChange: IDL.Int,
        newPlayerRating: IDL.Int,
        photoRatingChange: IDL.Int,
        newPhotoRating: IDL.Int,
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
        getRecentSessionsWithScores: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Variant({
          ok: IDL.Vec(SessionSummary),
          err: IDL.Text,
        })], ['query']),
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
        icrc1_metadata: IDL.Func([], [IDL.Vec(Metadata)], ['query']),
        
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
          averageDuration: IDL.Nat,
          suspiciousActivityFlags: IDL.Opt(IDL.Text),
          eloRating: IDL.Int,
        })], ['query']),
        
        // Game limits functions
        getRemainingPlays: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Record({
          remainingPlays: IDL.Nat,
          playLimit: IDL.Nat,
        })], ['query']),
        
        // Pro membership functions
        purchaseProMembership: IDL.Func([], [IDL.Variant({
          ok: IDL.Record({
            expiryTime: IDL.Int,
            transactionId: IDL.Nat,
          }),
          err: IDL.Text,
        })], []),
        getProMembershipStatus: IDL.Func([IDL.Opt(IDL.Principal)], [IDL.Record({
          isPro: IDL.Bool,
          expiryTime: IDL.Opt(IDL.Int),
          cost: IDL.Nat,
        })], ['query']),
        
        // Ranking functions
        getPlayerRank: IDL.Func([IDL.Principal], [IDL.Opt(IDL.Nat)], ['query']),
        getLeaderboard: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat))], ['query']),
        getEloLeaderboard: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Int))], ['query']),
        getLeaderboardWithStats: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Record({
          score: IDL.Nat,
          gamesPlayed: IDL.Nat,
          photosUploaded: IDL.Nat,
          totalRewards: IDL.Nat,
          username: IDL.Opt(IDL.Text),
        })))], ['query']),
        getTopPhotosByUsage: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Nat, IDL.Record({
          photoId: IDL.Nat,
          owner: IDL.Principal,
          timesUsed: IDL.Nat,
          title: IDL.Text,
        })))], ['query']),
        getTopUploaders: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Record({
          totalPhotos: IDL.Nat,
          totalTimesUsed: IDL.Nat,
          username: IDL.Opt(IDL.Text),
        })))], ['query']),
        
        // Time-based leaderboards
        getWeeklyLeaderboard: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat, IDL.Text))], ['query']),
        getMonthlyLeaderboard: IDL.Func([IDL.Nat], [IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat, IDL.Text))], ['query']),
        
        // Admin functions (for dev mode)
        adminMint: IDL.Func([IDL.Principal, IDL.Nat], [IDL.Variant({
          ok: IDL.Nat,
          err: IDL.Text,
        })], []),
        getOwner: IDL.Func([], [IDL.Principal], ['query']),
        
        // User profile functions
        setUsername: IDL.Func([IDL.Text], [IDL.Variant({
          ok: IDL.Null,
          err: IDL.Text,
        })], []),
        getUsername: IDL.Func([IDL.Principal], [IDL.Opt(IDL.Text)], ['query']),
        
        // Photo rating functions
        submitPhotoRating: IDL.Func([
          IDL.Text, // sessionId
          IDL.Nat,  // photoId
          IDL.Nat,  // roundIndex
          IDL.Record({
            difficulty: IDL.Nat,
            interest: IDL.Nat,
            beauty: IDL.Nat,
          })
        ], [IDL.Variant({
          ok: IDL.Text,
          err: IDL.Text,
        })], []),
        canRatePhoto: IDL.Func([IDL.Text, IDL.Nat], [IDL.Bool], ['query']),
        getPhotoRatings: IDL.Func([IDL.Nat], [IDL.Opt(IDL.Record({
          photoId: IDL.Nat,
          difficulty: IDL.Record({
            total: IDL.Nat,
            count: IDL.Nat,
            average: IDL.Float64,
          }),
          interest: IDL.Record({
            total: IDL.Nat,
            count: IDL.Nat,
            average: IDL.Float64,
          }),
          beauty: IDL.Record({
            total: IDL.Nat,
            count: IDL.Nat,
            average: IDL.Float64,
          }),
          lastUpdated: IDL.Int,
        }))], ['query']),
        getUserRatingStats: IDL.Func([], [IDL.Record({
          totalRatings: IDL.Nat,
          averageDifficulty: IDL.Float64,
          averageInterest: IDL.Float64,
          averageBeauty: IDL.Float64,
        })], ['query']),
        
        // Photo stats functions
        getPhotoEloRating: IDL.Func([IDL.Nat], [IDL.Int], ['query']),
        getPhotoStatsById: IDL.Func([IDL.Nat], [IDL.Opt(IDL.Record({
          playCount: IDL.Nat,
          totalScore: IDL.Nat,
          averageScore: IDL.Float64,
          bestScore: IDL.Nat,
          worstScore: IDL.Nat,
        }))], ['query']),
        
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
      
      // 4. Create new session with retry mechanism
      console.log('🎮 Creating new session after cleanup...');
      
      // Try creating session with retries
      for (let attempt = 1; attempt <= 3; attempt++) {
        const result = await this.createSession();
        console.log(`🎮 createSession attempt ${attempt} result:`, result);
        
        if (result.ok) {
          console.log('🎮 createSessionWithCleanup succeeded:', result);
          return result;
        }
        
        if (result.err && result.err.includes('Maximum concurrent sessions')) {
          console.log(`🎮 Session limit hit on attempt ${attempt}, waiting and retrying...`);
          
          // Wait a bit for backend cleanup to complete
          await new Promise(resolve => setTimeout(resolve, 1000));
          
          // Force additional cleanup if needed
          if (attempt < 3) {
            try {
              const retrySessionsResult = await this.getUserSessions(principal);
              if (retrySessionsResult.ok) {
                const remainingActive = retrySessionsResult.ok.filter(s => s.status === 'Active');
                if (remainingActive.length > 0) {
                  console.log('🎮 Force finalizing remaining sessions:', remainingActive.length);
                  await Promise.allSettled(
                    remainingActive.map(s => this.finalizeSession(s.id))
                  );
                }
              }
            } catch (cleanupError) {
              console.warn('🎮 Additional cleanup failed:', cleanupError);
            }
          }
        } else {
          // Different error, return immediately
          console.log('🎮 createSessionWithCleanup failed with non-session error:', result);
          return result;
        }
      }
      
      // If all retries failed
      return { err: 'Failed to create session after multiple attempts' };
      
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

  async getNextRound(sessionId: string, regionFilter?: string, gameMode: string = 'classic'): Promise<any> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('🎮 getNextRound called with regionFilter:', regionFilter, 'gameMode:', gameMode);
      
      // For 'thisweek' mode, use a special filter that tells the backend to use weekly photos
      if (gameMode === 'thisweek') {
        const result = await this.actor.getNextRound(sessionId, regionFilter ? [`weekly:${regionFilter}`] : ['weekly:']);
        return result;
      } else {
        const result = await this.actor.getNextRound(sessionId, regionFilter ? [regionFilter] : []);
        return result;
      }
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
  
  async getRecentSessionsWithScores(principal: any, limit: number = 10): Promise<{ ok?: any[]; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('🏠 Fetching recent sessions with scores for:', principal.toString());
      const result = await this.actor.getRecentSessionsWithScores(principal, limit);
      console.log('🏠 Recent sessions result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to get recent sessions with scores:', error);
      return { err: 'Failed to get recent sessions with scores' };
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

  // User profile functions
  async setUsername(username: string): Promise<{ ok?: null; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.setUsername(username);
      return result;
    } catch (error) {
      console.error('Failed to set username:', error);
      return { err: 'Failed to set username' };
    }
  }

  async getUsername(principal: any): Promise<string | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getUsername(principal);
      return result[0] || null; // IDL.Opt returns an array
    } catch (error) {
      console.error('Failed to get username:', error);
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

  // Leaderboard functions
  async getLeaderboard(limit: number): Promise<{ principal: any; score: bigint }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getLeaderboard(BigInt(limit));
      return result.map(([principal, score]: [any, bigint]) => ({ principal, score }));
    } catch (error) {
      console.error('Failed to get leaderboard:', error);
      return [];
    }
  }

  async getLeaderboardWithStats(limit: number): Promise<{
    principal: any;
    score: bigint;
    gamesPlayed: bigint;
    photosUploaded: bigint;
    totalRewards: bigint;
    username?: string;
  }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getLeaderboardWithStats(BigInt(limit));
      return result.map(([principal, stats]: [any, any]) => ({
        principal,
        score: stats.score,
        gamesPlayed: stats.gamesPlayed,
        photosUploaded: stats.photosUploaded,
        totalRewards: stats.totalRewards,
        username: stats.username?.[0] || undefined,
      }));
    } catch (error) {
      console.error('Failed to get leaderboard with stats:', error);
      return [];
    }
  }

  async getEloLeaderboardWithStats(limit: number): Promise<{
    principal: any;
    score: bigint;  // This will be the Elo rating
    gamesPlayed: bigint;
    photosUploaded: bigint;
    totalRewards: bigint;
    username?: string;
    eloRating: bigint;
  }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      // Get Elo leaderboard
      const eloResult = await this.actor.getEloLeaderboard(BigInt(limit));
      
      // Fetch stats for each player
      const playersWithStats = await Promise.all(
        eloResult.map(async ([principal, eloRating]: [any, bigint]) => {
          try {
            const stats = await this.getPlayerStats(principal);
            const username = await this.getUsername(principal);
            
            // Debug logging for rewards
            console.log(`🎮 Player ${principal.toString().slice(0, 10)}... stats:`, stats);
            if (stats) {
              console.log(`🎮 - totalRewardsEarned: ${stats.totalRewardsEarned}`);
              console.log(`🎮 - totalGamesPlayed: ${stats.totalGamesPlayed}`);
            }
            
            return {
              principal,
              score: eloRating,  // Use Elo rating as the primary score
              eloRating: eloRating,
              gamesPlayed: stats ? BigInt(stats.totalGamesPlayed) : 0n,
              photosUploaded: stats ? BigInt(stats.totalPhotosUploaded) : 0n,
              totalRewards: stats ? BigInt(stats.totalRewardsEarned) : 0n,
              username: username || undefined,
            };
          } catch (error) {
            console.error(`Failed to get stats for ${principal}:`, error);
            return {
              principal,
              score: eloRating,
              eloRating: eloRating,
              gamesPlayed: 0n,
              photosUploaded: 0n,
              totalRewards: 0n,
              username: undefined,
            };
          }
        })
      );
      
      return playersWithStats;
    } catch (error) {
      console.error('Failed to get Elo leaderboard with stats:', error);
      return [];
    }
  }

  async getTopPhotosByUsage(limit: number): Promise<any[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getTopPhotosByUsage(BigInt(limit));
      return result.map(([id, data]: [bigint, any]) => ({
        photoId: id,
        ...data
      }));
    } catch (error) {
      console.error('Failed to get top photos by usage:', error);
      return [];
    }
  }

  async getTopUploaders(limit: number): Promise<{
    principal: any;
    totalPhotos: bigint;
    totalTimesUsed: bigint;
    username?: string;
  }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getTopUploaders(BigInt(limit));
      return result.map(([principal, data]: [any, any]) => ({
        principal,
        totalPhotos: data.totalPhotos,
        totalTimesUsed: data.totalTimesUsed,
        username: data.username?.[0] || undefined,
      }));
    } catch (error) {
      console.error('Failed to get top uploaders:', error);
      return [];
    }
  }

  async getWeeklyLeaderboard(limit: number): Promise<{
    principal: any;
    rewards: bigint;
    username: string;
  }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getWeeklyLeaderboard(BigInt(limit));
      return result.map(([principal, rewards, username]: [any, bigint, string]) => ({
        principal,
        rewards,
        username,
      }));
    } catch (error) {
      console.error('Failed to get weekly leaderboard:', error);
      return [];
    }
  }

  async getMonthlyLeaderboard(limit: number): Promise<{
    principal: any;
    rewards: bigint;
    username: string;
  }[]> {
    if (!this.initialized || !this.actor) {
      return [];
    }
    
    try {
      const result = await this.actor.getMonthlyLeaderboard(BigInt(limit));
      return result.map(([principal, rewards, username]: [any, bigint, string]) => ({
        principal,
        rewards,
        username,
      }));
    } catch (error) {
      console.error('Failed to get monthly leaderboard:', error);
      return [];
    }
  }

  // Rating system functions
  async submitPhotoRating(
    sessionId: string,
    photoId: number,
    roundIndex: number,
    ratings: {
      difficulty: number;
      interest: number;
      beauty: number;
    }
  ): Promise<{ ok?: string; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      console.log('📊 Submitting rating for photo:', photoId, 'with ratings:', ratings);
      const result = await this.actor.submitPhotoRating(
        sessionId,
        BigInt(photoId),
        BigInt(roundIndex),
        {
          difficulty: BigInt(ratings.difficulty),
          interest: BigInt(ratings.interest),
          beauty: BigInt(ratings.beauty),
        }
      );
      console.log('📊 Rating submission result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to submit photo rating:', error);
      return { err: error.message || 'Failed to submit photo rating' };
    }
  }

  async canRatePhoto(sessionId: string, photoId: number): Promise<boolean> {
    if (!this.initialized || !this.actor) {
      return false;
    }
    
    try {
      const result = await this.actor.canRatePhoto(sessionId, BigInt(photoId));
      return result;
    } catch (error) {
      console.error('Failed to check if can rate photo:', error);
      return false;
    }
  }

  async getUserRatingStatus(sessionId: string, photoIds: number[]): Promise<Map<number, boolean>> {
    if (!this.initialized || !this.actor) {
      return new Map();
    }
    
    try {
      const bigIntPhotoIds = photoIds.map(id => BigInt(id));
      const result = await this.actor.getUserRatingStatus(sessionId, bigIntPhotoIds);
      
      const statusMap = new Map<number, boolean>();
      result.forEach(([photoId, hasRated]: [bigint, boolean]) => {
        statusMap.set(Number(photoId), hasRated);
      });
      
      return statusMap;
    } catch (error) {
      console.error('Failed to get user rating status:', error);
      return new Map();
    }
  }

  async getPhotoRatings(photoId: number): Promise<{
    difficulty: { total: bigint; count: bigint; average: number };
    interest: { total: bigint; count: bigint; average: number };
    beauty: { total: bigint; count: bigint; average: number };
    lastUpdated: bigint;
  } | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getPhotoRatings(BigInt(photoId));
      if (!result || result.length === 0) {
        return null;
      }
      
      const ratings = result[0];
      return {
        difficulty: {
          total: ratings.difficulty.total,
          count: ratings.difficulty.count,
          average: Number(ratings.difficulty.average),
        },
        interest: {
          total: ratings.interest.total,
          count: ratings.interest.count,
          average: Number(ratings.interest.average),
        },
        beauty: {
          total: ratings.beauty.total,
          count: ratings.beauty.count,
          average: Number(ratings.beauty.average),
        },
        lastUpdated: ratings.lastUpdated,
      };
    } catch (error) {
      console.error('Failed to get photo ratings:', error);
      return null;
    }
  }

  async getPlayerStats(principal?: Principal): Promise<{
    totalGamesPlayed: number;
    totalPhotosUploaded: number;
    totalRewardsEarned: number;
    bestScore: number;
    averageScore: number;
    averageScore30Days: number | null;
    rank: number | null;
    winRate: number;
    currentStreak: number;
    longestStreak: number;
    reputation: number;
    totalGuesses: number;
    averageDuration: number;
    suspiciousActivityFlags: string | null;
    eloRating: number;
  } | null> {
    console.log('🎮 getPlayerStats called, initialized:', this.initialized, 'actor:', !!this.actor, 'identity:', !!this.identity);
    if (!this.initialized || !this.actor || !this.identity) {
      console.error('🎮 getPlayerStats: Service not initialized properly');
      return null;
    }
    
    try {
      const targetPrincipal = principal || this.identity.getPrincipal();
      const result = await this.actor.getPlayerStats(targetPrincipal);
      
      console.log('🎮 getPlayerStats raw result:', result);
      console.log('🎮 rank field:', result.rank, 'length:', result.rank.length);
      console.log('🎮 totalGamesPlayed:', result.totalGamesPlayed, 'Number:', Number(result.totalGamesPlayed));
      console.log('🎮 Raw backend result for getPlayerStats:', result);
      console.log('🎮 averageScore:', result.averageScore, 'Number:', Number(result.averageScore));
      console.log('🎮 totalScore:', result.totalScore);
      console.log('🎮 totalRewardsEarned:', result.totalRewardsEarned, 'Type:', typeof result.totalRewardsEarned, 'Number:', Number(result.totalRewardsEarned));
      console.log('🎮 All fields:', Object.keys(result));
      
      return {
        totalGamesPlayed: Number(result.totalGamesPlayed),
        totalPhotosUploaded: Number(result.totalPhotosUploaded),
        totalRewardsEarned: Number(result.totalRewardsEarned),
        bestScore: Number(result.bestScore),
        averageScore: Number(result.averageScore),
        averageScore30Days: result.averageScore30Days.length > 0 ? Number(result.averageScore30Days[0]) : null,
        rank: result.rank.length > 0 ? Number(result.rank[0]) : null,
        winRate: Number(result.winRate),
        currentStreak: Number(result.currentStreak),
        longestStreak: Number(result.longestStreak),
        reputation: Number(result.reputation),
        totalGuesses: Number(result.totalGuesses),
        // averageDuration is new field - handle gracefully if not present
        averageDuration: result.averageDuration !== undefined ? Number(result.averageDuration) : 0,
        suspiciousActivityFlags: result.suspiciousActivityFlags.length > 0 ? result.suspiciousActivityFlags[0] : null,
        eloRating: Number(result.eloRating),
      };
    } catch (error) {
      console.error('Failed to get player stats:', error);
      console.error('Error details:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        error: error
      });
      return null;
    }
  }

  async getRemainingPlays(principal?: any): Promise<{ remainingPlays: number; playLimit: number } | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getRemainingPlays(principal ? [principal] : []);
      console.log('🎮 getRemainingPlays result:', result);
      
      return {
        remainingPlays: Number(result.remainingPlays),
        playLimit: Number(result.playLimit),
      };
    } catch (error) {
      console.error('Failed to get remaining plays:', error);
      return null;
    }
  }

  async purchaseProMembership(): Promise<{ ok?: { expiryTime: bigint; transactionId: bigint }; err?: string }> {
    if (!this.initialized || !this.actor) {
      return { err: 'Service not initialized. Please login first.' };
    }
    
    try {
      const result = await this.actor.purchaseProMembership();
      console.log('💎 purchaseProMembership result:', result);
      return result;
    } catch (error: any) {
      console.error('Failed to purchase Pro membership:', error);
      return { err: error.message || 'Failed to purchase Pro membership' };
    }
  }

  async getProMembershipStatus(principal?: any): Promise<{ isPro: boolean; expiryTime?: bigint; cost: bigint } | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getProMembershipStatus(principal ? [principal] : []);
      console.log('🎯 getProMembershipStatus result:', result);
      
      return {
        isPro: result.isPro,
        expiryTime: result.expiryTime.length > 0 ? result.expiryTime[0] : undefined,
        cost: result.cost,
      };
    } catch (error) {
      console.error('Failed to get Pro membership status:', error);
      return null;
    }
  }

  async getUserRatingStats(): Promise<{
    totalRatings: number;
    averageDifficulty: number;
    averageInterest: number;
    averageBeauty: number;
  } | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getUserRatingStats();
      
      return {
        totalRatings: Number(result.totalRatings),
        averageDifficulty: Number(result.averageDifficulty),
        averageInterest: Number(result.averageInterest),
        averageBeauty: Number(result.averageBeauty),
      };
    } catch (error) {
      console.error('Failed to get user rating stats:', error);
      return null;
    }
  }

  async getRatingDistribution(photoId: number): Promise<{
    difficulty: number[];
    interest: number[];
    beauty: number[];
    totalRatings: number;
  } | null> {
    if (!this.initialized || !this.actor) {
      return null;
    }
    
    try {
      const result = await this.actor.getRatingDistribution(BigInt(photoId));
      if (!result || result.length === 0) {
        return null;
      }
      
      const distribution = result[0];
      return {
        difficulty: distribution.difficulty.map((n: bigint) => Number(n)),
        interest: distribution.interest.map((n: bigint) => Number(n)),
        beauty: distribution.beauty.map((n: bigint) => Number(n)),
        totalRatings: Number(distribution.totalRatings),
      };
    } catch (error) {
      console.error('Failed to get rating distribution:', error);
      return null;
    }
  }

  async getPhotoEloRating(photoId: number): Promise<number> {
    if (!this.initialized || !this.actor) {
      throw new Error('Service not initialized');
    }
    
    try {
      const rating = await this.actor.getPhotoEloRating(BigInt(photoId));
      return Number(rating);
    } catch (error) {
      console.error('Failed to get photo Elo rating:', error);
      return 1500; // Default rating
    }
  }

  async getPhotoStatsById(photoId: number): Promise<{
    playCount: number;
    totalScore: number;
    averageScore: number;
    bestScore: number;
    worstScore: number;
  } | null> {
    if (!this.initialized || !this.actor) {
      throw new Error('Service not initialized');
    }
    
    try {
      console.log('📊 Calling getPhotoStatsById for photoId:', photoId);
      const stats = await this.actor.getPhotoStatsById(BigInt(photoId));
      console.log('📊 Raw stats response:', stats);
      
      if (stats && stats.length > 0 && stats[0]) {
        const result = {
          playCount: Number(stats[0].playCount),
          totalScore: Number(stats[0].totalScore),
          averageScore: Number(stats[0].averageScore),
          bestScore: Number(stats[0].bestScore),
          worstScore: Number(stats[0].worstScore),
        };
        console.log('📊 Processed stats:', result);
        return result;
      }
      console.log('📊 No stats found for photoId:', photoId);
      return null;
    } catch (error) {
      console.error('Failed to get photo stats:', error);
      return null;
    }
  }

  async getProMembershipExpiry(): Promise<Date | null> {
    if (!this.initialized || !this.actor) {
      throw new Error('Service not initialized');
    }
    
    try {
      console.log('🏆 Checking Pro membership status');
      const expiry = await this.actor.getProMembershipExpiry();
      
      if (expiry && expiry.length > 0) {
        // Convert nanoseconds to milliseconds for JavaScript Date
        const expiryTime = Number(expiry[0]) / 1_000_000;
        const expiryDate = new Date(expiryTime);
        console.log('🏆 Pro membership expires:', expiryDate);
        return expiryDate;
      }
      
      console.log('🏆 No active Pro membership');
      return null;
    } catch (error) {
      console.error('Failed to get Pro membership status:', error);
      return null;
    }
  }

}

export const gameService = new GameService();