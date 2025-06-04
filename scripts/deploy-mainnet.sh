#!/bin/bash

# Guess-the-Spot Mainnet Deployment Script
# This script deploys the individual canisters to ICP mainnet

set -e

echo "========================================="
echo "Guess-the-Spot Mainnet Deployment"
echo "========================================="

# Check prerequisites
echo "Checking prerequisites..."

if ! command -v dfx &> /dev/null; then
    echo "❌ DFX is not installed. Please install DFX first."
    exit 1
fi

# Check if .env.production exists
if [ ! -f "src/frontend/.env.production" ]; then
    echo "⚠️  Creating .env.production from template..."
    cp src/frontend/.env.example src/frontend/.env.production
fi

# Confirm deployment
echo ""
echo "⚠️  WARNING: You are about to deploy to ICP MAINNET"
echo "This will consume cycles and deploy to production."
echo "Make sure you have:"
echo "1. Sufficient cycles in your wallet"
echo "2. Updated .env.production with Mapbox API key"
echo ""
read -p "Are you sure you want to continue? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "Deployment cancelled."
    exit 0
fi

# Check cycles balance
echo ""
echo "💰 Checking cycles balance..."
dfx wallet --network ic balance

# Deploy backend canisters
echo ""
echo "🚀 Deploying backend canisters..."

# Deploy RewardMint
echo "Deploying RewardMint..."
REWARD_MINT_ID=$(dfx deploy reward_mint --network ic --with-cycles 500_000_000_000 2>&1 | grep -o "reward_mint: [a-z0-9-]*" | cut -d' ' -f2 || dfx canister --network ic id reward_mint)
echo "✅ RewardMint deployed: $REWARD_MINT_ID"

# Deploy PhotoNFT
echo "Deploying PhotoNFT..."
PHOTO_NFT_ID=$(dfx deploy photo_nft --network ic --with-cycles 500_000_000_000 2>&1 | grep -o "photo_nft: [a-z0-9-]*" | cut -d' ' -f2 || dfx canister --network ic id photo_nft)
echo "✅ PhotoNFT deployed: $PHOTO_NFT_ID"

# Deploy ReputationOracle
echo "Deploying ReputationOracle..."
REPUTATION_ORACLE_ID=$(dfx deploy reputation_oracle --network ic --with-cycles 300_000_000_000 2>&1 | grep -o "reputation_oracle: [a-z0-9-]*" | cut -d' ' -f2 || dfx canister --network ic id reputation_oracle)
echo "✅ ReputationOracle deployed: $REPUTATION_ORACLE_ID"

# Deploy GameEngine
echo "Deploying GameEngine..."
GAME_ENGINE_ID=$(dfx deploy game_engine --network ic --with-cycles 300_000_000_000 2>&1 | grep -o "game_engine: [a-z0-9-]*" | cut -d' ' -f2 || dfx canister --network ic id game_engine)
echo "✅ GameEngine deployed: $GAME_ENGINE_ID"

# Update .env.production with canister IDs
echo ""
echo "📝 Updating environment variables..."
sed -i.bak "s/VITE_GAME_ENGINE_CANISTER_ID=.*/VITE_GAME_ENGINE_CANISTER_ID=$GAME_ENGINE_ID/" src/frontend/.env.production
sed -i.bak "s/VITE_PHOTO_NFT_CANISTER_ID=.*/VITE_PHOTO_NFT_CANISTER_ID=$PHOTO_NFT_ID/" src/frontend/.env.production
sed -i.bak "s/VITE_REWARD_MINT_CANISTER_ID=.*/VITE_REWARD_MINT_CANISTER_ID=$REWARD_MINT_ID/" src/frontend/.env.production
sed -i.bak "s/VITE_HOST=.*/VITE_HOST=https:\/\/ic0.app/" src/frontend/.env.production
sed -i.bak "s/VITE_IDENTITY_PROVIDER=.*/VITE_IDENTITY_PROVIDER=https:\/\/identity.ic0.app/" src/frontend/.env.production

# Build frontend with production config
echo ""
echo "📦 Building frontend with production config..."
cd src/frontend
npm run build
cd ../..

# Deploy frontend canister
echo ""
echo "🌐 Deploying frontend..."
FRONTEND_ID=$(dfx deploy frontend --network ic --with-cycles 200_000_000_000 2>&1 | grep -o "frontend: [a-z0-9-]*" | cut -d' ' -f2 || dfx canister --network ic id frontend)
echo "✅ Frontend deployed: $FRONTEND_ID"

# Set up inter-canister permissions
echo ""
echo "🔧 Setting up inter-canister permissions..."

# Set GameEngine in PhotoNFT
dfx canister --network ic call photo_nft setGameEngineCanister "(principal \"$GAME_ENGINE_ID\")"

# Set RewardMint in GameEngine
dfx canister --network ic call game_engine setRewardMintCanister "(principal \"$REWARD_MINT_ID\")"

# Set PhotoNFT in GameEngine
dfx canister --network ic call game_engine setPhotoNFTCanister "(principal \"$PHOTO_NFT_ID\")"

# Set ReputationOracle in GameEngine
dfx canister --network ic call game_engine setReputationOracleCanister "(principal \"$REPUTATION_ORACLE_ID\")"

# Set GameEngine in RewardMint
dfx canister --network ic call reward_mint setGameEngineCanister "(principal \"$GAME_ENGINE_ID\")"

# Verify deployment
echo ""
echo "✅ Deployment complete!"
echo ""
echo "========================================="
echo "🎮 Your app is live at:"
echo "   https://$FRONTEND_ID.ic0.app"
echo ""
echo "📊 Canister IDs:"
echo "   Frontend: $FRONTEND_ID"
echo "   GameEngine: $GAME_ENGINE_ID"
echo "   PhotoNFT: $PHOTO_NFT_ID"
echo "   RewardMint: $REWARD_MINT_ID"
echo "   ReputationOracle: $REPUTATION_ORACLE_ID"
echo ""
echo "💰 Check canister status:"
echo "   dfx canister --network ic status --all"
echo ""
echo "⚠️  IMPORTANT NEXT STEPS:"
echo "1. Save all canister IDs securely"
echo "2. Test all functionality"
echo "3. Monitor cycles balance"
echo "4. Set up automated backups"
echo "========================================="