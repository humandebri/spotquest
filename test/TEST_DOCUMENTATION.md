# Main Canister Test Documentation

## Overview
This document describes the comprehensive test suite for the main canister. These tests should be run before and after any refactoring to ensure functionality is preserved.

## Test Files

### 1. `unified_integration.test.mo` - Motoko Integration Tests
Complete integration tests written in Motoko that test all canister functionality.

**Test Coverage:**
- ✅ Initialization and system setup
- ✅ ICRC-1 Token operations (name, symbol, decimals, balance, transfer)
- ✅ Game session management (create, rounds, submit guess, finalize)
- ✅ Hint system (purchase, duplicate prevention)
- ✅ Guess history (record, retrieve, heatmap generation)
- ✅ Treasury and sink functions
- ✅ Photo operations (upload, metadata, user photos)
- ✅ Reputation system (user and photo reputation)
- ✅ Error handling (invalid inputs, unauthorized access)
- ✅ Concurrency limits (max sessions per user)

### 2. `unified_functional_test.js` - JavaScript Functional Tests
Functional tests that can be run against the deployed mainnet canister.

**Test Coverage:**
- ✅ Token metadata queries
- ✅ Token balance queries
- ✅ Guess history retrieval
- ✅ Treasury statistics
- ✅ Photo metadata queries

### 3. `run_unified_tests.sh` - Test Runner Script
Shell script to deploy and run the Motoko integration tests locally.

## Running the Tests

### Prerequisites
- Node.js and npm installed
- dfx SDK installed (for Motoko tests)
- Internet connection (for mainnet tests)

### Running Mainnet Functional Tests
```bash
# Install dependencies (if not already installed)
cd src/frontend
npm install

# Run the functional tests
cd ../../test
node unified_functional_test.js
```

### Running Local Integration Tests
```bash
# Start dfx locally
dfx start --clean

# In another terminal, run the tests
cd test
./run_unified_tests.sh
```

## Test Results

Test results are saved in the following formats:
- `unified_functional_results_[timestamp].json` - Mainnet test results
- `unified_test_results_[timestamp].txt` - Local integration test results

## Key Test Scenarios

### 1. Token Operations
- Verify token metadata (name, symbol, decimals)
- Check balance queries work correctly
- Test transfer operations (requires tokens)

### 2. Game Flow
- Create a game session
- Get next round
- Submit a guess
- Purchase hints
- Finalize session and receive rewards

### 3. Data Integrity
- Ensure guess history is recorded
- Verify heatmap generation
- Check photo metadata storage

### 4. Security
- Test authorization checks
- Verify input validation
- Check concurrency limits

### 5. Treasury Management
- Monitor sink operations
- Track burned tokens
- Verify treasury balance

## Before Refactoring Checklist

1. **Run all tests and save results:**
   ```bash
   # Run mainnet tests
   node test/unified_functional_test.js
   
   # Save the output files
   cp test/unified_functional_results_*.json test/before_refactor/
   ```

2. **Document current behavior:**
   - Note any failing tests
   - Record performance metrics
   - Save current canister state if needed

3. **Create baseline:**
   - Git commit all test results
   - Tag the commit as "pre-refactor-baseline"

## After Refactoring Checklist

1. **Run the same tests:**
   ```bash
   # Run mainnet tests again
   node test/unified_functional_test.js
   ```

2. **Compare results:**
   - All previously passing tests should still pass
   - No new failures should be introduced
   - Performance should be same or better

3. **Regression check:**
   - Compare test output files
   - Verify no functionality was lost
   - Check for any behavioral changes

## Important Notes

1. **Mainnet Testing**: The functional tests run against the actual mainnet canister, so they only perform read operations to avoid state changes.

2. **Local Testing**: The Motoko integration tests can perform write operations since they run on a local replica.

3. **Test Data**: Tests use predictable test data to ensure reproducibility.

4. **Error Handling**: Tests include both positive and negative test cases to ensure proper error handling.

## Extending the Tests

To add new tests:

1. **For Motoko tests**: Add new test functions in `unified_integration.test.mo`
2. **For JS tests**: Add new test suites in `unified_functional_test.js`
3. **Update this documentation** with the new test coverage

## Troubleshooting

### Common Issues

1. **Certificate verification errors**: Ensure you're using the correct network settings
2. **Balance issues**: Some tests require tokens to be minted first
3. **Session limits**: Clean up old sessions if hitting concurrency limits
4. **Network timeouts**: Retry tests if network is slow
