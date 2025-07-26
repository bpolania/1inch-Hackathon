#!/bin/bash

# Build script for FusionPlusCosmos CosmWasm contract
# Optimized for deployment to Neutron and Juno testnets

set -e

echo "🔧 Building FusionPlusCosmos CosmWasm contract..."

# Clean previous builds
echo "📦 Cleaning previous builds..."
cargo clean

# Run tests first
echo "🧪 Running tests..."
cargo test

# Build optimized contract
echo "🏗️  Building optimized contract..."

# Check if docker is available for optimal builds
if command -v docker &> /dev/null; then
    echo "🐳 Using Docker for optimized build..."
    
    # Use official CosmWasm optimizer
    docker run --rm -v "$(pwd)":/code \
        --mount type=volume,source="$(basename "$(pwd)")_cache",target=/code/target \
        --mount type=volume,source=registry_cache,target=/usr/local/cargo/registry \
        cosmwasm/rust-optimizer:0.12.13
        
    # Check if contract was built successfully
    if [ -f "./artifacts/fusion_plus_cosmos.wasm" ]; then
        echo "✅ Optimized contract built successfully!"
        echo "📁 Contract location: ./artifacts/fusion_plus_cosmos.wasm"
        
        # Show contract size
        CONTRACT_SIZE=$(wc -c < "./artifacts/fusion_plus_cosmos.wasm")
        echo "📊 Contract size: ${CONTRACT_SIZE} bytes"
        
        # Verify the contract
        echo "🔍 Verifying contract..."
        cosmwasm-check ./artifacts/fusion_plus_cosmos.wasm
        
    else
        echo "❌ Failed to build optimized contract"
        exit 1
    fi
    
else
    echo "⚠️  Docker not available, building with cargo..."
    echo "📝 Note: For production deployment, use Docker optimization"
    
    # Build with cargo (less optimized)
    RUSTFLAGS='-C link-arg=-s' cargo build --release --target wasm32-unknown-unknown
    
    # Copy to artifacts directory
    mkdir -p artifacts
    cp target/wasm32-unknown-unknown/release/fusion_plus_cosmos.wasm artifacts/
    
    echo "✅ Contract built with cargo!"
    echo "📁 Contract location: ./artifacts/fusion_plus_cosmos.wasm"
    
    # Show contract size
    CONTRACT_SIZE=$(wc -c < "./artifacts/fusion_plus_cosmos.wasm")
    echo "📊 Contract size: ${CONTRACT_SIZE} bytes"
fi

# Generate schema
echo "📋 Generating contract schema..."
cargo schema

echo ""
echo "🎉 Build completed successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy to testnet: ./deploy.sh neutron-testnet"
echo "2. Deploy to testnet: ./deploy.sh juno-testnet"
echo "3. Run integration tests: ./test-integration.sh"
echo ""