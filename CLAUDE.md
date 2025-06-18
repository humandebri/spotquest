# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Guess-the-Spot** is a photo-based location guessing game running on the Internet Computer Protocol (ICP). It's a React Native + Expo mobile application where users guess photo locations to earn SPOT tokens.

## Architecture

### Key Components

1. **Frontend**: React Native + Expo mobile app
   - Entry point: `src/frontend/App.tsx`
   - Navigation: React Navigation v6 (Native Stack)
   - State management: Zustand stores in `src/frontend/src/store/`
   - Services: `src/frontend/src/services/` for canister communication

2. **Backend**: Motoko canisters on ICP
   - Main canister: `src/backend/unified/main.mo`
   - Modules: `src/backend/unified/modules/`
   - Photo storage: V2 system with chunk-based upload

3. **Authentication**:
   - Production: Internet Identity via `expo-ii-integration`
   - Dev mode: Anonymous Identity (fixed test key)

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
```

### Backend (ICP Canisters)

```bash
# Deploy to mainnet
dfx deploy unified --network ic

# Deploy with reinstall (WARNING: deletes all data)
echo "yes" | dfx deploy unified --network ic --mode reinstall

# Check canister status
dfx canister --network ic status unified

# View canister logs
dfx canister --network ic logs unified
```

### Common Development Tasks

```bash
# Fix TypeScript errors
cd src/frontend && npx tsc --noEmit

# Run linter (if configured)
cd src/frontend && npm run lint

# Clear Expo cache
cd src/frontend && npx expo start -c

# Update dependencies
cd src/frontend && npm update --legacy-peer-deps
```

## Critical Architecture Decisions

### 1. Photo Storage System (V2)
- Uses chunk-based upload (256KB chunks)
- Supports search by location, region, tags
- Stable memory storage with parallel Legacy + Stable system
- Migration from V1 to V2 is in progress

### 2. Authentication Flow
```
Production: Internet Identity → Delegated Identity → Canister calls
Dev Mode: Anonymous Identity → Direct canister calls (verifyQuerySignatures: false)
```

### 3. Certificate Verification (Dev Mode)
All service files must include `verifyQuerySignatures: false` for dev mode:
```typescript
const agent = new HttpAgent({
  identity,
  host: 'https://ic0.app',
  verifyQuerySignatures: false, // Required for dev mode
});
```

### 4. Region-based Game Mode
- Frontend sends region filter to backend
- Backend uses Photo V2 search to filter photos by region
- Supports country codes (JP, US) and region codes (JP-13, US-CA)

## Important Constraints

1. **No Local Replica**: Always use mainnet (ic0.app)
2. **No Mock Data**: All data must come from real canister calls
3. **Chunk Size**: Photo uploads limited to 256KB per chunk
4. **Dev Mode**: Uses fixed test principal for consistency
5. **Stable Storage**: Data persists across canister upgrades (except with --mode reinstall)

## Environment Configuration

Required `.env` file in `src/frontend/`:
```bash
EXPO_PUBLIC_IC_HOST=https://ic0.app
EXPO_PUBLIC_UNIFIED_CANISTER_ID=77fv5-oiaaa-aaaal-qsoea-cai
```

## Common Issues & Solutions

### Certificate Verification Error
Add `verifyQuerySignatures: false` to HttpAgent in dev mode

### Expo Go Crypto Limitations
Dev mode uses Anonymous Identity to avoid crypto issues

### Photo Location Extraction
Use helper functions in `src/frontend/src/utils/locationHelpers.ts`

### Stable Storage Compatibility
When changing data structures, may need `--mode reinstall` (data loss)

### Dev Mode Query Authentication (2025-06-18)
**Problem**: Photos uploaded in dev mode not visible in profile
- `verifyQuerySignatures: false` causes query calls to use anonymous principal
- `getUserPhotosV2` as query function returns empty results

**Solution**: Change `getUserPhotosV2` from query to shared function
```motoko
// Before: public shared query(msg) func getUserPhotosV2
// After: public shared(msg) func getUserPhotosV2
```

## Current Canister IDs

- **Unified (mainnet)**: 77fv5-oiaaa-aaaal-qsoea-cai
- **Frontend**: https://7yetj-dqaaa-aaaal-qsoeq-cai.icp0.io/
- **Candid UI**: https://a4gq6-oaaaa-aaaab-qaa4q-cai.raw.icp0.io/?id=77fv5-oiaaa-aaaal-qsoea-cai

## Token Economics

- Play cost: 2.00 SPOT per game
- Rewards: 0-1.00 SPOT based on accuracy
- Photo uploader reward: 5% of player score
- Hints: 1.00-3.00 SPOT each

## Anti-cheat Measures

- Coordinate validation (lat/lon ranges)
- Time validation (2 seconds minimum, 5 minutes maximum)
- Fixed confidence radius values (500m, 1km, 2km, 5km)
- Repeated coordinate detection

## Development Guidelines

1. Always explain changes in Japanese before implementation
2. Test on both iOS and Android simulators
3. Use existing patterns and conventions
4. Verify canister deployments with Candid UI
5. Monitor console logs for debugging

## Recent Updates (2025-06-18)

### Photo Upload Experience Improvements ✅
1. **Detailed compression progress**
   - Shows compression attempts (e.g., "Quality adjustment (75%) (3/10)")
   - Visual progress bar during compression
   - Phase-specific descriptions

2. **Interactive waiting UI**
   - Can edit metadata during compression
   - Helpful hints panel explaining the process
   - "You can edit description and tags during this time"

3. **Optimistic UI**
   - Shows success immediately after heavy processing
   - Background sync for final confirmation
   - "Upload complete! Syncing in background..."

### Dev Mode Authentication Fix ✅
- Changed `getUserPhotosV2` from query to shared function
- Resolved issue where photos weren't visible in dev mode
- Added debug logging for principal tracking