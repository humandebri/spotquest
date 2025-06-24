# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Guess-the-Spot** is a photo-based location guessing game running on the Internet Computer Protocol (ICP). It's a React Native + Expo mobile application where users guess photo locations to earn SPOT tokens.

## Development Guidelines

- 作業を行った際はキリのいいところで必ずclaude.mdに行った作業の要約を記録して引き継ぎすること

## Architecture

### Key Components

1. **Frontend**: React Native + Expo mobile app
   - Entry point: `src/frontend/App.tsx`
   - Navigation: React Navigation v6 (Native Stack) via `AppNavigator.tsx`
   - State management: Zustand stores (`gameStore.ts`, `iiAuthStore.ts`)
   - Services: Singleton pattern for canister communication (`photoV2.ts`, `game.ts`)
   - Screen structure: Organized by feature (`game/`, `photo/`, `user/`, `auth/`)
   - Maps: React Native Maps with Google provider for location services

2. **Backend**: Motoko unified canister on ICP
   - Main canister: `src/backend/unified/main.mo` (single canister with all functionality)
   - Modules: `src/backend/unified/modules/` (modular code organization)
   - Photo storage: V2 stable memory with chunk-based upload
   - Game sessions: 5-round games with region filtering support

3. **Authentication**:
   - Production: Internet Identity via `expo-ii-integration`
   - Dev mode: Ed25519KeyIdentity (fixed test principal for consistency)
   - All services require proper identity verification with `verifyQuerySignatures: true`

## Development Commands

### Frontend (React Native/Expo)

```bash
# Navigate to frontend directory
cd src/frontend

# Install dependencies
npm install --legacy-peer-deps

# Start Expo development server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator
npm run android

# Build for web
npm run build:web

# Fix TypeScript errors
npx tsc --noEmit

# Clear Expo cache
npx expo start -c

# Update dependencies
npm update --legacy-peer-deps
```

### Backend (ICP Canisters)

```bash
# Deploy to mainnet (データを保持したままアップグレード)
dfx deploy unified --network ic

# ⚠️ 重要: --mode reinstall は使用しない！
# 決して deployの際に --mode reinstallでcanisterを再インストールしないでください
# これは全てのデータ（ゲーム履歴、写真、トークンバランス等）を削除します

# Check canister status
dfx canister --network ic status unified

# View canister logs
dfx canister --network ic logs unified
```

### Deployment Notes
- deployは必ずupgradeモードで行なってください
- mainnetでデプロイ後、`dfx generate unified`でIDLファイルを更新すること
- 新しいAPIを追加した場合は、`src/frontend/src/services/game.ts`のIDL定義も更新が必要

## Key Technical Details

### Photo Storage System (V2)
- Chunk-based upload system for large photos
- Photos stored in stable memory with automatic migration from legacy storage
- Maximum photo size: 10MB (configurable in Constants.mo)
- Chunk size: 1MB per chunk
- Upload flow: `createPhotoV2` → `uploadPhotoChunkV2` (multiple) → `finalizePhotoUploadV2`

### Game Mechanics
- Distance scoring: `Sd = 1 - (d - 25m) / (1000m - 25m)`
- Azimuth scoring: `Sφ = 1 - φ / 30°`
- Final score: `Score = 100 × Sd^1.3 × Sφ^0.7`
- Rewards calculated based on score with minimum threshold of 10 points

### Rating System
- Users can rate photos after playing them (difficulty, interest, beauty)
- Rate limiting: 20 ratings per hour per user
- Anonymous users cannot rate
- Users cannot rate their own photos
- Ratings stored in stable memory with aggregation

### Token Economy
- SPOT tokens (ICRC-1 compliant)
- Initial supply: 10,000,000 SPOT
- Rewards distributed from treasury based on game performance
- Photo uploaders receive rewards when their photos are played

## Important Patterns

### Service Initialization
All frontend services follow singleton pattern and require initialization with identity:
```typescript
await gameService.init(identity);
```

### Error Handling
- Network errors are handled gracefully with fallback values
- Dev mode provides mock responses for network failures
- All canister calls use try-catch with proper error logging

### State Management
- Game state managed by Zustand (`gameStore.ts`)
- Authentication state in `iiAuthStore.ts`
- Services maintain their own initialization state

### Photo Metadata Structure
Photos include GPS coordinates, azimuth, title, description, difficulty, hint, region tags, and aggregated ratings.

## Security Considerations
- All photo uploads require GPS and azimuth data verification
- Rate limiting on all user actions (uploads, ratings, game sessions)
- Reputation system tracks user behavior with auto-ban for suspicious activity
- Principal-based authentication for all actions
- Photo quality scoring to filter low-quality uploads

## Troubleshooting Common Issues

1. **"Cannot find required field" errors**: Run `dfx generate unified` after backend changes
2. **Authentication failures**: Clear Expo cache and restart the app
3. **Photo upload failures**: Check chunk size limits and network connectivity
4. **Missing ratings**: Ensure user has played the photo in a completed session

## Module Dependencies

Backend modules are organized with clear separation:
- `TokenModule`: ICRC-1 token management
- `GameEngineModule`: Core game logic and session management
- `PhotoModuleV2`: Photo storage and retrieval
- `RatingModule`: Photo rating system
- `ReputationModule`: User reputation tracking
- `TreasuryModule`: Token distribution management