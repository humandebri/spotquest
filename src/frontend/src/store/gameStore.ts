import { create } from 'zustand';

// Session-related types (matching backend)
export type SessionStatus = 'Active' | 'Completed' | 'Abandoned';

export interface SessionInfo {
  id: string;
  status: SessionStatus;
  createdAt: bigint;
  roundCount: bigint;
  currentRound: [] | [bigint];
}

interface GamePhoto {
  id: string;
  url: string;
  actualLocation: {
    latitude: number;
    longitude: number;
  };
  azimuth: number;
  timestamp: number;
  uploader: string;
  difficulty: string;
}

interface HintInfo {
  id: string;
  type: 'BasicRadius' | 'PremiumRadius' | 'DirectionHint';
  cost: number;
  title: string;
  content?: string;
  unlocked: boolean;
  data?: any;
}

interface RoundResult {
  roundNumber: number;
  score: number;
  guess: { latitude: number; longitude: number };
  actualLocation: { latitude: number; longitude: number };
  timeUsed: number;
  difficulty: string;
  photoUrl: string;
}

interface GameStore {
  // Current game state
  currentPhoto: GamePhoto | null;
  currentGuess: { latitude: number; longitude: number } | null;
  confidenceRadius: number;
  timeLeft: number;
  difficulty: string;
  
  // Session management
  sessionId: string | null;
  sessionStatus: SessionStatus | null;
  sessionCreatedAt: bigint | null;
  roundNumber: number;
  roundResults: RoundResult[];
  userSessions: SessionInfo[];
  isSessionLoading: boolean;
  sessionError: string | null;
  
  // Token balance
  tokenBalance: bigint;
  
  // Hints
  purchasedHints: HintInfo[];
  
  // Actions - Game state
  setCurrentPhoto: (photo: GamePhoto) => void;
  setGuess: (guess: { latitude: number; longitude: number }, radius: number) => void;
  setTimeLeft: (time: number) => void;
  setTokenBalance: (balance: bigint) => void;
  addPurchasedHint: (hint: HintInfo) => void;
  addRoundResult: (result: RoundResult) => void;
  resetGame: () => void;
  
  // Actions - Session management
  setSessionId: (id: string | null) => void;
  setSessionStatus: (status: SessionStatus | null) => void;
  setSessionCreatedAt: (timestamp: bigint | null) => void;
  setRoundNumber: (round: number) => void;
  setUserSessions: (sessions: SessionInfo[]) => void;
  setSessionLoading: (loading: boolean) => void;
  setSessionError: (error: string | null) => void;
  
  // Session utility functions
  hasActiveSession: () => boolean;
  getActiveSession: () => SessionInfo | null;
  createNewSession: (sessionId: string) => void;
  updateSessionStatus: (sessionId: string, status: SessionStatus) => void;
  clearSessionData: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  // Initial state
  currentPhoto: null,
  currentGuess: null,
  confidenceRadius: 1000,
  timeLeft: 180,
  difficulty: 'NORMAL',
  
  // Session management state
  sessionId: null,
  sessionStatus: null,
  sessionCreatedAt: null,
  roundNumber: 1,
  roundResults: [],
  userSessions: [],
  isSessionLoading: false,
  sessionError: null,
  
  tokenBalance: BigInt(0),
  purchasedHints: [],
  
  // Game state actions
  setCurrentPhoto: (photo) => set({ currentPhoto: photo }),
  
  setGuess: (guess, radius) => set({ 
    currentGuess: guess, 
    confidenceRadius: radius 
  }),
  
  setTimeLeft: (time) => set({ timeLeft: time }),
  
  setTokenBalance: (balance) => set({ tokenBalance: balance }),
  
  addPurchasedHint: (hint) => set((state) => ({
    purchasedHints: [...state.purchasedHints, hint]
  })),
  
  addRoundResult: (result) => set((state) => ({
    roundResults: [...state.roundResults, result]
  })),
  
  resetGame: () => set({
    currentPhoto: null,
    currentGuess: null,
    confidenceRadius: 1000,
    timeLeft: 180,
    purchasedHints: [],
    sessionId: null,
    sessionStatus: null,
    sessionCreatedAt: null,
    roundNumber: 1,
    roundResults: [],
    sessionError: null,
  }),
  
  // Session management actions
  setSessionId: (id) => set({ sessionId: id }),
  
  setSessionStatus: (status) => set({ sessionStatus: status }),
  
  setSessionCreatedAt: (timestamp) => set({ sessionCreatedAt: timestamp }),
  
  setRoundNumber: (round) => set({ roundNumber: round }),
  
  setUserSessions: (sessions) => set({ userSessions: sessions }),
  
  setSessionLoading: (loading) => set({ isSessionLoading: loading }),
  
  setSessionError: (error) => set({ sessionError: error }),
  
  // Session utility functions
  hasActiveSession: () => {
    const state = get();
    return state.sessionId !== null && state.sessionStatus === 'Active';
  },
  
  getActiveSession: () => {
    const state = get();
    // Ensure userSessions is an array
    if (!Array.isArray(state.userSessions)) {
      return null;
    }
    return state.userSessions.find(session => 
      session.id === state.sessionId && session.status === 'Active'
    ) || null;
  },
  
  createNewSession: (sessionId) => {
    const timestamp = BigInt(Date.now());
    const newSession: SessionInfo = {
      id: sessionId,
      status: 'Active',
      createdAt: timestamp,
      roundCount: BigInt(0),
      currentRound: [],
    };
    
    set((state) => ({
      sessionId,
      sessionStatus: 'Active',
      sessionCreatedAt: timestamp,
      roundNumber: 1,
      // Mark all other active sessions as completed before adding new one
      userSessions: [
        ...(Array.isArray(state.userSessions) ? state.userSessions : []).map(session => 
          session.status === 'Active' && session.id !== sessionId
            ? { ...session, status: 'Completed' as SessionStatus }
            : session
        ).filter(session => session.id !== sessionId), // Remove if already exists
        newSession
      ],
      sessionError: null,
    }));
  },
  
  updateSessionStatus: (sessionId, status) => {
    set((state) => ({
      userSessions: Array.isArray(state.userSessions) 
        ? state.userSessions.map(session =>
            session.id === sessionId ? { ...session, status } : session
          )
        : [],
      sessionStatus: state.sessionId === sessionId ? status : state.sessionStatus,
    }));
  },
  
  clearSessionData: () => set({
    sessionId: null,
    sessionStatus: null,
    sessionCreatedAt: null,
    roundNumber: 1,
    purchasedHints: [],
    currentPhoto: null,
    currentGuess: null,
    sessionError: null,
  }),
}));