#!/bin/bash

# Test certificate validation
echo "Testing certificate validation for spotquest canister..."

CANISTER_ID="77fv5-oiaaa-aaaal-qsoea-cai"

# Test 1: Raw URL (should work)
echo -e "\n1. Testing raw URL (no certificate validation):"
curl -s "https://${CANISTER_ID}.raw.icp0.io/" | head -20

# Test 2: Certified URL
echo -e "\n\n2. Testing certified URL (with certificate validation):"
curl -sI "https://${CANISTER_ID}.icp0.io/"

# Test 3: Check debug endpoint
echo -e "\n\n3. Checking certification details:"
curl -s "https://${CANISTER_ID}.raw.icp0.io/debug/cert-details"

# Test 4: Check if we're actually serving requests
echo -e "\n\n4. Triggering a request and checking logs:"
curl -s "https://${CANISTER_ID}.icp0.io/" > /dev/null 2>&1
sleep 3
dfx canister --network ic logs unified | tail -20 | grep -E "(Serving|Certificate|Response hash|Available assets)"