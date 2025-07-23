#!/bin/bash
set -e

# Build the contract with cargo near build for NEAR compatibility
echo "Building contract with cargo-near..."

# Create the target/near directory structure manually if needed
mkdir -p target/near

# Copy the compiled WASM to expected location
if [ -f "target/near/cross_chain_htlc.wasm" ]; then
    echo "Using existing cargo-near compiled WASM"
else
    echo "WARNING: cargo near build must be run manually first"
    echo "Run: cargo near build"
    exit 1
fi

# Copy the wasm file to out directory
mkdir -p out
cp target/near/cross_chain_htlc.wasm out/cross_chain_htlc.wasm

echo "NEAR contract built successfully!"
echo "Contract WASM: out/cross_chain_htlc.wasm"