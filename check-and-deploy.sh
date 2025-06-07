#!/bin/bash

export DFX_WARNING=-mainnet_plaintext_identity

echo "=== Checking Cycles Balance ==="
balance=$(dfx cycles balance --network playground | grep -o '[0-9.]*' | head -1)
echo "Current balance: $balance TC"

if (( $(echo "$balance < 0.1" | bc -l) )); then
    echo ""
    echo "⚠️  Insufficient cycles! You need at least 0.1 TC to deploy."
    echo ""
    echo "Your Principal ID: kp3jy-nzopx-eq5zo-s2x3r-bzgf6-s3coz-dag7m-egdeo-sydev-zdk3i-kqe"
    echo ""
    echo "Please get cycles from the faucet:"
    echo "1. Visit: https://faucet.dfinity.org/"
    echo "2. Enter your principal ID"
    echo "3. Request cycles"
    echo ""
    echo "After getting cycles, run this script again."
    exit 1
fi

echo ""
echo "✅ Sufficient cycles available!"
echo ""
echo "=== Deploying to Playground ==="

# Deploy the unified canister
dfx deploy unified --network playground --yes

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Your canister is deployed!"
echo ""

# Get the canister ID
canister_id=$(dfx canister id unified --network playground)
echo "Canister ID: $canister_id"
echo "URL: https://$canister_id.icp0.io"
echo ""
echo "=== Update Frontend Configuration ==="
echo ""
echo "Create or update src/frontend/.env with:"
echo "EXPO_PUBLIC_UNIFIED_CANISTER_ID=$canister_id"
echo "EXPO_PUBLIC_IC_HOST=https://icp0.io"