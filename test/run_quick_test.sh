#!/bin/bash

echo "🚀 Running Quick Mainnet Health Check..."
echo ""

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Navigate to frontend directory to use existing dependencies
cd ../src/frontend

# Run the quick test
node ../../test/quick_mainnet_test.js

# Return to test directory
cd ../../test

echo ""
echo "✅ Health check complete!"