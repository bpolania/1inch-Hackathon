#!/bin/bash

# 1inch Fusion+ NEAR Extension Deployment Script
set -e

echo "🚀 1inch Fusion+ NEAR Extension Deployment"
echo "========================================"

# Configuration
ACCOUNT_ID="demo.cuteharbor3573.testnet"
CONTRACT_NAME="fusion-plus-near"
FULL_CONTRACT_ID="$CONTRACT_NAME.$ACCOUNT_ID"
MIN_SAFETY_DEPOSIT_BPS=500 # 5% minimum safety deposit

# Check if NEAR CLI is installed
if ! command -v near &> /dev/null; then
    echo "❌ NEAR CLI not found. Please install it first:"
    echo "npm install -g near-cli"
    exit 1
fi

echo "📋 Deployment Configuration:"
echo "├── Master Account: $ACCOUNT_ID"
echo "├── Contract Account: $FULL_CONTRACT_ID"
echo "├── Network: testnet"
echo "├── Min Safety Deposit: $MIN_SAFETY_DEPOSIT_BPS bps (5%)"
echo "└── Integration: 1inch Fusion+"

# Build the contract
echo ""
echo "🔨 Building Fusion+ Contract..."
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
echo "📦 Deploying Fusion+ contract..."
near deploy "$FULL_CONTRACT_ID" out/cross_chain_htlc.wasm

# Initialize the contract
echo ""
echo "🔧 Initializing Fusion+ contract..."
near call "$FULL_CONTRACT_ID" new "{\"min_safety_deposit_bps\": $MIN_SAFETY_DEPOSIT_BPS}" --accountId "$ACCOUNT_ID"

# Add the deployer as an authorized 1inch resolver for testing
echo ""
echo "🔐 Adding deployer as 1inch authorized resolver..."
near call "$FULL_CONTRACT_ID" add_resolver "{\"resolver\": \"$ACCOUNT_ID\"}" --accountId "$ACCOUNT_ID"

# Verify deployment
echo ""
echo "✅ Verifying deployment..."
OWNER=$(near view "$FULL_CONTRACT_ID" get_owner --accountId "$ACCOUNT_ID" 2>/dev/null)
MIN_DEPOSIT=$(near view "$FULL_CONTRACT_ID" get_min_safety_deposit_bps --accountId "$ACCOUNT_ID" 2>/dev/null)
IS_RESOLVER=$(near view "$FULL_CONTRACT_ID" is_authorized_resolver "{\"resolver\": \"$ACCOUNT_ID\"}" --accountId "$ACCOUNT_ID" 2>/dev/null)

echo ""
echo "🎉 1inch Fusion+ NEAR Extension Deployed!"
echo "========================================"
echo "📍 Contract Address: $FULL_CONTRACT_ID"
echo "👤 Owner: $OWNER"
echo "💰 Min Safety Deposit: $MIN_DEPOSIT bps"
echo "✅ Deployer is 1inch Resolver: $IS_RESOLVER"
echo ""
echo "🌐 Explorer Links:"
echo "├── Contract: https://explorer.testnet.near.org/accounts/$FULL_CONTRACT_ID"
echo "└── Transactions: https://explorer.testnet.near.org/accounts/$FULL_CONTRACT_ID/transactions"
echo ""
echo "🧪 Test Commands:"
echo "├── Check order: near view $FULL_CONTRACT_ID get_order '{\"order_hash\": \"0x...\"}'"
echo "├── View resolver: near view $FULL_CONTRACT_ID is_authorized_resolver '{\"resolver\": \"account.testnet\"}'"
echo "└── Execute order: See fusion-demo.js for integration example"
echo ""
echo "🔗 1inch Fusion+ Integration:"
echo "├── Ethereum Factory: 0x98c35dA70f839F1B7965b8b8BA17654Da11f4486"
echo "├── NEAR Extension: $FULL_CONTRACT_ID"
echo "├── Network: Sepolia ↔ NEAR Testnet"
echo "└── Status: Ready for cross-chain Fusion+ swaps!"