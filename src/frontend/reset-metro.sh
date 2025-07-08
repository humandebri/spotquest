#!/bin/bash

echo "🧹 Cleaning Metro bundler cache..."

# Kill any running Metro processes
pkill -f "react-native start" || true
pkill -f "metro" || true

# Clear various caches
rm -rf $TMPDIR/metro-*
rm -rf $TMPDIR/haste-*
rm -rf $TMPDIR/react-*
rm -rf ~/.metro-cache
rm -rf node_modules/.cache/

# Clear watchman if installed
if command -v watchman &> /dev/null; then
    echo "Clearing watchman..."
    watchman watch-del-all
fi

# Clear Expo cache
rm -rf .expo/

echo "✅ Metro cache cleared!"
echo "Run 'npx expo start -c' to start with fresh cache"