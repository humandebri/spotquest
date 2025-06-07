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

interface GameStore {
  // Current game state
  currentPhoto: GamePhoto | null;
  currentGuess: { latitude: number; longitude: number } | null;
  confidenceRadius: number;
  timeLeft: number;
  difficulty: string;
  
  // Actions
  setCurrentPhoto: (photo: GamePhoto) => void;
  setGuess: (guess: { latitude: number; longitude: number }, radius: number) => void;
  setTimeLeft: (time: number) => void;
  resetGame: () => void;
}

export const useGameStore = create<GameStore>((set) => ({
  currentPhoto: null,
  currentGuess: null,
  confidenceRadius: 1000,
  timeLeft: 180,
  difficulty: 'NORMAL',
  
  setCurrentPhoto: (photo) => set({ currentPhoto: photo }),
  
  setGuess: (guess, radius) => set({ 
    currentGuess: guess, 
    confidenceRadius: radius 
  }),
  
  setTimeLeft: (time) => set({ timeLeft: time }),
  
  resetGame: () => set({
    currentPhoto: null,
    currentGuess: null,
    confidenceRadius: 1000,
    timeLeft: 180,
  }),
}));