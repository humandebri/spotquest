import { Actor, HttpAgent } from '@dfinity/agent';
import { Principal } from '@dfinity/principal';

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
  
  constructor() {
    this.initializeActor();
  }

  private async initializeActor() {
    // メインネット環境のみを使用
    const agent = new HttpAgent({
      host: 'https://ic0.app',
    });

    // メインネット環境では証明書検証をスキップしない（本番環境）

    // メインネットの統合canister IDを使用
    const canisterId = process.env.EXPO_PUBLIC_UNIFIED_CANISTER_ID || '77fv5-oiaaa-aaaal-qsoea-cai';

    // IDL factory for unified canister
    const idlFactory = ({ IDL }: any) => {
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
      });
    };

    this.actor = Actor.createActor(idlFactory, {
      agent,
      canisterId,
    });
  }

  async createSession(): Promise<{ ok?: string; err?: string }> {
    try {
      const result = await this.actor.createSession();
      return result;
    } catch (error) {
      console.error('Failed to create session:', error);
      return { err: 'Failed to create session' };
    }
  }

  async getNextRound(sessionId: string): Promise<any> {
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
    try {
      const result = await this.actor.purchaseHint(sessionId, hintType);
      return result;
    } catch (error) {
      console.error('Failed to purchase hint:', error);
      return { err: 'Failed to purchase hint' };
    }
  }

  async finalizeSession(sessionId: string): Promise<{ ok?: SessionResult; err?: string }> {
    try {
      const result = await this.actor.finalizeSession(sessionId);
      return result;
    } catch (error) {
      console.error('Failed to finalize session:', error);
      return { err: 'Failed to finalize session' };
    }
  }

  async getTokenBalance(principal: Principal): Promise<bigint> {
    try {
      const balance = await this.actor.icrc1_balance_of({ 
        owner: principal,
        subaccount: []
      });
      return balance;
    } catch (error) {
      console.error('Failed to get token balance:', error);
      return BigInt(0);
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