# Current Functionality Baseline - Unified Canister

## Date: 2025-06-09
## Canister ID: 77fv5-oiaaa-aaaal-qsoea-cai (Mainnet)

This document captures the current functionality of the unified canister before refactoring.

## ✅ Verified Functionality

### 1. ICRC-1 Token Implementation
- **Token Name**: "Guess the Spot Token"
- **Symbol**: "SPOT"
- **Decimals**: 2
- **Transfer Fee**: 1 (0.01 SPOT)
- **Functions**:
  - `icrc1_name()` ✅
  - `icrc1_symbol()` ✅
  - `icrc1_decimals()` ✅
  - `icrc1_fee()` ✅
  - `icrc1_total_supply()` ✅
  - `icrc1_balance_of()` ✅
  - `icrc1_transfer()` ✅

### 2. Game Engine v2
- **Session Management**:
  - Max 2 concurrent sessions per user
  - 30-minute session timeout
  - 10 rounds per session
- **Functions**:
  - `createSession()` ✅
  - `getNextRound()` ✅
  - `submitGuess()` ✅
  - `purchaseHint()` ✅
  - `finalizeSession()` ✅

### 3. Hint System
- **Types**:
  - BasicRadius: 100 units (1.00 SPOT)
  - PremiumRadius: 300 units (3.00 SPOT)
  - DirectionHint: 100 units (1.00 SPOT)
- **Features**:
  - Prevents duplicate hint purchases
  - Generates hint data based on photo location

### 4. Guess History
- **Data Storage**:
  - Records all guesses with player, photo, location, distance
  - Maintains player history (up to 1000 entries)
  - Max 10,000 guesses per photo
- **Functions**:
  - `recordGuess()` ✅
  - `getPhotoGuesses()` ✅
  - `getPlayerHistory()` ✅
  - `generateHeatmap()` ✅

### 5. Treasury & Sink Management
- **Sink Fees**:
  - Retry: 200 units (2.00 SPOT)
  - Basic Hint: 100 units (1.00 SPOT)
  - Premium Hint: 300 units (3.00 SPOT)
  - Proposal: 1000 units (10.00 SPOT)
  - Boost: 500 units (5.00 SPOT)
- **Functions**:
  - `getTreasuryStats()` ✅
  - `getSinkHistory()` ✅
  - Auto-burn when treasury > 5% of supply

### 6. Photo NFT System
- **Metadata Storage**:
  - Location (lat, lon, azimuth)
  - Quality score
  - Upload time and size
  - Perceptual hash (optional)
- **Functions**:
  - `uploadPhoto()` ✅
  - `getPhotoMeta()` ✅
  - `getUserPhotos()` ✅
  - `schedulePhotoUpload()` ✅

### 7. Reputation Oracle
- **User Reputation**:
  - Uploader score
  - Player score
  - Total uploads/plays
  - Ban status
- **Photo Reputation**:
  - Quality score
  - Total/correct guesses
  - Report count
- **Functions**:
  - `getUserReputation()` ✅
  - `getPhotoReputation()` ✅

### 8. Score Calculation
- **Display Score**: 0-5000 points
- **Normalized Score**: 0-100 (for rewards)
- **Formula**: Exponential decay based on distance
  - Perfect score (5000) for ≤10m
  - k = 0.15 decay constant

### 9. Reward System
- **Player Rewards**: 0.02 × (Score_norm/100) × B(t)
- **Uploader Rewards**: 30% of player rewards
- **Time Decay**: B(t) = 100/(100 + 5t) days

## 🔍 Key Implementation Details

### Error Handling
- Input validation for all parameters
- Coordinate range checking (-90 to 90, -180 to 180)
- Principal validation (non-empty)
- Arithmetic overflow protection
- Zero division prevention

### Concurrency Control
- Session limits enforced
- Heartbeat cleanup for expired sessions
- Transaction idempotency checks

### Data Structures
- TrieMap for efficient lookups
- Buffer for dynamic arrays
- Stable storage for upgrades

## 📊 Current State Metrics

Run `test/run_quick_test.sh` to get current metrics:
- Total supply
- Treasury balance
- Number of photos
- Active sessions

## ⚠️ Critical Functions to Preserve

1. **Token transfers must maintain exact behavior**
2. **Score calculation formula must remain identical**
3. **Hint generation logic must be preserved**
4. **Session timeout and limits must be maintained**
5. **Treasury auto-burn threshold must stay at 5%**

## 🧪 Test Coverage

### Created Test Files:
1. `unified_integration.test.mo` - Comprehensive Motoko tests
2. `unified_functional_test.js` - Mainnet functional tests
3. `quick_mainnet_test.js` - Quick health check
4. `TEST_DOCUMENTATION.md` - Testing guide

### How to Run Tests:
```bash
# Quick health check (recommended first)
cd test
./run_quick_test.sh

# Full functional tests
node unified_functional_test.js

# Integration tests (requires local dfx)
./run_unified_tests.sh
```

## 📝 Notes for Refactoring

1. **Preserve all public function signatures**
2. **Maintain stable variable declarations**
3. **Keep error messages consistent**
4. **Don't change token economics**
5. **Preserve all validation logic**

---

**Last Updated**: 2025-06-09
**Updated By**: Claude
**Purpose**: Baseline for backend refactoring