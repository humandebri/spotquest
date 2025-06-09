#!/usr/bin/env node

/**
 * Quick Mainnet Canister Health Check
 * 
 * This script performs a quick health check on the mainnet unified canister
 * to verify it's responding correctly before refactoring.
 */

const { Actor, HttpAgent } = require('@dfinity/agent');
const { Principal } = require('@dfinity/principal');

const CANISTER_ID = '77fv5-oiaaa-aaaal-qsoea-cai';

// Minimal IDL for quick checks
const idlFactory = ({ IDL }) => {
  return IDL.Service({
    icrc1_name: IDL.Func([], [IDL.Text], ['query']),
    icrc1_symbol: IDL.Func([], [IDL.Text], ['query']),
    icrc1_decimals: IDL.Func([], [IDL.Nat8], ['query']),
    icrc1_total_supply: IDL.Func([], [IDL.Nat], ['query']),
    getTreasuryStats: IDL.Func([], [IDL.Record({
      balance: IDL.Nat,
      totalBurned: IDL.Nat,
      totalSunk: IDL.Nat,
    })], ['query']),
  });
};

async function runQuickTest() {
  console.log('🏥 Unified Canister Health Check');
  console.log('================================');
  console.log(`Canister ID: ${CANISTER_ID}`);
  console.log(`Network: Mainnet`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('');

  const agent = new HttpAgent({ host: 'https://ic0.app' });
  const actor = Actor.createActor(idlFactory, {
    agent,
    canisterId: CANISTER_ID,
  });

  const results = [];

  // Test 1: Token Name
  try {
    console.log('📍 Checking token name...');
    const name = await actor.icrc1_name();
    results.push({ test: 'Token Name', status: '✅', value: name });
    console.log(`   ✅ Token name: ${name}`);
  } catch (e) {
    results.push({ test: 'Token Name', status: '❌', error: e.message });
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 2: Token Symbol
  try {
    console.log('📍 Checking token symbol...');
    const symbol = await actor.icrc1_symbol();
    results.push({ test: 'Token Symbol', status: '✅', value: symbol });
    console.log(`   ✅ Token symbol: ${symbol}`);
  } catch (e) {
    results.push({ test: 'Token Symbol', status: '❌', error: e.message });
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 3: Decimals
  try {
    console.log('📍 Checking decimals...');
    const decimals = await actor.icrc1_decimals();
    results.push({ test: 'Decimals', status: '✅', value: decimals });
    console.log(`   ✅ Decimals: ${decimals}`);
  } catch (e) {
    results.push({ test: 'Decimals', status: '❌', error: e.message });
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 4: Total Supply
  try {
    console.log('📍 Checking total supply...');
    const supply = await actor.icrc1_total_supply();
    results.push({ test: 'Total Supply', status: '✅', value: supply.toString() });
    console.log(`   ✅ Total supply: ${supply} (${Number(supply) / 100} SPOT)`);
  } catch (e) {
    results.push({ test: 'Total Supply', status: '❌', error: e.message });
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Test 5: Treasury Stats
  try {
    console.log('📍 Checking treasury stats...');
    const stats = await actor.getTreasuryStats();
    results.push({ test: 'Treasury Stats', status: '✅', value: stats });
    console.log(`   ✅ Treasury balance: ${stats.balance}`);
    console.log(`   ✅ Total burned: ${stats.totalBurned}`);
    console.log(`   ✅ Total sunk: ${stats.totalSunk}`);
  } catch (e) {
    results.push({ test: 'Treasury Stats', status: '❌', error: e.message });
    console.log(`   ❌ Error: ${e.message}`);
  }

  // Summary
  console.log('');
  console.log('================================');
  console.log('Summary:');
  const passed = results.filter(r => r.status === '✅').length;
  const failed = results.filter(r => r.status === '❌').length;
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Success Rate: ${((passed / results.length) * 100).toFixed(0)}%`);
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Canister is healthy.');
  } else {
    console.log('\n⚠️  Some tests failed. Please investigate before refactoring.');
  }

  // Save results
  const fs = require('fs');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const filename = `test/health_check_${timestamp}.json`;
  
  fs.writeFileSync(filename, JSON.stringify({
    canisterId: CANISTER_ID,
    timestamp: new Date().toISOString(),
    passed: passed,
    failed: failed,
    results: results
  }, null, 2));
  
  console.log(`\n📁 Results saved to: ${filename}`);
}

runQuickTest().catch(console.error);