#!/bin/bash

echo "=== Testing Playground Deployment ==="
echo ""

# Set environment variable to suppress warning
export DFX_WARNING=-mainnet_plaintext_identity

# Check if unified canister exists
if ! dfx canister id unified --network playground 2>/dev/null; then
    echo "Error: Unified canister not found. Please deploy first using ./deploy-playground.sh"
    exit 1
fi

CANISTER_ID=$(dfx canister id unified --network playground)
PRINCIPAL=$(dfx identity get-principal)

echo "Testing canister: $CANISTER_ID"
echo "Your principal: $PRINCIPAL"
echo ""

echo "1. Getting token metadata..."
dfx canister call unified icrc1_metadata '()' --network playground
echo ""

echo "2. Getting token symbol..."
dfx canister call unified icrc1_symbol '()' --network playground
echo ""

echo "3. Getting token name..."
dfx canister call unified icrc1_name '()' --network playground
echo ""

echo "4. Getting token decimals..."
dfx canister call unified icrc1_decimals '()' --network playground
echo ""

echo "5. Checking your balance..."
dfx canister call unified icrc1_balance_of "(record { owner = principal \"$PRINCIPAL\" })" --network playground
echo ""

echo "6. Getting total supply..."
dfx canister call unified icrc1_total_supply '()' --network playground
echo ""

echo "7. Testing mint function (requesting tokens)..."
dfx canister call unified mint_tokens "(principal \"$PRINCIPAL\", 10000)" --network playground
echo ""

echo "8. Checking balance after mint..."
dfx canister call unified icrc1_balance_of "(record { owner = principal \"$PRINCIPAL\" })" --network playground
echo ""

echo "=== Test Complete ==="