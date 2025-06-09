#!/bin/bash

# Integration tests for Unified Canister

echo "🧪 Starting unified canister integration tests..."

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

# Stop any existing dfx processes
dfx stop

# Start local replica
echo "Starting local replica..."
dfx start --clean --background

# Wait for replica to start
sleep 5

# Deploy unified canister
echo "Deploying unified canister..."
dfx deploy unified

# Get canister ID
UNIFIED_ID=$(dfx canister id unified)
echo "Unified canister ID: $UNIFIED_ID"

# Initialize the canister
echo "Initializing canister..."
dfx canister call unified init

# Test token functionality
echo -e "\n${YELLOW}=== Testing Token Functionality ===${NC}"
run_test "Token name" "dfx canister call unified icrc1_name '()'" "Guess the Spot Token"
run_test "Token symbol" "dfx canister call unified icrc1_symbol '()'" "SPOT"
run_test "Token decimals" "dfx canister call unified icrc1_decimals '()'" "2"
run_test "Token fee" "dfx canister call unified icrc1_fee '()'" "1"
run_test "Initial supply" "dfx canister call unified icrc1_total_supply '()'" "0"

# Test game session functionality
echo -e "\n${YELLOW}=== Testing Game Session Functionality ===${NC}"
run_test "Create session" "dfx canister call unified createSession '()'" "ok"

# Get session ID from previous result
SESSION_ID=$(dfx canister call unified createSession '()' | grep -o '"[^"]*"' | tr -d '"')

# Test photo upload (simplified)
echo -e "\n${YELLOW}=== Testing Photo Upload ===${NC}"
run_test "Upload photo" "dfx canister call unified uploadPhoto '(record {
    meta = record {
        imageData = blob \"\\00\\01\\02\\03\";
        latitude = 35.6762;
        longitude = 139.6503;
        azimuth = opt 45.0;
        captureTime = 1700000000000000000;
        uploadTime = 1700000000000000000;
        deviceInfo = opt \"iPhone 12\";
    };
    totalChunks = 1;
    scheduledPublishTime = null;
    title = \"Tokyo Tower\";
    description = \"Famous landmark in Tokyo\";
    difficulty = variant { NORMAL };
    hint = \"Look for the red and white tower\";
    tags = vec { \"tokyo\"; \"landmark\" };
})'" "ok"

# Test reputation functionality
echo -e "\n${YELLOW}=== Testing Reputation Functionality ===${NC}"
run_test "Get reputation" "dfx canister call unified getReputation '(principal \"'$(dfx identity get-principal)'\")'" "score"
run_test "Generate referral code" "dfx canister call unified generateReferralCode '()'" "ok"

# Test treasury stats
echo -e "\n${YELLOW}=== Testing Treasury Functionality ===${NC}"
run_test "Get treasury stats" "dfx canister call unified getTreasuryStats '()'" "balance"

# Test system stats
echo -e "\n${YELLOW}=== Testing System Stats ===${NC}"
run_test "Get system stats" "dfx canister call unified getSystemStats '()'" "totalUsers"

# Test leaderboard
echo -e "\n${YELLOW}=== Testing Leaderboard ===${NC}"
run_test "Get leaderboard" "dfx canister call unified getLeaderboard '(10)'" "vec"

# Summary
echo -e "\n========================================="
echo "Test Summary:"
echo -e "  Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "  Failed: ${RED}$TESTS_FAILED${NC}"
echo "========================================="

# Stop dfx
dfx stop

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi