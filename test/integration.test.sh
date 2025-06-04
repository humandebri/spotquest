#!/bin/bash

# Integration tests for Guess-the-Spot

echo "🧪 Starting integration tests..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Helper function to run a test
run_test() {
    local test_name=$1
    local command=$2
    local expected=$3
    
    echo -n "Testing $test_name... "
    
    result=$(eval $command 2>&1)
    
    if [[ $result == *"$expected"* ]]; then
        echo -e "${GREEN}✓ PASSED${NC}"
        ((TESTS_PASSED++))
    else
        echo -e "${RED}✗ FAILED${NC}"
        echo "  Expected: $expected"
        echo "  Got: $result"
        ((TESTS_FAILED++))
    fi
}

# Start local replica
echo "Starting local replica..."
dfx start --clean --background

# Wait for replica to start
sleep 5

# Deploy canisters
echo "Deploying canisters..."
dfx deploy

# Get canister IDs
REWARD_MINT_ID=$(dfx canister id reward_mint)
PHOTO_NFT_ID=$(dfx canister id photo_nft)
GAME_ENGINE_ID=$(dfx canister id game_engine)
REPUTATION_ORACLE_ID=$(dfx canister id reputation_oracle)

echo "Canister IDs:"
echo "  RewardMint: $REWARD_MINT_ID"
echo "  PhotoNFT: $PHOTO_NFT_ID"
echo "  GameEngine: $GAME_ENGINE_ID"
echo "  ReputationOracle: $REPUTATION_ORACLE_ID"

# Test 1: Check token metadata
run_test "Token name" \
    "dfx canister call reward_mint icrc1_name '()'" \
    "Guess the Spot Token"

run_test "Token symbol" \
    "dfx canister call reward_mint icrc1_symbol '()'" \
    "SPOT"

# Test 2: Set up canister connections
run_test "Set GameEngine in RewardMint" \
    "dfx canister call reward_mint setGameEngineCanister '(principal \"$GAME_ENGINE_ID\")'" \
    "ok"

run_test "Set PhotoNFT in GameEngine" \
    "dfx canister call game_engine setPhotoNFTCanister '(principal \"$PHOTO_NFT_ID\")'" \
    "ok"

run_test "Set RewardMint in GameEngine" \
    "dfx canister call game_engine setRewardMintCanister '(principal \"$REWARD_MINT_ID\")'" \
    "ok"

run_test "Set ReputationOracle in GameEngine" \
    "dfx canister call game_engine setReputationOracleCanister '(principal \"$REPUTATION_ORACLE_ID\")'" \
    "ok"

# Test 3: Mint photo NFT
run_test "Mint photo NFT" \
    "dfx canister call photo_nft mintPhotoNFT '(record { lat = 35.6762; lon = 139.6503; azim = 45.0; timestamp = 1234567890; perceptualHash = null; deviceAttestation = null })'" \
    "ok"

# Test 4: Upload photo chunk
run_test "Upload photo chunk" \
    "dfx canister call photo_nft uploadPhotoChunk '(record { tokenId = 0; chunkIndex = 0; chunkData = blob \"\\89\\50\\4E\\47\\0D\\0A\\1A\\0A\" })'" \
    "ok"

# Test 5: Create game round
run_test "Create game round" \
    "dfx canister call game_engine createRound '()'" \
    "ok"

# Test 6: Get active rounds
run_test "Get active rounds" \
    "dfx canister call game_engine getActiveRounds '()'" \
    "vec"

# Test 7: Submit guess
run_test "Submit guess" \
    "dfx canister call game_engine submitGuess '(record { roundId = 0; guessLat = 35.6800; guessLon = 139.6500; guessAzim = 50.0 })'" \
    "Score:"

# Test 8: Check balance
run_test "Check SPOT balance" \
    "dfx canister call reward_mint icrc1_balance_of '(record { owner = principal \"'$(dfx identity get-principal)'\"; subaccount = null })'" \
    "0"

# Test 9: Get player stats
run_test "Get player stats" \
    "dfx canister call game_engine getPlayerStats '(principal \"'$(dfx identity get-principal)'\")'" \
    "totalRounds"

# Test 10: Photo reputation
run_test "Get photo reputation" \
    "dfx canister call reputation_oracle getPhotoReputation '(0)'" \
    "opt"

# Summary
echo ""
echo "========================================="
echo "Test Summary:"
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================="

# Stop replica
dfx stop

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi