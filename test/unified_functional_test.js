#!/usr/bin/env node

/**
 * Functional Tests for Unified Canister (Mainnet)
 * 
 * This test suite validates all major functionality of the unified canister
 * deployed on mainnet. It can be run before and after refactoring to ensure
 * no functionality is broken.
 */

const { Actor, HttpAgent } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');
const { Ed25519KeyIdentity } = require('@dfinity/identity');

// Configuration
const MAINNET_CANISTER_ID = '77fv5-oiaaa-aaaal-qsoea-cai';
const IC_HOST = 'https://ic0.app';

// Test results storage
let testResults = [];
let currentTestSuite = '';

// IDL Factory for unified canister
const idlFactory = ({ IDL }) => {
  // Define types
  const HintType = IDL.Variant({
    BasicRadius: IDL.Null,
    PremiumRadius: IDL.Null,
    DirectionHint: IDL.Null,
  });

  const HintContent = IDL.Variant({
    RadiusHint: IDL.Record({
      centerLat: IDL.Float64,
      centerLon: IDL.Float64,
      radius: IDL.Float64,
    }),
    DirectionHint: IDL.Text,
  });

  const HintData = IDL.Record({
    hintType: HintType,
    data: HintContent,
  });

  const RoundStatus = IDL.Variant({
    Active: IDL.Null,
    Completed: IDL.Null,
    Abandoned: IDL.Null,
  });

  const GuessData = IDL.Record({
    lat: IDL.Float64,
    lon: IDL.Float64,
    azimuth: IDL.Opt(IDL.Float64),
    confidenceRadius: IDL.Float64,
    submittedAt: IDL.Int,
  });

  const RoundState = IDL.Record({
    photoId: IDL.Nat,
    status: RoundStatus,
    score: IDL.Nat,
    scoreNorm: IDL.Nat,
    guessData: IDL.Opt(GuessData),
    retryAvailable: IDL.Bool,
    hintsPurchased: IDL.Vec(HintType),
    startTime: IDL.Int,
    endTime: IDL.Opt(IDL.Int),
  });

  const SessionResult = IDL.Record({
    sessionId: IDL.Text,
    userId: IDL.Principal,
    totalScore: IDL.Nat,
    totalScoreNorm: IDL.Nat,
    completedRounds: IDL.Nat,
    totalRounds: IDL.Nat,
    playerReward: IDL.Nat,
    uploaderRewards: IDL.Vec(IDL.Tuple(IDL.Principal, IDL.Nat)),
    duration: IDL.Nat,
    rank: IDL.Opt(IDL.Nat),
  });

  const Account = IDL.Record({ 
    owner: IDL.Principal, 
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)) 
  });

  const Guess = IDL.Record({
    player: IDL.Principal,
    photoId: IDL.Nat,
    lat: IDL.Float64,
    lon: IDL.Float64,
    dist: IDL.Float64,
    sessionId: IDL.Text,
    timestamp: IDL.Int,
  });

  const Heatmap = IDL.Record({
    photoId: IDL.Nat,
    heatmap: IDL.Vec(IDL.Vec(IDL.Float64)),
    bounds: IDL.Record({
      minLat: IDL.Float64,
      maxLat: IDL.Float64,
      minLon: IDL.Float64,
      maxLon: IDL.Float64,
    }),
    gridSize: IDL.Nat,
    totalGuesses: IDL.Nat,
  });

  const PhotoMeta = IDL.Record({
    id: IDL.Nat,
    owner: IDL.Principal,
    lat: IDL.Float64,
    lon: IDL.Float64,
    azim: IDL.Float64,
    timestamp: IDL.Nat,
    quality: IDL.Float64,
    uploadTime: IDL.Nat,
    chunkCount: IDL.Nat,
    totalSize: IDL.Nat,
    perceptualHash: IDL.Opt(IDL.Text),
  });

  const Result_Text = IDL.Variant({
    ok: IDL.Text,
    err: IDL.Text,
  });

  const Result_RoundState = IDL.Variant({
    ok: RoundState,
    err: IDL.Text,
  });

  const Result_HintData = IDL.Variant({
    ok: HintData,
    err: IDL.Text,
  });

  const Result_SessionResult = IDL.Variant({
    ok: SessionResult,
    err: IDL.Text,
  });

  const Result_Nat = IDL.Variant({
    ok: IDL.Nat,
    err: IDL.Text,
  });

  const Result_Heatmap = IDL.Variant({
    ok: Heatmap,
    err: IDL.Text,
  });

  return IDL.Service({
    // Token functions (ICRC-1)
    icrc1_name: IDL.Func([], [IDL.Text], ['query']),
    icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
    icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
    icrc1_fee: IDL.Func([], [IDL.Nat], ['query']),
    icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),
    
    // Game Engine functions
    createSession: IDL.Func([], [Result_Text], []),
    getNextRound: IDL.Func([IDL.Text], [Result_RoundState], []),
    submitGuess: IDL.Func(
      [IDL.Text, IDL.Float64, IDL.Float64, IDL.Opt(IDL.Float64), IDL.Float64], 
      [Result_RoundState], 
      []
    ),
    purchaseHint: IDL.Func([IDL.Text, HintType], [Result_HintData], []),
    finalizeSession: IDL.Func([IDL.Text], [Result_SessionResult], []),
    
    // Guess History functions
    recordGuess: IDL.Func([Guess], [Result_Nat], []),
    getPhotoGuesses: IDL.Func([IDL.Nat, IDL.Opt(IDL.Nat)], [IDL.Vec(Guess)], ['query']),
    getPlayerHistory: IDL.Func([IDL.Principal, IDL.Opt(IDL.Nat)], [IDL.Vec(IDL.Nat)], ['query']),
    generateHeatmap: IDL.Func([IDL.Nat], [Result_Heatmap], ['query']),
    
    // Treasury functions
    getTreasuryStats: IDL.Func([], [IDL.Record({
      balance: IDL.Nat,
      totalBurned: IDL.Nat,
      totalSunk: IDL.Nat,
    })], ['query']),
    getSinkHistory: IDL.Func([IDL.Opt(IDL.Nat)], [IDL.Vec(IDL.Tuple(IDL.Int, IDL.Text, IDL.Nat))], ['query']),
    
    // Photo functions
    getPhotoMeta: IDL.Func([IDL.Nat], [IDL.Opt(PhotoMeta)], ['query']),
    getUserPhotos: IDL.Func([IDL.Principal], [IDL.Vec(PhotoMeta)], ['query']),
  });
};

// Test helper functions
function addTestResult(testName, passed, details) {
  const result = {
    suite: currentTestSuite,
    test: testName,
    passed: passed,
    details: details,
    timestamp: new Date().toISOString()
  };
  
  testResults.push(result);
  console.log(`${passed ? '✅' : '❌'} ${testName}: ${details}`);
}

async function createActor() {
  const agent = new HttpAgent({
    host: IC_HOST,
  });

  // Create a test identity (anonymous for read-only tests)
  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId: MAINNET_CANISTER_ID,
  });

  return actor;
}

// Test suites
async function testTokenMetadata(actor) {
  console.log('\n=== Testing Token Metadata (ICRC-1) ===');
  currentTestSuite = 'Token Metadata';

  try {
    const name = await actor.icrc1_name();
    const symbol = await actor.icrc1_symbol();
    const decimals = await actor.icrc1_decimals();
    const fee = await actor.icrc1_fee();
    const totalSupply = await actor.icrc1_total_supply();

    addTestResult(
      'Token metadata query',
      name === 'Guess the Spot Token' && symbol === 'SPOT' && decimals === 2,
      `Name: ${name}, Symbol: ${symbol}, Decimals: ${decimals}, Fee: ${fee}, Supply: ${totalSupply}`
    );
  } catch (error) {
    addTestResult('Token metadata query', false, `Error: ${error.message}`);
  }
}

async function testTokenBalance(actor) {
  console.log('\n=== Testing Token Balance ===');
  currentTestSuite = 'Token Balance';

  try {
    const testAccount = {
      owner: Principal.fromText('2vxsx-fae'),
      subaccount: []
    };

    const balance = await actor.icrc1_balance_of(testAccount);
    addTestResult(
      'Balance query',
      typeof balance === 'bigint',
      `Balance: ${balance} (${Number(balance) / 100} SPOT)`
    );
  } catch (error) {
    addTestResult('Balance query', false, `Error: ${error.message}`);
  }
}

async function testGuessHistory(actor) {
  console.log('\n=== Testing Guess History ===');
  currentTestSuite = 'Guess History';

  try {
    // Test getting photo guesses
    const guesses = await actor.getPhotoGuesses(1, [10]);
    addTestResult(
      'Get photo guesses',
      Array.isArray(guesses),
      `Found ${guesses.length} guesses for photo ID 1`
    );

    // Test getting player history
    const testPlayer = Principal.fromText('2vxsx-fae');
    const history = await actor.getPlayerHistory(testPlayer, [10]);
    addTestResult(
      'Get player history',
      Array.isArray(history),
      `Player has guessed ${history.length} photos`
    );

    // Test heatmap generation
    const heatmapResult = await actor.generateHeatmap(1);
    if ('ok' in heatmapResult) {
      addTestResult(
        'Generate heatmap',
        true,
        `Grid size: ${heatmapResult.ok.gridSize}, Total guesses: ${heatmapResult.ok.totalGuesses}`
      );
    } else {
      addTestResult('Generate heatmap', false, `Error: ${heatmapResult.err}`);
    }
  } catch (error) {
    addTestResult('Guess history functions', false, `Error: ${error.message}`);
  }
}

async function testTreasuryStats(actor) {
  console.log('\n=== Testing Treasury Stats ===');
  currentTestSuite = 'Treasury';

  try {
    const stats = await actor.getTreasuryStats();
    addTestResult(
      'Get treasury stats',
      true,
      `Balance: ${stats.balance}, Burned: ${stats.totalBurned}, Sunk: ${stats.totalSunk}`
    );

    const history = await actor.getSinkHistory([5]);
    addTestResult(
      'Get sink history',
      Array.isArray(history),
      `Found ${history.length} sink history entries`
    );
  } catch (error) {
    addTestResult('Treasury functions', false, `Error: ${error.message}`);
  }
}

async function testPhotoQueries(actor) {
  console.log('\n=== Testing Photo Queries ===');
  currentTestSuite = 'Photo';

  try {
    // Test getting photo metadata
    const photoMeta = await actor.getPhotoMeta(1);
    if (photoMeta.length > 0) {
      const meta = photoMeta[0];
      addTestResult(
        'Get photo metadata',
        true,
        `Photo owner: ${meta.owner.toText()}, Location: (${meta.lat}, ${meta.lon})`
      );
    } else {
      addTestResult('Get photo metadata', true, 'Photo not found (expected for new deployment)');
    }

    // Test getting user photos
    const testUser = Principal.fromText('2vxsx-fae');
    const userPhotos = await actor.getUserPhotos(testUser);
    addTestResult(
      'Get user photos',
      Array.isArray(userPhotos),
      `User has ${userPhotos.length} photos`
    );
  } catch (error) {
    addTestResult('Photo queries', false, `Error: ${error.message}`);
  }
}

// Main test runner
async function runAllTests() {
  console.log('========================================');
  console.log('Unified Canister Functional Tests');
  console.log(`Canister: ${MAINNET_CANISTER_ID}`);
  console.log(`Network: Mainnet (${IC_HOST})`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('========================================');

  const actor = await createActor();

  // Run all test suites
  await testTokenMetadata(actor);
  await testTokenBalance(actor);
  await testGuessHistory(actor);
  await testTreasuryStats(actor);
  await testPhotoQueries(actor);

  // Print summary
  console.log('\n========================================');
  console.log('Test Summary');
  console.log('========================================');
  
  const passed = testResults.filter(r => r.passed).length;
  const failed = testResults.filter(r => !r.passed).length;
  
  console.log(`Total tests: ${testResults.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((passed / testResults.length) * 100).toFixed(2)}%`);

  // Save results to file
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `test/unified_functional_results_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify({
    canisterId: MAINNET_CANISTER_ID,
    network: 'mainnet',
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.length,
      passed: passed,
      failed: failed,
      successRate: ((passed / testResults.length) * 100).toFixed(2) + '%'
    },
    results: testResults
  }, null, 2));
  
  console.log(`\nTest results saved to: ${filename}`);
}

// Run tests
runAllTests().catch(console.error);