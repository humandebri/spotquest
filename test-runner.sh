#!/bin/bash

# Test runner script for Guess-the-Spot

echo "🧪 Running Guess-the-Spot Tests"
echo "================================"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Test results
PASSED=0
FAILED=0

# Function to run tests
run_test_suite() {
    local suite_name=$1
    local command=$2
    
    echo -e "\n${YELLOW}Running $suite_name...${NC}"
    
    if eval $command; then
        echo -e "${GREEN}✓ $suite_name passed${NC}"
        ((PASSED++))
    else
        echo -e "${RED}✗ $suite_name failed${NC}"
        ((FAILED++))
    fi
}

# 1. Run Motoko unit tests
echo -e "\n${YELLOW}1. Motoko Unit Tests${NC}"
echo "------------------------"

# Check if dfx is running
if ! dfx ping > /dev/null 2>&1; then
    echo "Starting local dfx..."
    dfx start --clean --background
    sleep 5
fi

# Deploy canisters for testing
echo "Deploying canisters..."
dfx deploy

# Run Motoko tests
run_test_suite "RewardMint Tests" "dfx canister call test runAllTests"
run_test_suite "GameEngine Tests" "dfx canister call test runAllTests"

# 2. Run integration tests
echo -e "\n${YELLOW}2. Integration Tests${NC}"
echo "------------------------"
run_test_suite "Integration Tests" "./test/integration.test.sh"

# 3. Run frontend tests
echo -e "\n${YELLOW}3. Frontend E2E Tests (Playwright)${NC}"
echo "------------------------"

# Start frontend dev server if not running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "Starting frontend dev server..."
    cd src/frontend
    npm run dev &
    FRONTEND_PID=$!
    sleep 5
    cd ../..
fi

# Run Playwright tests
cd src/frontend
run_test_suite "Home Page Tests" "npx playwright test home.spec.ts"
run_test_suite "Game Page Tests" "npx playwright test game.spec.ts"
run_test_suite "Upload Page Tests" "npx playwright test upload.spec.ts"
run_test_suite "Leaderboard Tests" "npx playwright test leaderboard.spec.ts"
run_test_suite "Profile Tests" "npx playwright test profile.spec.ts"
run_test_suite "PWA Tests" "npx playwright test pwa.spec.ts"
run_test_suite "Integration Tests" "npx playwright test integration.spec.ts"
run_test_suite "Performance Tests" "npx playwright test performance.spec.ts"
cd ../..

# 4. Run linting
echo -e "\n${YELLOW}4. Code Quality Checks${NC}"
echo "------------------------"
run_test_suite "Frontend Linting" "cd src/frontend && npm run lint"

# Clean up
echo -e "\n${YELLOW}Cleaning up...${NC}"

# Kill frontend server if we started it
if [ ! -z "$FRONTEND_PID" ]; then
    kill $FRONTEND_PID 2>/dev/null
fi

# Stop dfx
dfx stop

# Summary
echo -e "\n================================"
echo -e "${YELLOW}Test Summary:${NC}"
echo -e "  ${GREEN}Passed: $PASSED${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo "================================"

# Generate test report
if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}All tests passed! 🎉${NC}"
    
    # Generate Playwright HTML report
    cd src/frontend
    npx playwright show-report
    cd ../..
    
    exit 0
else
    echo -e "\n${RED}Some tests failed. Please check the logs above.${NC}"
    exit 1
fi