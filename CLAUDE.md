# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Guess-the-Spot** is a photo-based location guessing game running on the Internet Computer Protocol (ICP). It's a React Native + Expo mobile application where users guess photo locations to earn SPOT tokens.

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

[Rest of the document remains the same...]