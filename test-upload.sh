#!/bin/bash

echo "=== Testing Backend Upload ==="

# Test the backend directly using dfx
echo "Getting token name..."
dfx canister call unified icrc1_name --query --network ic

echo ""
echo "=== Getting Token Balance ==="
PRINCIPAL="lqfvd-m7ihy-e5dvc-gngvr-blzbt-pupeq-6t7ua-r7v4p-bvqjw-ea7gl-4qe"
dfx canister call unified icrc1_balance_of "(record {owner=principal\"$PRINCIPAL\"; subaccount=null})" --query --network ic

echo ""
echo "=== Getting Total Supply ==="
dfx canister call unified icrc1_total_supply --query --network ic