#!/bin/bash

# Test the certification of HTTP responses

echo "Testing HTTP response certification..."
echo

# First test the root path
echo "1. Testing root path (/):"
curl -v "https://${CANISTER_ID}.raw.ic0.app/" 2>&1 | grep -E "(ic-certificate|HTTP/|spotquest-ready)"
echo

# Test debug endpoint
echo "2. Testing debug endpoint:"
curl "https://${CANISTER_ID}.raw.ic0.app/debug/cert" 2>&1
echo

# Test certificate test endpoint
echo "3. Testing certificate test endpoint:"
curl "https://${CANISTER_ID}.raw.ic0.app/debug/cert-test" 2>&1
echo

echo "Test complete. Check if 'ic-certificate' header is present and properly formatted."