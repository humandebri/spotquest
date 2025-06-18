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

### 0. Unified Canister Pattern
The backend uses a **unified canister architecture** (`src/backend/unified/main.mo`) that combines:
- **Game Engine**: Round management, scoring, session tracking
- **Token System**: ICRC-1 compliant SPOT token with treasury management
- **Photo Storage**: V2 chunk-based system with stable memory
- **Reputation System**: Quality scoring and photo moderation
- **Module Pattern**: Functionality split across modules in `modules/` directory

**Key Modules**:
- `GameEngineModule.mo` - Core game logic, round progression
- `PhotoModuleV2.mo` - Photo storage, search, metadata management  
- `TokenModule.mo` - SPOT token minting, transfers, balance tracking
- `TreasuryModule.mo` - Game costs, rewards, economic calculations
- `ReputationModule.mo` - Photo quality scoring, banning system

### 1. Photo Storage System (V2) - UPDATED
- Uses chunk-based upload (256KB chunks)
- Supports search by location, region, tags
- **Stable memory storage only** (legacy system removed)
- All operations unified to use `PhotoModuleV2.mo`
- Functions: `createPhotoV2`, `uploadPhotoChunkV2`, `finalizePhotoUploadV2`, `searchPhotosV2`

### 2. Authentication Flow
```
Production: Internet Identity → Delegated Identity → Canister calls
Dev Mode: Ed25519KeyIdentity → Direct canister calls (verifyQuerySignatures: true)
```

**Key Identity Types**:
- Production: `DelegationIdentity` via Internet Identity
- Dev Mode: `Ed25519KeyIdentity` with fixed test principal `6lvto-wk4rq-wwea5-neix6-nelpy-tgifs-crt3y-whqnf-5kns5-t3il6-xae`

### 3. Certificate Verification (Dev Mode) - UPDATED
All service files now use `verifyQuerySignatures: true` for proper dev mode authentication:
```typescript
const agent = new HttpAgent({
  identity,
  host: 'https://ic0.app',
  verifyQuerySignatures: true, // Required for proper identity verification
});
```

### 4. Region-based Game Mode - UPDATED
- Frontend sends region filter to backend
- Backend uses Photo V2 search to filter photos by region
- Uses English location names (e.g., "Tokyo, Japan") instead of ISO codes
- Search supports partial matching and multiple levels (city, state, country)

### 5. Game Flow Architecture
**Session Management**: 5-round games tracked server-side with unique session IDs
**Photo Pipeline**: Camera/Gallery → Compression → Chunk Upload → Metadata → Finalization
**Location Services**: EXIF extraction → Nominatim geocoding → Region mapping → Search indexing
**Scoring System**: Distance + Time → Backend calculation → Token rewards → Treasury management

**Critical Data Flow**:
1. `GamePlayScreen` → `GuessMapScreen` → `GameResultScreen` → repeat 5x → `SessionSummaryScreen`
2. Photo Upload: `CameraScreen`/`PhotoLibraryScreen` → `PhotoUploadScreenV2` → Backend processing
3. Identity flows through all service calls via `useAuth` hook with singleton service initialization

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
Use `verifyQuerySignatures: true` to HttpAgent for proper identity verification

### Expo Go Crypto Limitations
Dev mode uses Anonymous Identity to avoid crypto issues

### Photo Location Extraction
Use helper functions in `src/frontend/src/utils/locationHelpers.ts`

### Stable Storage Compatibility
When changing data structures, may need `--mode reinstall` (data loss)

### Dev Mode Query Authentication (2025-06-18) - RESOLVED
**Problem**: Photos uploaded in dev mode not visible in profile
- `verifyQuerySignatures: false` caused query calls to use anonymous principal
- `getUserPhotosV2` as query function returned empty results

**Solution**: Changed certificate verification to `verifyQuerySignatures: true`
- All service files now use proper identity verification
- Maintained query functions for performance while ensuring correct principal authentication

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
- Fixed certificate verification to use `verifyQuerySignatures: true`
- Resolved issue where photos weren't visible in dev mode
- Added debug logging for principal tracking

### Legacy Storage Cleanup ✅
- Removed unused legacy `photos` and `photoChunks` storage systems
- Unified all photo operations to use V2 stable storage
- Cleaned up deprecated functions while preserving admin functionality

### Region Management Redesign ✅
- Migrated from ISO-3166 codes to English location names
- Implemented search-focused utilities in `regionMapping.ts`
- Supports partial matching and hierarchical location display
- Format: "City, Country" or "City, State, Country"

### UI/UX Improvements ✅
- Fixed success popup buttons to use appropriate actions
- GameResult screen handles extreme distances (3000km+) without freezing
- Optimized map zoom calculations for better performance
- Navigation parameter serialization fixes (BigInt → Number)