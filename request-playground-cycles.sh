#!/bin/bash

echo "=== Requesting free cycles from IC Playground Dispenser ==="

export DFX_WARNING=-mainnet_plaintext_identity

# Get principal
PRINCIPAL=$(dfx identity get-principal --network playground)
echo "Your principal: $PRINCIPAL"

# Try the cycles dispenser
echo ""
echo "Requesting cycles from the playground dispenser..."
dfx canister --network playground call 53zcu-tiaaa-aaaaa-qaaba-cai request_cycles "(record { canister_id = null })" || true

# Check balance
echo ""
echo "Checking cycles balance..."
dfx cycles balance --network playground

echo ""
echo "If you still don't have cycles, try:"
echo "1. Visit https://faucet.dfinity.org/"
echo "2. Enter your principal: $PRINCIPAL"
echo "3. Get a coupon code"
echo "4. Run: dfx cycles --network playground redeem-faucet-coupon <COUPON_CODE>"