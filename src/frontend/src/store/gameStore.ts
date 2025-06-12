import { create } from 'zustand';

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
  roundNumber: number;
  roundResults: RoundResult[];
  
  // Token balance
  tokenBalance: bigint;
  
  // Hints
  purchasedHints: HintInfo[];
  
  // Actions
  setCurrentPhoto: (photo: GamePhoto) => void;
  setGuess: (guess: { latitude: number; longitude: number }, radius: number) => void;
  setTimeLeft: (time: number) => void;
  setSessionId: (id: string | null) => void;
  setRoundNumber: (round: number) => void;
  setTokenBalance: (balance: bigint) => void;
  addPurchasedHint: (hint: HintInfo) => void;
  addRoundResult: (result: RoundResult) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  currentPhoto: null,
  currentGuess: null,
  confidenceRadius: 1000,
  timeLeft: 180,
  difficulty: 'NORMAL',
  sessionId: null,
  roundNumber: 1,
  roundResults: [],
  tokenBalance: BigInt(0),
  purchasedHints: [],
  
  setCurrentPhoto: (photo) => set({ currentPhoto: photo }),
  
  setGuess: (guess, radius) => set({ 
    currentGuess: guess, 
    confidenceRadius: radius 
  }),
  
  setTimeLeft: (time) => set({ timeLeft: time }),
  
  setSessionId: (id) => set({ sessionId: id }),
  
  setRoundNumber: (round) => set({ roundNumber: round }),
  
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
    roundNumber: 1,
    roundResults: [],
  }),
}));