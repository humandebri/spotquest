#!/usr/bin/env node

// Test script to verify II integration endpoints are returning JSON

const CANISTER_URL = 'https://77fv5-oiaaa-aaaal-qsoea-cai.raw.icp0.io';

async function testEndpoint(path, method = 'GET', body = null) {
  console.log(`\nTesting ${method} ${path}...`);
  
  try {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    if (body) {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(CANISTER_URL + path, options);
    const text = await response.text();
    
    console.log(`Status: ${response.status}`);
    console.log(`Content-Type: ${response.headers.get('content-type')}`);
    console.log(`Response: ${text.substring(0, 200)}${text.length > 200 ? '...' : ''}`);
    
    // Try to parse as JSON
    try {
      const json = JSON.parse(text);
      console.log('✅ Valid JSON');
    } catch (e) {
      console.log('❌ Invalid JSON:', e.message);
    }
  } catch (error) {
    console.error('Request failed:', error.message);
  }
}

async function runTests() {
  console.log('II Integration Endpoint Tests');
  console.log('============================');
  
  // Test root endpoint
  await testEndpoint('/');
  
  // Test session creation
  await testEndpoint('/api/session/new', 'POST', {
    publicKey: 'test_public_key',
    redirectUri: 'https://auth.expo.io/@hude/guess-the-spot/auth'
  });
  
  // Test non-existent endpoint
  await testEndpoint('/api/invalid/endpoint');
  
  // Test OPTIONS for CORS
  await testEndpoint('/', 'OPTIONS');
}

runTests().catch(console.error);