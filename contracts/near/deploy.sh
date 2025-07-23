#!/bin/bash

# NEAR Cross-Chain HTLC Contract Deployment Script
set -e

echo "🚀 NEAR Cross-Chain HTLC Deployment"
echo "==================================="

# Configuration
ACCOUNT_ID="demo.cuteharbor3573.testnet"
CONTRACT_NAME="cross-chain-htlc"
FULL_CONTRACT_ID="$CONTRACT_NAME.$ACCOUNT_ID"

# Check if NEAR CLI is installed
if ! command -v near &> /dev/null; then
    echo "❌ NEAR CLI not found. Please install it first:"
    echo "npm install -g near-cli"
    exit 1
fi

# Check if logged in
if ! near state "$ACCOUNT_ID" &> /dev/null; then
    echo "❌ Not logged in to NEAR. Please login first:"
    echo "near login"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "├── Master Account: $ACCOUNT_ID"
echo "├── Contract Account: $FULL_CONTRACT_ID"
echo "└── Network: testnet"

# Build the contract
echo ""
echo "🔨 Building Contract..."
./build.sh

# Check if contract account exists
if near state "$FULL_CONTRACT_ID" &> /dev/null; then
    echo "⚠️  Contract account $FULL_CONTRACT_ID already exists"
    read -p "Do you want to redeploy? (y/N): " confirm
    if [[ $confirm != [yY] && $confirm != [yY][eE][sS] ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
else
    echo "📝 Creating contract account..."
    near create-account "$FULL_CONTRACT_ID" --masterAccount "$ACCOUNT_ID" --initialBalance 1
fi

# Deploy the contract
echo ""
echo "📦 Deploying contract..."
near deploy --wasmFile out/cross_chain_htlc.wasm --accountId "$FULL_CONTRACT_ID"

# Initialize the contract
echo ""
echo "🔧 Initializing contract..."
near call "$FULL_CONTRACT_ID" new '{}' --accountId "$ACCOUNT_ID"

# Add the deployer as an authorized resolver for testing
echo ""
echo "🔐 Adding deployer as authorized resolver..."
near call "$FULL_CONTRACT_ID" add_resolver "{\"resolver\": \"$ACCOUNT_ID\"}" --accountId "$ACCOUNT_ID"

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
OWNER=$(near call "$FULL_CONTRACT_ID" get_owner --accountId "$ACCOUNT_ID" 2>/dev/null | grep -o '".*"' | tr -d '"')
RESOLVER_COUNT=$(near call "$FULL_CONTRACT_ID" get_resolver_count --accountId "$ACCOUNT_ID" 2>/dev/null | grep -o '[0-9]')
IS_RESOLVER=$(near call "$FULL_CONTRACT_ID" is_authorized_resolver "{\"resolver\": \"$ACCOUNT_ID\"}" --accountId "$ACCOUNT_ID" 2>/dev/null | grep -o 'true\\|false')

echo ""
echo "🎉 Deployment Successful!"
echo "========================"
echo "📍 Contract Address: $FULL_CONTRACT_ID"
echo "👤 Owner: $OWNER"
echo "🔧 Authorized Resolvers: $RESOLVER_COUNT"
echo "✅ Deployer is Resolver: $IS_RESOLVER"
echo ""
echo "🌐 Explorer Links:"
echo "├── Contract: https://explorer.testnet.near.org/accounts/$FULL_CONTRACT_ID"
echo "└── Transactions: https://explorer.testnet.near.org/accounts/$FULL_CONTRACT_ID/transactions"
echo ""
echo "🧪 Test Commands:"
echo "├── Check contract state: near state $FULL_CONTRACT_ID"
echo "├── View functions: near view $FULL_CONTRACT_ID get_resolver_count"
echo "└── Run demo: node demo.js (update contract address first)"
echo ""
echo "🔗 Integration:"
echo "├── Ethereum Contract: 0x98c35dA70f839F1B7965b8b8BA17654Da11f4486"
echo "├── Network: Sepolia Testnet"
echo "└── Ready for cross-chain atomic swaps!"