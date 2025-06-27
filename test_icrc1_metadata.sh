#!/bin/bash

# Test icrc1_metadata function
echo "Testing icrc1_metadata function..."

# Test on local network
if [ "$1" == "local" ]; then
    dfx canister call unified icrc1_metadata '()'
else
    # Test on mainnet
    dfx canister --network ic call unified icrc1_metadata '()'
fi