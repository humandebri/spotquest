#!/bin/bash

# Guess-the-Spot Production Deployment Script
# Usage: ./scripts/deploy-production.sh

set -e

echo "========================================="
echo "Guess-the-Spot Production Deployment"
echo "========================================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v dfx &> /dev/null; then
    echo "❌ DFX is not installed. Please install DFX first."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js v18+ first."
    exit 1
fi

# Check if .env.production exists
if [ ! -f "src/frontend/.env.production" ]; then
    echo "❌ .env.production not found. Please create it from .env.example"
    echo "   cp src/frontend/.env.example src/frontend/.env.production"
    echo "   Then update the values accordingly"
    exit 1
fi

# Confirm deployment
echo ""
echo "⚠️  WARNING: You are about to deploy to ICP MAINNET"
echo "This will consume cycles and deploy to production."
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Build frontend
echo ""
echo "📦 Building frontend..."
cd src/frontend
npm install
npm run build
cd ../..

# Check cycles balance
echo ""
echo "💰 Checking cycles balance..."
dfx wallet --network ic balance

# Deploy integrated canister
echo ""
echo "🚀 Deploying integrated canister..."
CANISTER_ID=$(dfx deploy integrated --network ic --with-cycles 1_000_000_000_000 2>&1 | grep -o "integrated: [a-z0-9-]*" | cut -d' ' -f2)

if [ -z "$CANISTER_ID" ]; then
    echo "❌ Failed to deploy canister"
    exit 1
fi

echo "✅ Canister deployed with ID: $CANISTER_ID"

# Update .env.production with canister ID
echo ""
echo "📝 Updating environment variables..."
sed -i.bak "s/VITE_INTEGRATED_CANISTER_ID=.*/VITE_INTEGRATED_CANISTER_ID=$CANISTER_ID/" src/frontend/.env.production
sed -i.bak "s/VITE_HOST=.*/VITE_HOST=https:\/\/ic0.app/" src/frontend/.env.production

# Rebuild frontend with production config
echo ""
echo "📦 Rebuilding frontend with production config..."
cd src/frontend
npm run build
cd ../..

# Upload assets
echo ""
echo "📤 Uploading frontend assets..."
./scripts/deploy-integrated.sh
./upload_assets.sh $CANISTER_ID

# Set admin principal
echo ""
echo "🔐 Setting admin principal..."
echo "Please enter your admin principal ID:"
read -p "Admin Principal: " ADMIN_PRINCIPAL

dfx canister --network ic call integrated setAdmin "(principal \"$ADMIN_PRINCIPAL\")"

# Verify deployment
echo ""
echo "✅ Deployment complete!"
echo ""
echo "========================================="
echo "🎮 Your app is live at:"
echo "   https://$CANISTER_ID.ic0.app"
echo ""
echo "📊 Canister Status:"
dfx canister --network ic status integrated
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Save your canister ID: $CANISTER_ID"
echo "2. Monitor cycles balance regularly"
echo "3. Set up automated backups"
echo "4. Configure monitoring alerts"
echo "========================================="