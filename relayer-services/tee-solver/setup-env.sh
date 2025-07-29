#!/bin/bash

# Interactive Environment Variable Setup for NEAR Shade Agent TEE Solver

echo "🔧 NEAR Shade Agent TEE Solver - Environment Setup"
echo "=================================================="
echo ""

# Function to read input with default
read_with_default() {
    local prompt="$1"
    local default="$2"
    local var_name="$3"
    
    if [[ -n "${default}" ]]; then
        read -p "${prompt} [${default}]: " input
        input="${input:-$default}"
    else
        read -p "${prompt}: " input
    fi
    
    export "${var_name}=${input}"
}

echo "Please provide your testnet credentials:"
echo ""

# NEAR Account
echo "1. NEAR Testnet Account"
echo "   Create one at: https://wallet.testnet.near.org"
current_near=$(echo $NEAR_ACCOUNT)
read_with_default "Enter your NEAR testnet account" "$current_near" "NEAR_ACCOUNT"

echo ""

# NEAR Secret Key
echo "2. NEAR Secret Key"
echo "   Export from NEAR wallet or get from your testnet account"
current_key=$(echo $NEAR_SECRET_KEY)
read_with_default "Enter your NEAR secret key (ed25519:...)" "$current_key" "NEAR_SECRET_KEY"

echo ""

# 1inch API Key
echo "3. 1inch Development API Key"
echo "   Get one from: https://docs.1inch.dev/docs/getting-started"
current_api=$(echo $ONEINCH_AUTH_KEY)
read_with_default "Enter your 1inch API key" "$current_api" "ONEINCH_AUTH_KEY"

echo ""
echo "✅ Environment variables set successfully!"
echo ""

# Save to a file for later use
cat > .env.setup << EOF
# Generated environment variables for NEAR Shade Agent TEE Solver
export NEAR_ACCOUNT="${NEAR_ACCOUNT}"
export NEAR_SECRET_KEY="${NEAR_SECRET_KEY}"
export ONEINCH_AUTH_KEY="${ONEINCH_AUTH_KEY}"
EOF

echo "📁 Variables saved to .env.setup (you can source this file later)"
echo "   To reuse: source .env.setup"
echo ""

# Show what was set
echo "🎯 Environment Variables Set:"
echo "   NEAR_ACCOUNT: ${NEAR_ACCOUNT}"
echo "   NEAR_SECRET_KEY: ${NEAR_SECRET_KEY:0:20}..." 
echo "   ONEINCH_AUTH_KEY: ${ONEINCH_AUTH_KEY:0:10}..."
echo ""

# Ask if they want to run testnet setup now
read -p "🚀 Run testnet setup now? (y/n): " run_setup

if [[ "$run_setup" == "y" || "$run_setup" == "Y" ]]; then
    echo ""
    echo "🧪 Starting testnet setup..."
    ./testnet-setup.sh
else
    echo ""
    echo "👍 Environment ready! Run testnet setup when you're ready:"
    echo "   ./testnet-setup.sh"
fi