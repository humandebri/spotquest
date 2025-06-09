#!/bin/bash

# Unified Canister Integration Test Runner
# This script runs comprehensive tests on the unified canister

echo "=========================================="
echo "Unified Canister Integration Tests"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if dfx is running
if ! dfx ping local 2>/dev/null; then
    echo -e "${RED}Error: dfx is not running. Please start dfx with 'dfx start --clean'${NC}"
    exit 1
fi

# Function to run a command and check its result
run_command() {
    local description=$1
    local command=$2
    
    echo -n "🔄 $description... "
    
    if eval "$command" > /tmp/test_output.log 2>&1; then
        echo -e "${GREEN}✓${NC}"
        return 0
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}Error output:${NC}"
        cat /tmp/test_output.log
        return 1
    fi
}

# Deploy canisters
echo -e "${YELLOW}Deploying canisters...${NC}"
echo ""

run_command "Deploying unified canister" "dfx deploy unified"
run_command "Deploying test canister" "dfx deploy unified_integration_test"

echo ""
echo -e "${YELLOW}Running integration tests...${NC}"
echo ""

# Run the tests
echo "Executing test suite..."
dfx canister call unified_integration_test runAllTests

echo ""
echo -e "${YELLOW}Test execution complete!${NC}"
echo ""

# Save test results
echo "Saving test results to test/unified_test_results_$(date +%Y%m%d_%H%M%S).txt"
dfx canister call unified_integration_test runAllTests > "test/unified_test_results_$(date +%Y%m%d_%H%M%S).txt" 2>&1

echo ""
echo "=========================================="
echo "Test run finished"
echo "=========================================="