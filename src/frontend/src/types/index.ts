import { Principal } from '@dfinity/principal';

// Common types used across the application
export interface ApiError {
  message: string;
  code?: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
}

// Auth types
export interface AuthState {
  isAuthenticated: boolean;
  principal: Principal | null;
  loading: boolean;
}

// Game types
export interface GameRound {
  id: number;
  photoId: number;
  photoUrl?: string;
  startTime: bigint;
  endTime?: bigint;
  participants: Principal[];
  settled: boolean;
}

export interface Submission {
  player: Principal;
  guessLat: number;
  guessLon: number;
  guessAzim: number;
  submissionTime: bigint;
  distance?: number;
  azimuthError?: number;
  score?: number;
  reward?: number;
}

export interface PlayerStats {
  totalRounds: number;
  totalScore: number;
  totalRewards: number;
  averageDistance: number;
}

// Photo types
export interface PhotoMeta {
  id: number;
  owner: Principal;
  lat: number;
  lon: number;
  azim: number;
  timestamp: number;
  quality: number;
  uploadTime: number;
  chunkCount: number;
  totalSize: number;
  perceptualHash?: string;
}

export interface PhotoUploadData {
  file: File;
  metadata: {
    lat: number;
    lon: number;
    azim: number;
    timestamp: number;
  };
}

// Leaderboard types
export interface LeaderboardEntry {
  rank: number;
  player: string;
  totalScore: number;
  totalRounds: number;
  averageScore: number;
  totalRewards: number;
}

export interface PhotoStats {
  photoId: number;
  owner: string;
  timesPlayed: number;
  totalRewardsEarned: number;
  quality: number;
}

// Constants
export const CHUNK_SIZE = 256 * 1024; // 256KB
export const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
export const PLAY_FEE = 1; // 0.01 SPOT
export const ROUND_DURATION = 5 * 60 * 1000; // 5 minutes in ms